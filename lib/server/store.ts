import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { StoreDatabase } from './db';
import { auditEvents, inventoryEvents, orders, preorders, products, settings, webhookEvents } from './schema';
import { checkoutInput, fulfillInput, inventoryInput, preorderUpdate, productInput, reservationInput, settingsInput, StoreError } from './validation';

type Tx = Parameters<Parameters<StoreDatabase['transaction']>[0]>[0];
function audit(tx: Tx, actor: string, action: string, entityId: string, detail: string) {
  return tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor, action, entityId, detail, createdAt: Date.now() });
}
export async function storeSettings(db: StoreDatabase) {
  const [row] = await db.select().from(settings).where(eq(settings.id, 'store'));
  return row ?? { id: 'store', reservationsOpen: false, checkoutOpen: false, updatedAt: 0 };
}
export async function saveProduct(db: StoreDatabase, actor: string, raw: unknown) {
  const { id, version, ...data } = productInput.parse(raw);
  if (data.status === 'active' && data.price === 0) throw new StoreError(400, 'Set a price before activating this product.');
  return db.transaction(async tx => {
    const duplicate = await tx.select({ id: products.id }).from(products).where(eq(products.sku, data.sku));
    if (duplicate.some(row => row.id !== id)) throw new StoreError(409, 'This SKU is already in use.');
    const now = Date.now();
    if (id) {
      if (!version) throw new StoreError(400, 'A product version is required.');
      const [row] = await tx.update(products).set({ ...data, version: sql`${products.version} + 1`, updatedAt: now }).where(and(eq(products.id, id), eq(products.version, version))).returning();
      if (!row) throw new StoreError(409, 'This product changed. Refresh before editing it again.');
      await audit(tx, actor, 'product.updated', id, data.name); return row;
    }
    const [row] = await tx.insert(products).values({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }).returning();
    await audit(tx, actor, 'product.created', row.id, data.name); return row;
  });
}
export async function adjustInventory(db: StoreDatabase, actor: string, raw: unknown) {
  const data = inventoryInput.parse(raw);
  return db.transaction(async tx => {
    const [row] = await tx.update(products).set({ stock: sql`${products.stock} + ${data.delta}`, updatedAt: Date.now(), version: sql`${products.version} + 1` })
      .where(and(eq(products.id, data.productId), sql`${products.stock} + ${data.delta} >= ${products.reserved}`)).returning();
    if (!row) throw new StoreError(409, 'Stock cannot fall below zero or units held for checkout.');
    await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), ...data, actor, createdAt: Date.now() });
    await audit(tx, actor, 'inventory.adjusted', data.productId, `${data.delta > 0 ? '+' : ''}${data.delta} units · ${data.reason}`); return row;
  });
}
export async function createReservation(db: StoreDatabase, actor: string, raw: unknown, publicRequest = false) {
  const data = reservationInput.parse(raw);
  return db.transaction(async tx => {
    const [product] = await tx.select().from(products).where(eq(products.id, data.productId));
    const [config] = await tx.select().from(settings).where(eq(settings.id, 'store'));
    if (!product || product.status === 'archived' || (publicRequest && (product.status !== 'active' || !config?.reservationsOpen))) throw new StoreError(409, 'Reservations are not open for this product.');
    const existing = await tx.select({ id: preorders.id }).from(preorders).where(and(eq(preorders.productId, data.productId), eq(preorders.email, data.email), inArray(preorders.status, ['new', 'contacted'])));
    // Public responses do not reveal whether an email address is already registered.
    if (existing.length) { if (publicRequest) return; throw new StoreError(409, 'An open reservation already exists for this email and product.'); }
    const id = crypto.randomUUID(), now = Date.now();
    await tx.insert(preorders).values({ ...data, id, createdAt: now, updatedAt: now });
    await audit(tx, actor, 'preorder.created', id, `${data.quantity} × ${product.name}`);
    return id;
  });
}
export async function updateReservation(db: StoreDatabase, actor: string, raw: unknown) {
  const { id, ...data } = preorderUpdate.parse(raw);
  return db.transaction(async tx => {
    const [row] = await tx.update(preorders).set({ ...data, updatedAt: Date.now() }).where(eq(preorders.id, id)).returning();
    if (!row) throw new StoreError(404, 'Reservation not found.');
    await audit(tx, actor, 'preorder.updated', id, data.status); return row;
  });
}
export async function updateSettings(db: StoreDatabase, actor: string, raw: unknown, stripeReady: boolean) {
  const data = settingsInput.parse(raw);
  if (data.checkoutOpen && !stripeReady) throw new StoreError(409, 'Configure Stripe and its webhook before enabling checkout.');
  return db.transaction(async tx => {
    const values = { id: 'store', ...data, updatedAt: Date.now() };
    await tx.insert(settings).values(values).onConflictDoUpdate({ target: settings.id, set: values });
    await audit(tx, actor, 'store.updated', 'store', `Reservations ${data.reservationsOpen ? 'open' : 'closed'} · Checkout ${data.checkoutOpen ? 'open' : 'closed'}`); return values;
  });
}
export async function reserveCheckout(db: StoreDatabase, raw: unknown) {
  const data = checkoutInput.parse(raw);
  return db.transaction(async tx => {
    const [existing] = await tx.select().from(orders).where(eq(orders.requestKey, data.requestKey));
    if (existing) {
      if (existing.productId !== data.productId || existing.email !== data.email || existing.name !== data.name || existing.quantity !== data.quantity || existing.status !== 'pending') throw new StoreError(409, 'Use a new checkout request.');
      return existing;
    }
    const [config] = await tx.select().from(settings).where(eq(settings.id, 'store'));
    if (!config?.checkoutOpen) throw new StoreError(409, 'Checkout is not open yet.');
    const [product] = await tx.update(products).set({ reserved: sql`${products.reserved} + ${data.quantity}`, updatedAt: Date.now() })
      .where(and(eq(products.id, data.productId), eq(products.status, 'active'), sql`${products.price} > 0`, sql`${products.stock} - ${products.reserved} >= ${data.quantity}`)).returning();
    if (!product) throw new StoreError(409, 'This quantity is no longer available.');
    const now = Date.now();
    const [order] = await tx.insert(orders).values({ ...data, id: crypto.randomUUID(), productName: product.name, sku: product.sku, unitPrice: product.price, total: product.price * data.quantity, currency: product.currency, createdAt: now, updatedAt: now }).returning();
    await audit(tx, 'checkout', 'order.created', order.id, `${data.quantity} × ${product.name}`); return order;
  });
}
export type PaymentUpdate = { eventId: string; eventType: string; orderId: string; sessionId: string; status: 'paid' | 'cancelled'; amount: number; currency: string; paymentIntentId?: string; shippingAddress?: string };
export async function applyPayment(db: StoreDatabase, data: PaymentUpdate) {
  return db.transaction(async tx => {
    const [seen] = await tx.select().from(webhookEvents).where(eq(webhookEvents.id, data.eventId)); if (seen) return;
    const [order] = await tx.select().from(orders).where(eq(orders.id, data.orderId));
    if (!order || (order.stripeSessionId && order.stripeSessionId !== data.sessionId)) throw new StoreError(409, 'Payment does not match an order.');
    if (data.status === 'paid' && (order.total !== data.amount || order.currency.toLowerCase() !== data.currency.toLowerCase())) throw new StoreError(409, 'Payment amount does not match.');
    if (order.status === 'pending') {
      await tx.update(products).set({ reserved: sql`${products.reserved} - ${order.quantity}`, ...(data.status === 'paid' ? { stock: sql`${products.stock} - ${order.quantity}` } : {}), updatedAt: Date.now(), version: sql`${products.version} + 1` }).where(eq(products.id, order.productId));
      await tx.update(orders).set({ status: data.status, stripeSessionId: data.sessionId, paymentIntentId: data.paymentIntentId, shippingAddress: data.shippingAddress, updatedAt: Date.now() }).where(eq(orders.id, order.id));
      if (data.status === 'paid') await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: order.productId, delta: -order.quantity, reason: `Paid order ${order.id}`, actor: 'stripe', createdAt: Date.now() });
      await audit(tx, 'stripe', `order.${data.status}`, order.id, `${order.quantity} × ${order.productName}`);
    } else if (data.status === 'paid' && order.status === 'cancelled') throw new StoreError(409, 'Payment needs manual reconciliation.');
    await tx.insert(webhookEvents).values({ id: data.eventId, type: data.eventType, createdAt: Date.now() });
  });
}
export async function applyRefund(db: StoreDatabase, eventId: string, paymentIntentId: string, amount: number) {
  return db.transaction(async tx => {
    const [seen] = await tx.select().from(webhookEvents).where(eq(webhookEvents.id, eventId)); if (seen) return;
    const [order] = await tx.select().from(orders).where(eq(orders.paymentIntentId, paymentIntentId));
    if (!order) throw new StoreError(409, 'The original payment has not been recorded yet.');
    if (amount > order.total || amount < 0) throw new StoreError(409, 'Refund amount does not match.');
    if (amount > order.refundedAmount) {
      await tx.update(orders).set({ refundedAmount: amount, status: amount === order.total ? 'refunded' : 'partially_refunded', updatedAt: Date.now() }).where(eq(orders.id, order.id));
      await audit(tx, 'stripe', 'order.refunded', order.id, `${amount} minor units refunded; stock is adjusted separately after a return.`);
    }
    await tx.insert(webhookEvents).values({ id: eventId, type: 'charge.refunded', createdAt: Date.now() });
  });
}
export async function fulfillOrder(db: StoreDatabase, actor: string, raw: unknown) {
  const data = fulfillInput.parse(raw);
  return db.transaction(async tx => {
    const [row] = await tx.update(orders).set({ status: 'fulfilled', trackingNumber: data.trackingNumber, updatedAt: Date.now() }).where(and(eq(orders.id, data.id), eq(orders.status, 'paid'))).returning();
    if (!row) throw new StoreError(409, 'Only a paid, unfulfilled order can be fulfilled.');
    await audit(tx, actor, 'order.fulfilled', data.id, data.trackingNumber); return row;
  });
}
export async function dashboardData(db: StoreDatabase) {
  const [catalog, config, recentOrders, recentActivity, revenue, orderCount, reservationCount] = await Promise.all([
    db.select().from(products).orderBy(desc(products.createdAt)).limit(500), storeSettings(db),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8), db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(8),
    db.select({ currency: orders.currency, amount: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedAmount}), 0)` }).from(orders).where(inArray(orders.status, ['paid', 'fulfilled', 'partially_refunded', 'refunded'])).groupBy(orders.currency),
    db.$count(orders, inArray(orders.status, ['paid', 'fulfilled', 'partially_refunded', 'refunded'])), db.$count(preorders, inArray(preorders.status, ['new', 'contacted'])),
  ]);
  return { products: catalog, settings: config, recentOrders, recentActivity, revenue, orderCount, reservationCount };
}
export async function listRecords(db: StoreDatabase, resource: string, query: string, page: number) {
  const offset = (page - 1) * 25, q = `%${query}%`;
  if (resource === 'preorders') { const filter = or(like(preorders.name, q), like(preorders.email, q), like(preorders.id, q)); return { rows: await db.select().from(preorders).where(filter).orderBy(desc(preorders.createdAt)).limit(25).offset(offset), total: await db.$count(preorders, filter) }; }
  if (resource === 'orders') { const filter = or(like(orders.name, q), like(orders.email, q), like(orders.id, q)); return { rows: await db.select().from(orders).where(filter).orderBy(desc(orders.createdAt)).limit(25).offset(offset), total: await db.$count(orders, filter) }; }
  if (resource === 'activity') { const filter = or(like(auditEvents.action, q), like(auditEvents.actor, q), like(auditEvents.detail, q)); return { rows: await db.select().from(auditEvents).where(filter).orderBy(desc(auditEvents.createdAt)).limit(25).offset(offset), total: await db.$count(auditEvents, filter) }; }
  throw new StoreError(404, 'Collection not found.');
}
