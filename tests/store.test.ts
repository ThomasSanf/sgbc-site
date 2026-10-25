import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import { connectDatabase } from '../lib/server/db';
import { products, orders, auditEvents, inventoryEvents } from '../lib/server/schema';
import { adjustInventory, applyPayment, applyRefund, createReservation, dashboardData, fulfillOrder, reserveCheckout, saveProduct, updateSettings } from '../lib/server/store';
import { SALES_POLICY_VERSION } from '../lib/sales-policy-version';
const consent = { policyAccepted: true, policyVersion: SALES_POLICY_VERSION, locale: 'en' };
import { isApprovedAdmin } from '../lib/server/config';
import { productInput, StoreError } from '../lib/server/validation';

process.env.PAYMENT_PROVIDER = 'stripe';
const db = connectDatabase(':memory:');
const actor = 'test-admin@example.test';
const productData = { name: 'Test hardware', sku: 'TEST-1', description: '', price: 12500, currency: 'TWD', status: 'active', lowStock: 2 };
let productId: string;
before(async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
after(() => { db.$client.close(); });
test('allowlist requires an exact, verified email; suffix/domain matches are rejected', () => {
  process.env.ADMIN_EMAILS = 'Admin@example.test';
  assert.equal(isApprovedAdmin('admin@example.test', true), true);
  assert.equal(isApprovedAdmin('admin@example.test', false), false);
  assert.equal(isApprovedAdmin('admin@example.test.evil.test', true), false);
  assert.equal(isApprovedAdmin('anyone@example.test', true), false);
  process.env.ADMIN_EMAILS = '';
  assert.equal(isApprovedAdmin('admin@example.test', true), false);
});
test('rejects mass assignment and invalid money values', () => {
  assert.equal(productInput.safeParse({ ...productData, stock: 999, reserved: -1 }).success, false);
  assert.equal(productInput.safeParse({ ...productData, price: -10 }).success, false);
  assert.equal(productInput.safeParse({ ...productData, price: 1.5 }).success, false);
});
test('product edits use optimistic locking and inventory cannot be overwritten', async () => {
  const created = await saveProduct(db, actor, productData); productId = created.id;
  assert.equal(created.stock, 0);
  await saveProduct(db, actor, { ...productData, id: productId, version: created.version, name: 'Updated hardware' });
  await assert.rejects(saveProduct(db, actor, { ...productData, id: productId, version: created.version }), (error: unknown) => error instanceof StoreError && error.status === 409);
  await adjustInventory(db, actor, { productId, delta: 4, reason: 'First test batch' });
  await assert.rejects(adjustInventory(db, actor, { productId, delta: -5, reason: 'Invalid removal' }));
  assert.equal((await db.select().from(products).where(eq(products.id, productId)))[0].stock, 4);
});
test('reservations are gated, deduplicated, and do not reserve stock', async () => {
  const payload = { productId, name: 'Test buyer', email: 'buyer@example.test', quantity: 2 };
  await assert.rejects(createReservation(db, 'storefront', payload, true));
  await updateSettings(db, actor, { reservationsOpen: true, checkoutOpen: false }, false);
  await createReservation(db, 'storefront', payload, true);
  await createReservation(db, 'storefront', payload, true);
  const data = await dashboardData(db);
  assert.equal(data.reservationCount, 1);
  assert.equal(data.products[0].reserved, 0);
});
test('checkout cannot open without configured payment integration', async () => {
  await assert.rejects(updateSettings(db, actor, { reservationsOpen: true, checkoutOpen: true }, false));
});
let firstOrderId: string;
test('checkout holds stock atomically and repeated requests do not double-reserve', async () => {
  await updateSettings(db, actor, { reservationsOpen: true, checkoutOpen: true }, true);
  const payload = { ...consent, productId, name: 'Test buyer', email: 'buyer@example.test', quantity: 3, requestKey: crypto.randomUUID() };
  await assert.rejects(reserveCheckout(db, { ...payload, policyAccepted: false }));
  const first = await reserveCheckout(db, payload); firstOrderId = first.id;
  const repeated = await reserveCheckout(db, payload);
  assert.equal(repeated.id, first.id);
  assert.equal(first.total, 37500);
  await assert.rejects(reserveCheckout(db, { ...payload, quantity: 2, requestKey: crypto.randomUUID() }));
  await assert.rejects(adjustInventory(db, actor, { productId, delta: -2, reason: 'Held units cannot be removed' }));
  assert.equal((await db.select().from(products).where(eq(products.id, productId)))[0].reserved, 3);
});
test('a mismatched payment cannot consume stock or mark an order paid', async () => {
  await assert.rejects(applyPayment(db, { eventId: 'invalid-payment', eventType: 'checkout.session.completed', orderId: firstOrderId, sessionId: 'cs_test_first', status: 'paid', amount: 1, currency: 'twd' }));
  assert.equal((await db.select().from(orders).where(eq(orders.id, firstOrderId)))[0].status, 'pending');
});
test('duplicate paid events and reconciliation decrement inventory exactly once', async () => {
  const payment = { eventId: 'paid-1', eventType: 'checkout.session.completed', orderId: firstOrderId, sessionId: 'cs_test_first', status: 'paid' as const, amount: 37500, currency: 'twd', paymentIntentId: 'pi_test_first' };
  await applyPayment(db, payment);
  await applyPayment(db, payment);
  await applyPayment(db, { ...payment, eventId: 'paid-reconcile' });
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  assert.equal(product.stock, 1); assert.equal(product.reserved, 0);
  const ledger = await db.select().from(inventoryEvents);
  assert.equal(ledger.filter(row => row.actor === 'stripe').length, 1);
  assert.equal((await dashboardData(db)).revenue[0].amount, 37500);
});
test('fulfillment needs paid status and a tracking number', async () => {
  await assert.rejects(fulfillOrder(db, actor, { id: firstOrderId, trackingNumber: '' }));
  await fulfillOrder(db, actor, { id: firstOrderId, trackingNumber: 'TEST-TRACKING' });
  await assert.rejects(fulfillOrder(db, actor, { id: firstOrderId, trackingNumber: 'SECOND-SHIPMENT' }));
});
test('expired checkout releases its hold once without reducing physical stock', async () => {
  const order = await reserveCheckout(db, { ...consent, productId, name: 'Other buyer', email: 'other@example.test', quantity: 1, requestKey: crypto.randomUUID() });
  await assert.rejects(fulfillOrder(db, actor, { id: order.id, trackingNumber: 'UNPAID-ORDER' }));
  const expired = { eventId: 'expired-1', eventType: 'checkout.session.expired', orderId: order.id, sessionId: 'cs_test_expired', status: 'cancelled' as const, amount: 0, currency: 'twd' };
  await applyPayment(db, expired); await applyPayment(db, expired);
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  assert.equal(product.stock, 1); assert.equal(product.reserved, 0);
});
test('refunds are monotonic, update net sales, and never restock unreturned items', async () => {
  await applyRefund(db, 'refund-1', 'pi_test_first', 10000);
  await applyRefund(db, 'refund-1', 'pi_test_first', 10000);
  await applyRefund(db, 'refund-older', 'pi_test_first', 5000);
  assert.equal((await dashboardData(db)).revenue[0].amount, 27500);
  await applyRefund(db, 'refund-full', 'pi_test_first', 37500);
  const data = await dashboardData(db);
  assert.equal(data.revenue[0].amount, 0); assert.equal(data.products[0].stock, 1);
  assert.equal((await db.select().from(orders).where(eq(orders.id, firstOrderId)))[0].status, 'refunded');
  assert.ok((await db.select().from(auditEvents)).length >= 10);
});
