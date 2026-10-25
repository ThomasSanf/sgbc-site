import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from '../lib/server/db';
import { products, settings, orders, embeddedCheckouts } from '../lib/server/schema';
import { encryptEcpg, decryptEcpg, decodeEcpgEnvelope, createEmbeddedCheckout, completeEmbeddedPayment, cancelEmbeddedCheckout, handleEcpgNotification, verificationUrl } from '../lib/server/ecpg';
import { publicEcpaySandbox } from '../lib/server/sandbox';
import { applyEcpayResult } from '../lib/server/ecpay-store';
import { checkMacValue } from '../lib/server/ecpay';
import { POST as submit } from '../app/api/store/ecpg-payment/route';
import { POST as browserReturn } from '../app/api/store/ecpg-return/route';

process.env.DATABASE_URL = ':memory:';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3000';
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('hex');
delete process.env.PUBLIC_ECPAY_SANDBOX;
const db = getDb(), config = publicEcpaySandbox, productId = crypto.randomUUID();
const input = () => ({ productId, requestKey: crypto.randomUUID(), name: 'Test buyer', email: 'test@example.test', quantity: 1, expectedTotal: 558000, acknowledged: true, locale: 'en', shipping: { phone: '0900000000', postalCode: '100', city: '臺北市', district: '中正區', address: 'Test address 123', country: 'TW' } });
const envelope = (data: Record<string, unknown>) => ({ MerchantID: config.merchantId, TransCode: 1, Data: encryptEcpg({ MerchantID: config.merchantId, ...data }, config) });
const originalFetch = globalThis.fetch;
let calls: Array<{ url: string; data: Record<string, unknown> }> = [];
function mockProvider(respond?: (url: string, data: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(typeof init?.body, 'string');
    const request = JSON.parse(init!.body as string);
    const data = decryptEcpg(request.Data, config);
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: href, data });
    assert.equal(request.MerchantID, config.merchantId);
    assert.ok(Math.abs(Date.now() / 1000 - request.RqHeader.Timestamp) < 10);
    assert.equal(init?.redirect, 'error');
    return Response.json(envelope(respond ? await respond(href, data) : { RtnCode: 1, Token: 'test-sdk-token-1234567890' }));
  };
}
before(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.insert(products).values({ id: productId, sku: 'EMBEDDED-TEST', name: 'SGBC', price: 550000, currency: 'TWD', status: 'active', stock: 200, createdAt: 1, updatedAt: 1 });
  await db.insert(settings).values({ id: 'store', checkoutOpen: true, shippingFeePerUnit: 8000, updatedAt: 1 });
});
after(() => { globalThis.fetch = originalFetch; db.$client.close(); });

void test('ECPG encryption matches the official AES vector and rejects malformed or cross-merchant responses', () => {
  const ciphertext = 'o4TJSHkQBM1bogbn5BNFRofCVTfsQjoqv/TX8DKn757fe5AoYzoalYmrMsGXTiwxGpI8NsE2vu4tScAwISx8kw==';
  assert.equal(encryptEcpg({ Name: 'Test', ID: 'A123456789' }, config), ciphertext);
  assert.deepEqual(decryptEcpg(ciphertext, config), { Name: 'Test', ID: 'A123456789' });
  const unicode = { Name: '王 小明', Description: "A+B & <x> !*()~'" };
  assert.deepEqual(decryptEcpg(encryptEcpg(unicode, config), config), unicode);
  for (const data of ['', 'not encrypted', 'AAAA', ciphertext.slice(4)]) assert.throws(() => decryptEcpg(data, config));
  assert.throws(() => decodeEcpgEnvelope({ ...envelope({ RtnCode: 1 }), MerchantID: 'wrong' }, config));
  assert.throws(() => decodeEcpgEnvelope(envelope({ MerchantID: 'wrong', RtnCode: 1 }), config));
  assert.throws(() => decodeEcpgEnvelope({ ...envelope({ RtnCode: 1 }), TransCode: 0 }, config));
  for (const url of ['javascript:alert(1)', 'http://ecpg-stage.ecpay.com.tw/', 'https://ecpay.com.tw.evil.test/', 'https://user:pass@ecpg.ecpay.com.tw/']) assert.throws(() => verificationUrl(url));
});

void test('embedded checkout fixes amount, card-only method and callbacks server-side; retries reuse the token and hold', async () => {
  mockProvider();
  const raw = input(), before = (await db.select().from(products))[0];
  const session = await createEmbeddedCheckout(db, raw, config);
  assert.equal(session.provider, 'ecpay-embedded'); assert.equal(session.summary.total, 558000);
  assert.deepEqual(await createEmbeddedCheckout(db, raw, config), session);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.ChoosePaymentList, '1'); assert.equal(calls[0].data.RememberCard, 0);
  const orderInfo = calls[0].data.OrderInfo as { TotalAmount: number; ReturnURL: string };
  const cardInfo = calls[0].data.CardInfo as { OrderResultURL: string };
  assert.equal(orderInfo.TotalAmount, 5580);
  assert.match(orderInfo.ReturnURL, /\/api\/webhooks\/ecpg\/$/);
  assert.match(cardInfo.OrderResultURL, /\/api\/store\/ecpg-return\//);
  assert.equal((await db.select().from(products))[0].reserved, before.reserved + 1);
  assert.ok(!JSON.stringify(session).includes(config.hashKey));
  await assert.rejects(createEmbeddedCheckout(db, { ...raw, expectedTotal: 1 }, config));
});

