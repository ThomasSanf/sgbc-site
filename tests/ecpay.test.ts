import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from '../lib/server/db';
import { orders, products, settings, webhookEvents, auditEvents } from '../lib/server/schema';
import { SALES_POLICY_VERSION } from '../lib/sales-policy-version';
import { saveProduct, adjustInventory, dashboardData, fulfillOrder, updateSettings, createReservation, reserveCheckout } from '../lib/server/store';
import { reserveEcpayCheckout, applyEcpayResult } from '../lib/server/ecpay-store';
import { checkMacValue, verifyEcpayFields, parseEcpayForm, ecpayCheckout, ecpayConfig, taipeiTradeDate, type EcpayConfig, type EcpayFields } from '../lib/server/ecpay';
import { ecpayConfigured, paymentProvider, ecpayEnvironment } from '../lib/server/config';
import { SANDBOX_PRODUCT_ID, SANDBOX_SETTINGS_ID, publicEcpaySandbox } from '../lib/server/sandbox';
import { shippingInput } from '../lib/server/validation';
import { taiwanCities, taiwanDistrict } from '../lib/shipping';
import { POST as notify } from '../app/api/webhooks/ecpay/route';
import { POST as browserReturn } from '../app/api/store/ecpay-return/route';
import { POST as checkout, GET as catalog } from '../app/api/store/[resource]/route';

process.env.DATABASE_URL = ':memory:';
delete process.env.PUBLIC_ECPAY_SANDBOX;
process.env.PAYMENT_PROVIDER = 'ecpay';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3000';
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('hex');
process.env.ECPAY_MERCHANT_ID = '8888888';
process.env.ECPAY_HASH_KEY = 'local-test-key-16';
process.env.ECPAY_HASH_IV = 'local-test-iv--16';
process.env.ECPAY_ENVIRONMENT = 'live';
const config: EcpayConfig = { merchantId: '8888888', hashKey: 'local-test-key-16', hashIV: 'local-test-iv--16', environment: 'live' };
const db = getDb();
const shipping = { phone: '0912345678', postalCode: '100', city: '臺北市', district: '中正區', address: 'Test address 123', country: 'TW' };
let productId = '';
const signed = (fields: EcpayFields, cfg = config) => ({ ...fields, CheckMacValue: checkMacValue(fields, cfg) });
const payload = (quantity = 1) => ({ productId, name: 'Test buyer', email: 'buyer@example.test', quantity, requestKey: crypto.randomUUID(), shipping, locale: 'zh-TW', expectedTotal: 558000 * quantity, acknowledged: true, policyAccepted: true, policyVersion: SALES_POLICY_VERSION });
const payment = (order: typeof orders.$inferSelect, extra: EcpayFields = {}, cfg = config) => signed({ MerchantID: cfg.merchantId, MerchantTradeNo: order.ecpayMerchantTradeNo!, TradeNo: randomBytes(8).toString('hex'), TradeAmt: String(order.total / 100), PaymentType: 'Credit_CreditCard', RtnCode: '1', SimulatePaid: '0', CustomField1: order.id, ...extra }, cfg);
const formRequest = (fields: EcpayFields) => new Request('http://127.0.0.1:3000/api/webhooks/ecpay/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });
before(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  productId = (await saveProduct(db, 'test', { name: 'SGBC', sku: 'SGBC-TEST', description: '', price: 550000, currency: 'TWD', status: 'active', lowStock: 5 })).id;
  await adjustInventory(db, 'test', { productId, delta: 200, reason: 'Test batch allocation' });
  await updateSettings(db, 'test', { reservationsOpen: false, checkoutOpen: true, shippingFeePerUnit: 8000 }, true);
});
after(() => db.$client.close());

test('payment service rejects missing, unchecked or outdated policy acceptance without reserving stock', async () => {
  const before = (await db.select().from(products).where(eq(products.id, productId)))[0].reserved;
  const orderCount = await db.$count(orders), auditCount = await db.$count(auditEvents);
  for (const consent of [
    { policyAccepted: undefined, policyVersion: undefined },
    { policyAccepted: false }, { policyAccepted: 'true' },
    { policyVersion: undefined }, { policyVersion: 'outdated-policy' },
  ]) {
    await assert.rejects(reserveEcpayCheckout(db, { ...payload(), ...consent }, config));
  }
  assert.equal((await db.select().from(products).where(eq(products.id, productId)))[0].reserved, before);
  assert.equal(await db.$count(orders), orderCount);
  assert.equal(await db.$count(auditEvents), auditCount);
});

