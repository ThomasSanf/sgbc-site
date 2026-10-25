import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { PDFDocument } from 'pdf-lib';
import { getDb } from '../lib/server/db';
import { orders, products } from '../lib/server/schema';
import { authorizedOrder, confirmationUrl, orderAccessToken, ORDER_LINK_LIFETIME } from '../lib/server/order-access';
import { publicOrderConfirmation } from '../lib/server/order-confirmation';
import { createOrderPdf } from '../lib/server/order-pdf';
import { publicEcpaySandbox } from '../lib/server/sandbox';
import { encryptEcpg } from '../lib/server/ecpg';
import { ecpayCheckout } from '../lib/server/ecpay';
import { GET, POST } from '../app/api/store/order-confirmation/route';
import { GET as download } from '../app/api/store/order-receipt/route';
import { POST as returned } from '../app/api/store/ecpg-return/route';

process.env.DATABASE_URL = ':memory:';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3000';
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('hex');
process.env.ECPAY_MERCHANT_ID = publicEcpaySandbox.merchantId;
process.env.ECPAY_HASH_KEY = publicEcpaySandbox.hashKey;
process.env.ECPAY_HASH_IV = publicEcpaySandbox.hashIV;
process.env.ECPAY_ENVIRONMENT = 'stage';
delete process.env.PUBLIC_ECPAY_SANDBOX;
const db = getDb(), productId = crypto.randomUUID();
const originalFetch = globalThis.fetch;
let order: typeof orders.$inferSelect;
before(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.insert(products).values({ id:productId, sku:'RECEIPT-QA', name:'SGBC Console · Rev C', price:550000, currency:'TWD', status:'active', stock:200, reserved:2, createdAt:Date.now(), updatedAt:Date.now() });
  [order] = await db.insert(orders).values({ id:crypto.randomUUID(), requestKey:crypto.randomUUID(), productId, productName:'SGBC Console · Rev C', sku:'RECEIPT-QA', name:'測試買家', email:'receipt@example.test', quantity:2, unitPrice:550000, total:1116000, shippingFee:16000, currency:'TWD', paymentProvider:'ecpay', paymentEnvironment:'stage', ecpayIntegration:'embedded', ecpayMerchantId:publicEcpaySandbox.merchantId, ecpayMerchantTradeNo:'Sconfirmationtest01', locale:'zh-TW', shippingAddress:JSON.stringify({ phone:'0900000000', country:'TW', city:'臺北市', district:'中正區', postalCode:'100', address:'忠孝東路一段 123 號 5 樓' }), createdAt:Date.now(), updatedAt:Date.now() }).returning();
});
after(() => { globalThis.fetch = originalFetch; db.$client.close(); });
function access(item = order) { return { order:item.id, token:orderAccessToken(item) }; }
function request(path = 'order-confirmation', values = access()) { return new Request(`http://127.0.0.1:3000/api/store/${path}/?${new URLSearchParams(values)}`); }