void test('only the buyer can submit, duplicate submissions call CreatePayment once and browser return cannot mark paid', async () => {
  mockProvider(); const raw = input(), checkout = await createEmbeddedCheckout(db, raw, config);
  const body = { orderId: checkout.orderId, requestKey: raw.requestKey, payToken: 'test-pay-token-1234567890' };
  mockProvider((_url, data) => ({ RtnCode: 1, OrderInfo: { MerchantTradeNo: data.MerchantTradeNo }, ThreeDInfo: { ThreeDURL: 'https://ecpg-stage.ecpay.com.tw/test-3d' } }));
  await assert.rejects(completeEmbeddedPayment(db, { ...body, requestKey: crypto.randomUUID() }, config));
  await assert.rejects(completeEmbeddedPayment(db, { ...body, amount: 1 }, config));
  const response = await completeEmbeddedPayment(db, body, config);
  assert.equal(response.url, 'https://ecpg-stage.ecpay.com.tw/test-3d');
  assert.deepEqual(await completeEmbeddedPayment(db, body, config), response);
  assert.equal(calls.length, 1);
  await assert.rejects(cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: raw.requestKey }));
  const returned = await browserReturn(new Request('http://127.0.0.1:3000/api/store/ecpg-return/?locale=en', { method: 'POST', body: 'forged paid result' }));
  assert.equal(returned.status, 303);
  assert.equal((await db.select().from(orders).where(eq(orders.id, checkout.orderId)))[0].status, 'pending');
  assert.equal((await submit(new Request('http://127.0.0.1:3000/api/store/ecpg-payment/', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: JSON.stringify(body) }))).status, 403);
});

void test('uncertain CreatePayment failures retain the hold and never resubmit a card token', async () => {
  mockProvider(); const raw = input(), checkout = await createEmbeddedCheckout(db, raw, config);
  const body = { orderId: checkout.orderId, requestKey: raw.requestKey, payToken: 'test-pay-token-1234567890' };
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw new Error('network timeout after provider received payment'); };
  await assert.rejects(completeEmbeddedPayment(db, body, config));
  assert.match((await completeEmbeddedPayment(db, body, config)).url, /\/checkout\/result\//);
  assert.equal(attempts, 1);
  await assert.rejects(cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: raw.requestKey }));
  assert.equal((await db.select().from(orders).where(eq(orders.id, checkout.orderId)))[0].status, 'pending');
});

void test('editing before submission cancels once, releases the hold and prevents payment with the old token', async () => {
  mockProvider(); const raw = input(), checkout = await createEmbeddedCheckout(db, raw, config);
  const before = (await db.select().from(products))[0];
  await assert.rejects(cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: crypto.randomUUID() }));
  await cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: raw.requestKey });
  await cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: raw.requestKey });
  await completeEmbeddedPayment(db, { orderId: checkout.orderId, requestKey: raw.requestKey, payToken: 'test-pay-token-1234567890' }, config);
  assert.equal(calls.length, 1); // Only GetTokenbyTrade; never CreatePayment.
  const after = (await db.select().from(products))[0];
  assert.equal(after.reserved, before.reserved - 1); assert.equal(after.stock, before.stock);
});

void test('expired sessions cannot submit card payment, but can be safely cancelled before submission', async () => {
  mockProvider(); const raw = input(), checkout = await createEmbeddedCheckout(db, raw, config);
  await db.update(embeddedCheckouts).set({ expiresAt: Date.now() - 1 }).where(eq(embeddedCheckouts.orderId, checkout.orderId));
  await assert.rejects(completeEmbeddedPayment(db, { orderId: checkout.orderId, requestKey: raw.requestKey, payToken: 'test-pay-token-1234567890' }, config));
  await cancelEmbeddedCheckout(db, { orderId: checkout.orderId, requestKey: raw.requestKey });
  assert.equal(calls.length, 1);
});

void test('encrypted notifications require matching amount, merchant, protocol and an independent paid provider query', async () => {
  mockProvider(); const raw = input(), checkout = await createEmbeddedCheckout(db, raw, config);
  const result = { RtnCode: 1, OrderInfo: { MerchantTradeNo: checkout.merchantTradeNo, TradeNo: '2610251234567890', TradeAmt: 5580, TradeStatus: '1', PaymentType: 'Credit' }, CustomField: checkout.orderId };
  const before = (await db.select().from(products))[0];
  mockProvider(() => ({ ...result, OrderInfo: { ...result.OrderInfo, TradeStatus: '0' } }));
  await assert.rejects(handleEcpgNotification(db, envelope(result), config));
  await assert.rejects(handleEcpgNotification(db, envelope({ ...result, OrderInfo: { ...result.OrderInfo, TradeAmt: 1 } }), config));
  await handleEcpgNotification(db, envelope({ ...result, SimulatePaid: 1 }), config);
  assert.equal((await db.select().from(orders).where(eq(orders.id, checkout.orderId)))[0].status, 'pending');
  const aio = { MerchantID: config.merchantId, MerchantTradeNo: checkout.merchantTradeNo, TradeNo: result.OrderInfo.TradeNo, TradeAmt: '5580', TradeStatus: '1', PaymentType: 'Credit' };
  await assert.rejects(applyEcpayResult(db, { ...aio, CheckMacValue: checkMacValue(aio, config) }, config, 'query'));
  mockProvider(() => result);
  await handleEcpgNotification(db, envelope(result), config);
  await handleEcpgNotification(db, envelope(result), config);
  assert.ok(calls.every(call => call.url === 'https://ecpayment-stage.ecpay.com.tw/1.0.0/Cashier/QueryTrade'));
  const after = (await db.select().from(products))[0];
  assert.equal(after.stock, before.stock - 1); assert.equal(after.reserved, before.reserved - 1);
  assert.equal((await db.select().from(orders).where(eq(orders.id, checkout.orderId)))[0].status, 'paid');
});
