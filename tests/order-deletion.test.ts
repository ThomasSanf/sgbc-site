import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { connectDatabase } from '../lib/server/db';
import { auditEvents, embeddedCheckouts, inventoryEvents, orders, products, webhookEvents } from '../lib/server/schema';
import { deleteSandboxOrders } from '../lib/server/store';
import { applyEcpayResult } from '../lib/server/ecpay-store';
import { checkMacValue, type EcpayConfig } from '../lib/server/ecpay';

async function fixture(t: TestContext) {
  const db = connectDatabase(':memory:');
  t.after(() => db.$client.close());
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.$client.execute('PRAGMA foreign_keys = ON');
  const productId = crypto.randomUUID(), now = Date.now();
  await db.insert(products).values({ id: productId, sku: productId, name: 'Test console', stock: 198, reserved: 2, createdAt: now, updatedAt: now });
  const base = { productId, productName: 'Test console', sku: productId, name: 'Test buyer', email: 'test@example.test', quantity: 2, unitPrice: 550000, total: 1100000, currency: 'TWD', paymentProvider: 'ecpay' as const, paymentEnvironment: 'stage' as const, ecpayMerchantId: '3002607', createdAt: now, updatedAt: now };
  const [pending, paid, cancelled] = await db.insert(orders).values((['pending', 'paid', 'cancelled'] as const).map(status => ({ ...base, id: crypto.randomUUID(), requestKey: crypto.randomUUID(), ecpayMerchantTradeNo: `S${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`, status }))).returning();
  await db.insert(embeddedCheckouts).values({ orderId: pending.id, token: 'test-only-provider-token', expiresAt: now + 60000, createdAt: now });
  await db.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'checkout', action: 'order.created', entityId: pending.id, detail: 'Test fixture', createdAt: now });
  await db.insert(webhookEvents).values({ id: 'test-deduplication-record', type: 'ecpay.notify', createdAt: now });
  return { db, productId, pending, paid, cancelled };
}

void test('deleting sandbox orders releases holds, restores consumed stock and keeps audit history', async t => {
  const { db, productId, pending, paid, cancelled } = await fixture(t);
  const result = await deleteSandboxOrders(db, 'owner@example.test', { ids: [pending.id, paid.id, cancelled.id, paid.id] });
  assert.equal(result.deleted, 3);
  assert.equal(await db.$count(orders), 0);
  assert.equal(await db.$count(embeddedCheckouts), 0);
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  assert.equal(product.stock, 200);
  assert.equal(product.reserved, 0);
  assert.equal(await db.$count(auditEvents), 4);
  assert.equal(await db.$count(webhookEvents), 1);
  const events = await db.select().from(inventoryEvents);
  assert.equal(events.length, 1);
  assert.equal(events[0].delta, 2);
  assert.match(events[0].reason, new RegExp(paid.id));
  const repeated = await deleteSandboxOrders(db, 'owner@example.test', { ids: [pending.id, paid.id] });
  assert.equal(repeated.deleted, 0);
  assert.equal(await db.$count(auditEvents), 4);
  assert.equal((await db.select().from(products))[0].stock, 200);
});

void test('a mixed batch containing a real order is rejected atomically in every order status', async t => {
  const { db, productId, pending, paid } = await fixture(t);
  const [live] = await db.insert(orders).values({ ...paid, id: crypto.randomUUID(), requestKey: crypto.randomUUID(), ecpayMerchantTradeNo: null, paymentEnvironment: 'live' }).returning();
  for (const status of ['pending', 'paid', 'cancelled', 'fulfilled', 'refunded', 'partially_refunded'] as const) {
    await db.update(orders).set({ status }).where(eq(orders.id, live.id));
    await assert.rejects(deleteSandboxOrders(db, 'owner@example.test', { ids: [pending.id, live.id] }), /Only sandbox orders/);
    assert.equal(await db.$count(orders), 4);
    assert.equal(await db.$count(embeddedCheckouts), 1);
    assert.equal(await db.$count(auditEvents), 1);
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    assert.equal(product.stock, 198); assert.equal(product.reserved, 2);
  }
});

void test('invalid batches and client-supplied sandbox flags cannot authorize deletion', async t => {
  const { db, pending } = await fixture(t);
  for (const raw of [{}, { ids: [] }, { ids: ['not-an-id'] }, { ids: Array(101).fill(pending.id) }, { ids: [pending.id], paymentEnvironment: 'stage' }, { all: true }]) {
    await assert.rejects(deleteSandboxOrders(db, 'owner@example.test', raw));
  }
  assert.equal(await db.$count(orders), 3);
});

void test('an inconsistent stock hold rolls back the whole deletion and its audit entries', async t => {
  const { db, productId, pending, paid } = await fixture(t);
  await db.update(products).set({ reserved: 0 }).where(eq(products.id, productId));
  await assert.rejects(deleteSandboxOrders(db, 'owner@example.test', { ids: [paid.id, pending.id] }), /stock allocation is inconsistent/);
  assert.equal(await db.$count(orders), 3);
  assert.equal(await db.$count(embeddedCheckouts), 1);
  assert.equal(await db.$count(auditEvents), 1);
  assert.equal(await db.$count(inventoryEvents), 0);
  assert.equal((await db.select().from(products))[0].stock, 198);
});

void test('late sandbox payment notifications cannot recreate deleted orders or deduct stock', async t => {
  const { db, productId, pending } = await fixture(t);
  const config: EcpayConfig = { merchantId: '3002607', hashKey: 'local-test-key-16', hashIV: 'local-test-iv--16', environment: 'stage' };
  const fields = { MerchantID: config.merchantId, MerchantTradeNo: pending.ecpayMerchantTradeNo!, TradeNo: 'TestPayment123', TradeAmt: String(pending.total / 100), PaymentType: 'Credit_CreditCard', RtnCode: '1', SimulatePaid: '0', CustomField1: pending.id };
  await deleteSandboxOrders(db, 'owner@example.test', { ids: [pending.id] });
  await assert.rejects(applyEcpayResult(db, { ...fields, CheckMacValue: checkMacValue(fields, config) }, config, 'notify'), /does not match an order/);
  assert.equal(await db.$count(orders), 2);
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  assert.equal(product.stock, 198); assert.equal(product.reserved, 0);
});