void test('confirmation capability is separate from payment access, bound to one order and expires', async () => {
  assert.notEqual(orderAccessToken(order), order.requestKey);
  assert.equal((await authorizedOrder(db,access())).id,order.id);
  for (const invalid of [{order:order.id,token:order.requestKey}, {order:order.id,token:'x'.repeat(43)}, {order:crypto.randomUUID(),token:orderAccessToken(order)}, {order:order.id}]) await assert.rejects(authorizedOrder(db,invalid));
  await assert.rejects(authorizedOrder(db,access(),order.createdAt+ORDER_LINK_LIFETIME));
  const changed = {...order,requestKey:crypto.randomUUID()};
  await assert.rejects(authorizedOrder(db,{order:order.id,token:orderAccessToken(changed)}));
});
void test('browser return keeps the private order link, ignores forged success and stays within provider URL limits', async () => {
  const before = (await db.select().from(products))[0];
  const callback = confirmationUrl(order,'/api/store/ecpg-return/');
  assert.ok(callback.length <= 200);
  const response = await returned(new Request(callback,{method:'POST',body:'RtnCode=1&TradeStatus=1'}));
  assert.equal(response.status,303); assert.equal(response.headers.get('location'),confirmationUrl(order));
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal((await db.select().from(orders))[0].status,'pending');
  assert.deepEqual((await db.select().from(products))[0],before);
  const invalid = await returned(new Request('http://127.0.0.1:3000/api/store/ecpg-return/?order='+order.id,{method:'POST',body:'RtnCode=1'}));
  assert.ok(!invalid.headers.get('location')?.includes('token='));
  const aio = ecpayCheckout({...order,ecpayIntegration:'aio'},publicEcpaySandbox);
  assert.equal(aio.fields.ClientBackURL,confirmationUrl(order));
  assert.equal(aio.fields.OrderResultURL,confirmationUrl(order,'/api/store/ecpay-return/'));
});
void test('confirmation and PDF require buyer capability and do not expose payment submission keys', async () => {
  for (const handler of [GET, download]) {
    assert.equal((await handler(request('order-confirmation',{order:order.id,token:'x'.repeat(43)}))).status,404);
    assert.equal((await handler(new Request('http://127.0.0.1:3000/api/store/order-confirmation/'))).status,404);
  }
  const response = await GET(request());
  assert.equal(response.status,200); assert.match(response.headers.get('cache-control') ?? '',/no-store/);
  const body = await response.text();
  for (const secret of [order.requestKey,orderAccessToken(order),'stripeSessionId','paymentIntentId','ecpayMerchantId']) assert.ok(!body.includes(secret));
  const data = JSON.parse(body);
  assert.equal(data.status,'pending'); assert.equal(data.sandbox,true);
  assert.equal(data.total,1116000); assert.equal(data.shipping.address,'忠孝東路一段 123 號 5 樓');
});
void test('customer refresh rejects CSRF and queries the provider before marking paid; repeat refresh preserves inventory', async () => {
  const body = JSON.stringify(access());
  const refresh = (origin = process.env.BETTER_AUTH_URL!) => new Request('http://127.0.0.1:3000/api/store/order-confirmation/',{method:'POST',headers:{origin,'content-type':'application/json'},body});
  assert.equal((await POST(refresh('https://evil.example'))).status,403);
  let queries = 0;
  const data = {MerchantID:publicEcpaySandbox.merchantId,RtnCode:1,OrderInfo:{MerchantTradeNo:order.ecpayMerchantTradeNo,TradeNo:'2610251234567899',TradeAmt:11160,TradeStatus:'1',PaymentType:'Credit'}};
  globalThis.fetch = async () => { queries++; return Response.json({MerchantID:publicEcpaySandbox.merchantId,TransCode:1,Data:encryptEcpg(data,publicEcpaySandbox)}); };
  const result = await POST(refresh());
  assert.equal(result.status,200); assert.equal((await result.json()).status,'paid');
  assert.equal((await db.select().from(products))[0].stock,198);
  assert.equal((await db.select().from(products))[0].reserved,0);
  assert.equal((await POST(refresh())).status,200); assert.equal(queries,1);
  globalThis.fetch = originalFetch;
});
void test('download produces a private real PDF for verified status, in both languages with Chinese delivery details', async () => {
  const current = publicOrderConfirmation((await db.select().from(orders))[0]);
  assert.equal(current.status,'paid');
  for (const locale of ['en','zh-TW'] as const) {
    const bytes = await createOrderPdf(current,locale);
    assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(),1);
    assert.match(pdf.getTitle() ?? '',/SGBC/);
    assert.ok(bytes.length > 10000 && bytes.length < 10000000);
  }
  const response = await download(request('order-receipt'));
  assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.match(response.headers.get('content-disposition') ?? '',/attachment/);
  assert.match(response.headers.get('cache-control') ?? '',/no-store/);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
});
void test('status and refunds in downloads come from the current order, never a success query parameter', async () => {
  await db.update(orders).set({status:'partially_refunded',refundedAmount:550000}).where(eq(orders.id,order.id));
  const url = new URL(request().url); url.searchParams.set('result','complete'); url.searchParams.set('status','paid');
  const data = await (await GET(new Request(url))).json();
  assert.equal(data.status,'partially_refunded'); assert.equal(data.refundedAmount,550000);
  assert.equal(publicOrderConfirmation({...order,paymentEnvironment:'live'}).sandbox,false);
});