test('policy consent records the version, language and server timestamp once per order', async () => {
  const raw = payload(), start = Date.now();
  const order = await reserveEcpayCheckout(db, raw, config);
  await reserveEcpayCheckout(db, raw, config);
  const consent = (await db.select().from(auditEvents).where(eq(auditEvents.entityId, order.id))).filter(event => event.action === 'order.policy_accepted');
  assert.equal(consent.length, 1);
  assert.deepEqual(JSON.parse(consent[0].detail), { policyVersion: SALES_POLICY_VERSION, locale: 'zh-TW' });
  assert.ok(consent[0].createdAt >= start && consent[0].createdAt <= Date.now());
  await db.delete(auditEvents).where(eq(auditEvents.id, consent[0].id));
  await assert.rejects(reserveEcpayCheckout(db, raw, config), /accept the current sales policy/);
  // Restore the shared inventory fixture; this test never exposes a payable provider session.
  await db.delete(auditEvents).where(eq(auditEvents.entityId, order.id));
  await db.delete(orders).where(eq(orders.id, order.id));
  await db.update(products).set({ reserved: sql`${products.reserved} - ${raw.quantity}` }).where(eq(products.id, productId));
});

test('checksum matches the official ECPay example including Chinese and spaces', () => {
  const example = { TradeDesc: '促銷方案', PaymentType: 'aio', MerchantTradeDate: '2023/03/12 15:30:23', MerchantTradeNo: 'ecpay20230312153023', MerchantID: '3002607', ReturnURL: 'https://www.ecpay.com.tw/receive.php', ItemName: 'Apple iphone 15', TotalAmount: '30000', ChoosePayment: 'ALL', EncryptType: '1' };
  assert.equal(checkMacValue(example, { hashKey: 'pwFHCqoQZGmho4w6', hashIV: 'EkRm7iFT261dpevs' }), '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840');
  assert.equal(taipeiTradeDate(Date.parse('2026-01-01T16:00:00Z')), '2026/01/02 00:00:00');
});
test('rejects forged, ambiguous and cross-merchant forms', () => {
  const fields = signed({ MerchantID: config.merchantId, TradeAmt: '5580', ItemName: "Test !*()~' +&=" });
  verifyEcpayFields(fields, config);
  assert.throws(() => verifyEcpayFields({ ...fields, TradeAmt: '1' }, config));
  assert.throws(() => verifyEcpayFields(signed({ MerchantID: '7777777' }), config));
  for (const body of ['TradeAmt=1&TradeAmt=2', 'TradeAmt=1&tradeamt=2', '__proto__=x']) assert.throws(() => parseEcpayForm(body));
});
test('public test credentials cannot enable live checkout or Vercel production sandbox', () => {
  process.env.ECPAY_MERCHANT_ID = '3002607'; assert.equal(ecpayConfigured(), false);
  process.env.ECPAY_ENVIRONMENT = 'stage'; assert.equal(ecpayConfigured(), true);
  process.env.VERCEL_ENV = 'production'; assert.equal(ecpayConfigured(), false);
  delete process.env.VERCEL_ENV; process.env.ECPAY_MERCHANT_ID = config.merchantId; process.env.ECPAY_ENVIRONMENT = 'live';
});
test('checkout requires a confirmed delivery rate and never assumes free shipping', async () => {
  await assert.rejects(updateSettings(db, 'test', { reservationsOpen: false, checkoutOpen: true, shippingFeePerUnit: null }, true));
  await db.update(settings).set({ shippingFeePerUnit: null }).where(eq(settings.id, 'store'));
  const response = await catalog(new Request('http://127.0.0.1:3000/api/store/catalog/'), ctx('catalog'));
  assert.equal((await response.json()).checkoutOpen, false);
  await assert.rejects(reserveEcpayCheckout(db, payload(), config));
  await db.update(settings).set({ shippingFeePerUnit: 8000 }).where(eq(settings.id, 'store'));
});
test('delivery is per unit, amounts are server-controlled, and retries hold stock once', async () => {
  const input = payload(2), order = await reserveEcpayCheckout(db, input, config);
  assert.equal(order.total, 1116000); assert.equal(order.shippingFee, 16000);
  assert.equal((await reserveEcpayCheckout(db, input, config)).id, order.id);
  await assert.rejects(reserveEcpayCheckout(db, { ...input, shipping: { ...shipping, address: 'Changed address' } }, config));
  await assert.rejects(reserveEcpayCheckout(db, { ...payload(), expectedTotal: 1 }, config));
  await assert.rejects(reserveEcpayCheckout(db, { ...payload(), total: 1 }, config));
  await assert.rejects(reserveEcpayCheckout(db, { ...payload(), acknowledged: false }, config));
  assert.equal((await db.select().from(products).where(eq(products.id, productId)))[0].reserved, 2);
  const destination = ecpayCheckout(order, config);
  assert.equal(destination.fields.TotalAmount, '11160'); assert.equal(destination.fields.ChoosePayment, 'Credit');
  assert.equal(destination.fields.IgnorePayment, 'ApplePay#DigitalPayment');
  assert.equal(destination.fields.UnionPay, '2'); assert.ok(!('Language' in destination.fields));
  assert.notEqual(destination.fields.ReturnURL, destination.fields.OrderResultURL);
  assert.match(destination.fields.MerchantTradeNo, /^[A-Za-z0-9]{1,20}$/);
  assert.equal(JSON.stringify(destination).includes(config.hashKey), false);
  assert.deepEqual(ecpayCheckout(await reserveEcpayCheckout(db, input, config), config), destination);
});
test('mismatched amounts, methods and environments cannot consume stock', async () => {
  const order = await reserveEcpayCheckout(db, payload(), config);
  await assert.rejects(applyEcpayResult(db, payment(order, { TradeAmt: '1' }), config, 'notify'));
  await assert.rejects(applyEcpayResult(db, payment(order, { PaymentType: 'ATM_TAISHIN' }), config, 'notify'));
  await assert.rejects(applyEcpayResult(db, payment(order), { ...config, environment: 'stage' }, 'notify'));
  assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, 'pending');
});
test('simulation, failed attempts and browser returns never mark an order paid or release stock', async () => {
  const order = await reserveEcpayCheckout(db, payload(), config);
  await applyEcpayResult(db, payment(order, { SimulatePaid: '1' }), config, 'notify');
  await applyEcpayResult(db, payment(order, { RtnCode: '10300066' }), config, 'notify');
  const result = await browserReturn(formRequest(payment(order)));
  assert.equal(result.status, 303);
  const current = (await db.select().from(orders).where(eq(orders.id, order.id)))[0];
  assert.equal(current.status, 'pending');
  assert.equal(current.ecpayTradeNo, null);
});
test('duplicate and out-of-order notifications consume a paid allocation exactly once', async () => {
  const order = await reserveEcpayCheckout(db, payload(), config), result = payment(order);
  const before = (await db.select().from(products).where(eq(products.id, productId)))[0];
  await applyEcpayResult(db, result, config, 'notify');
  await applyEcpayResult(db, result, config, 'notify');
  await applyEcpayResult(db, signed({ ...result, RtnCode: '10100254' }), config, 'notify');
  const after = (await db.select().from(products).where(eq(products.id, productId)))[0];
  assert.equal(after.stock, before.stock - 1); assert.equal(after.reserved, before.reserved - 1);
  assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, 'paid');
});
test('webhook queries current signed provider state, and acknowledges only after persistence', async () => {
  const order = await reserveEcpayCheckout(db, payload(), config), fields = payment(order), originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(String(url), 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5');
    verifyEcpayFields(parseEcpayForm(String(init?.body)), config);
    return new Response(new URLSearchParams(signed({ ...fields, TradeStatus: '1' })).toString());
  };
  try {
    const response = await notify(formRequest(fields)); assert.equal(response.status, 200); assert.equal(await response.text(), '1|OK'); assert.equal(calls, 1);
    assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, 'paid');
  } finally { globalThis.fetch = originalFetch; }
});
test('provider outages, bad signatures and oversized notifications never confirm orders', async () => {
  const order = await reserveEcpayCheckout(db, payload(), config), fields = payment(order), originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('test outage'); };
  try {
    assert.equal((await notify(formRequest(fields))).status, 502);
    assert.equal((await notify(formRequest({ ...fields, CheckMacValue: 'forged' }))).status, 400);
    assert.equal((await notify(formRequest({ data: 'x'.repeat(70_000) }))).status, 413);
    assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, 'pending');
  } finally { globalThis.fetch = originalFetch; }
});
test('sandbox sales cannot inflate real revenue or be fulfilled', async () => {
  const stage = { ...config, environment: 'stage' as const }, before = await dashboardData(db);
  const order = await reserveEcpayCheckout(db, payload(), stage);
  await applyEcpayResult(db, payment(order, {}, stage), stage, 'notify');
  assert.deepEqual((await dashboardData(db)).revenue, before.revenue);
  await assert.rejects(fulfillOrder(db, 'test', { id: order.id, trackingNumber: 'TEST-NO-SHIP' }));
  assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, 'paid');
});
test('public checkout validates origins and stays paused while collecting wishlist signups', async () => {
  const request = (body: unknown, origin = 'http://127.0.0.1:3000') => new Request('http://127.0.0.1:3000/api/store/checkout/', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  assert.equal((await checkout(request(payload(), 'https://evil.example'), ctx('checkout'))).status, 403);
  const before = await db.$count(orders);
  assert.equal((await checkout(request({ ...payload(), acknowledged: false }), ctx('checkout'))).status, 409);
  assert.equal((await checkout(request(payload()), ctx('checkout'))).status, 409);
  assert.equal(await db.$count(orders), before);
});
test('Taiwan address data covers all administrative areas, including districts sharing postal codes', () => {
  assert.equal(taiwanCities.length, 22);
  assert.equal(taiwanCities.reduce((count, city) => count + city.districts.length, 0), 368);
  assert.equal(new Set(taiwanCities.map(city => city.name)).size, 22);
  for (const city of taiwanCities) {
    assert.equal(new Set(city.districts.map(district => district.name)).size, city.districts.length);
    for (const district of city.districts) assert.equal(shippingInput.safeParse({ ...shipping, city: city.name, district: district.name, postalCode: district.postalCode }).success, true);
  }
  assert.equal(taiwanDistrict('新竹市', '東區')?.postalCode, '300');
  assert.equal(taiwanDistrict('新竹市', '北區')?.postalCode, '300');
  assert.equal(taiwanDistrict('嘉義市', '西區')?.postalCode, '600');
});

test('delivery validation rejects overseas destinations, mismatched districts and postal prefixes', () => {
  for (const postalCode of ['100', '10001', '100001']) assert.equal(shippingInput.safeParse({ ...shipping, postalCode }).success, true);
  for (const country of ['JP', 'SG', 'FR', 'US']) assert.equal(shippingInput.safeParse({ ...shipping, country }).success, false);
  for (const changes of [{ city: 'Taipei' }, { city: '臺北市', district: '板橋區' }, { district: '' }, { district: undefined }, { postalCode: '220001' }, { postalCode: '1000001' }]) assert.equal(shippingInput.safeParse({ ...shipping, ...changes }).success, false);
});

test('checkout preserves Taiwan districts and rejects overseas orders even in sandbox', async () => {
  const stage = { ...config, environment: 'stage' as const };
  const before = (await db.select().from(products).where(eq(products.id, productId)))[0];
  for (const country of ['JP', 'SG', 'FR']) {
    for (const environment of [config, stage]) await assert.rejects(reserveEcpayCheckout(db, { ...payload(), shipping: { ...shipping, country } }, environment));
  }
  assert.deepEqual((await db.select().from(products).where(eq(products.id, productId)))[0], before);
  const address = { ...shipping, city: '新北市', district: '板橋區', postalCode: '220' };
  const input = { ...payload(), shipping: address };
  const order = await reserveEcpayCheckout(db, input, stage);
  assert.deepEqual(JSON.parse(order.shippingAddress!), address);
  assert.equal(order.shippingFee, 8000); assert.equal(order.total, 558000);
  assert.equal((await reserveEcpayCheckout(db, input, stage)).id, order.id);
  await assert.rejects(reserveEcpayCheckout(db, { ...input, shipping }, stage));
});

test('simultaneous attempts for the last unit cannot oversell the allocation', async () => {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  await db.update(products).set({ stock: product.reserved + 1 }).where(eq(products.id, productId));
  const results = await Promise.allSettled([reserveEcpayCheckout(db, payload(), config), reserveEcpayCheckout(db, payload(), config)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  const [after] = await db.select().from(products).where(eq(products.id, productId));
  assert.equal(after.reserved, after.stock);
  assert.ok((await db.select({ count: sql<number>`count(*)` }).from(webhookEvents))[0].count > 0);
});

test('public sandbox forces test credentials and keeps catalog, inventory, settings and revenue isolated', async () => {
  const previous = { PUBLIC_ECPAY_SANDBOX: process.env.PUBLIC_ECPAY_SANDBOX, VERCEL_ENV: process.env.VERCEL_ENV, PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER };
  const originalFetch = globalThis.fetch, before = await dashboardData(db);
  const [liveProduct] = await db.select().from(products).where(eq(products.id, productId));
  await db.insert(products).values({ id: SANDBOX_PRODUCT_ID, sku: 'SGBC-REV-C-SANDBOX', name: 'Test SGBC', price: 550000, currency: 'TWD', status: 'active', stock: 200, createdAt: Date.now(), updatedAt: Date.now() });
  await db.insert(settings).values({ id: SANDBOX_SETTINGS_ID, checkoutOpen: true, reservationsOpen: false, shippingFeePerUnit: 8000, updatedAt: Date.now() });
  process.env.PUBLIC_ECPAY_SANDBOX = 'true'; process.env.VERCEL_ENV = 'production'; process.env.PAYMENT_PROVIDER = 'stripe';
  try {
    assert.equal(ecpayConfigured(), true);
    assert.equal(paymentProvider(), 'ecpay'); assert.equal(ecpayEnvironment(), 'stage');
    assert.deepEqual(ecpayConfig(), publicEcpaySandbox);
    const data = await (await catalog(new Request('http://127.0.0.1:3000/api/store/catalog/'), ctx('catalog'))).json();
    assert.equal(data.checkoutOpen, false); assert.equal(data.mode, 'wishlist'); assert.equal(data.sandbox, true); assert.equal(data.shippingFeePerUnit, 8000);
    assert.deepEqual(data.products.map((p: { id: string }) => p.id), [SANDBOX_PRODUCT_ID]);
    await assert.rejects(reserveEcpayCheckout(db, payload(), publicEcpaySandbox));
    await assert.rejects(reserveEcpayCheckout(db, { ...payload(), productId: SANDBOX_PRODUCT_ID }, config));
    await assert.rejects(updateSettings(db, 'test', { checkoutOpen: true, reservationsOpen: false, shippingFeePerUnit: 8000 }, true));
    const order = await reserveEcpayCheckout(db, { ...payload(2), productId: SANDBOX_PRODUCT_ID }, ecpayConfig());
    assert.equal(order.total, 1116000); assert.equal(order.paymentEnvironment, 'stage');
    assert.equal(ecpayCheckout(order, ecpayConfig()).url, 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
    const fields = payment(order, {}, publicEcpaySandbox);
    globalThis.fetch = async url => {
      assert.equal(String(url), 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');
      return new Response(new URLSearchParams(signed({ ...fields, TradeStatus: '1' }, publicEcpaySandbox)).toString());
    };
    assert.equal(await (await notify(formRequest(fields))).text(), '1|OK');
    assert.equal(await (await notify(formRequest(fields))).text(), '1|OK');
    const after = await dashboardData(db);
    assert.deepEqual(after.revenue, before.revenue); assert.equal(after.orderCount, before.orderCount);
    assert.deepEqual(after.settings, before.settings); assert.deepEqual(after.products, before.products);
    assert.deepEqual((await db.select().from(products).where(eq(products.id, productId)))[0], liveProduct);
    const [testProduct] = await db.select().from(products).where(eq(products.id, SANDBOX_PRODUCT_ID));
    assert.equal(testProduct.stock, 198); assert.equal(testProduct.reserved, 0);
    await assert.rejects(fulfillOrder(db, 'test', { id: order.id, trackingNumber: 'NO-SHIP' }));
    await assert.rejects(createReservation(db, 'test', { productId: SANDBOX_PRODUCT_ID, name: 'Test buyer', email: 'buyer@example.test', quantity: 1, notes: '' }));
    await assert.rejects(reserveCheckout(db, { productId: SANDBOX_PRODUCT_ID, name: 'Test buyer', email: 'buyer@example.test', quantity: 1, requestKey: crypto.randomUUID(), policyAccepted: true, policyVersion: SALES_POLICY_VERSION, locale: 'en' }), /Test checkout must use the ECPay sandbox/);
    delete process.env.PUBLIC_ECPAY_SANDBOX;
    const liveCatalog = await (await catalog(new Request('http://127.0.0.1:3000/api/store/catalog/'), ctx('catalog'))).json();
    assert.equal(liveCatalog.products.some((p: { id: string }) => p.id === SANDBOX_PRODUCT_ID), false);
    await assert.rejects(reserveEcpayCheckout(db, { ...payload(), productId: SANDBOX_PRODUCT_ID }, publicEcpaySandbox));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
