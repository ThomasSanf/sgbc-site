import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(), image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const session = sqliteTable('session', {
  id: text('id').primaryKey(), expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(), createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(), ipAddress: text('ip_address'), userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [index('session_user_idx').on(table.userId)]);
export const account = sqliteTable('account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }), refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'), password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('account_user_idx').on(table.userId), uniqueIndex('account_provider_idx').on(table.providerId, table.accountId)]);
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('verification_identifier_idx').on(table.identifier)]);
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(), key: text('key').notNull().unique(), count: integer('count').notNull(), lastRequest: integer('last_request', { mode: 'number' }).notNull(),
});
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), sku: text('sku').notNull().unique(), name: text('name').notNull(),
  description: text('description').notNull().default(''), price: integer('price').notNull().default(0), currency: text('currency').notNull().default('TWD'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
  stock: integer('stock').notNull().default(0), reserved: integer('reserved').notNull().default(0), lowStock: integer('low_stock').notNull().default(5),
  version: integer('version').notNull().default(1), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [check('product_stock_valid', sql`${t.stock} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.stock}`), check('product_price_valid', sql`${t.price} >= 0`)]);
export const preorders = sqliteTable('preorders', {
  id: text('id').primaryKey(), productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(), email: text('email').notNull(), quantity: integer('quantity').notNull(),
  status: text('status', { enum: ['new', 'contacted', 'cancelled'] }).notNull().default('new'),
  notes: text('notes').notNull().default(''), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('preorder_created_idx').on(t.createdAt), check('preorder_quantity_valid', sql`${t.quantity} > 0`)]);
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), requestKey: text('request_key').notNull().unique(),
  productId: text('product_id').notNull().references(() => products.id), productName: text('product_name').notNull(), sku: text('sku').notNull(),
  name: text('name').notNull(), email: text('email').notNull(), quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(), total: integer('total').notNull(), currency: text('currency').notNull(),
  shippingFee: integer('shipping_fee').notNull().default(0),
  paymentProvider: text('payment_provider', { enum: ['stripe', 'ecpay'] }).notNull().default('stripe'),
  paymentEnvironment: text('payment_environment', { enum: ['stage', 'live'] }).notNull().default('live'),
  ecpayMerchantId: text('ecpay_merchant_id'), ecpayMerchantTradeNo: text('ecpay_merchant_trade_no').unique(),
  ecpayTradeNo: text('ecpay_trade_no').unique(), ecpayPaymentCode: text('ecpay_payment_code'),
  ecpayIntegration: text('ecpay_integration', { enum: ['aio', 'embedded'] }).notNull().default('aio'),
  locale: text('locale').notNull().default('en'),
  status: text('status', { enum: ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded'] }).notNull().default('pending'),
  stripeSessionId: text('stripe_session_id').unique(), paymentIntentId: text('payment_intent_id').unique(), refundedAmount: integer('refunded_amount').notNull().default(0),
  trackingNumber: text('tracking_number').notNull().default(''), shippingAddress: text('shipping_address'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('order_created_idx').on(t.createdAt), check('order_total_valid', sql`${t.quantity} > 0 AND ${t.shippingFee} >= 0 AND ${t.total} = ${t.unitPrice} * ${t.quantity} + ${t.shippingFee}`)]);
export const inventoryEvents = sqliteTable('inventory_events', {
  id: text('id').primaryKey(), productId: text('product_id').notNull().references(() => products.id),
  delta: integer('delta').notNull(), reason: text('reason').notNull(), actor: text('actor').notNull(), createdAt: integer('created_at').notNull(),
});
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(), actor: text('actor').notNull(), action: text('action').notNull(), entityId: text('entity_id').notNull(), detail: text('detail').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('audit_created_idx').on(t.createdAt)]);
export const webhookEvents = sqliteTable('webhook_events', { id: text('id').primaryKey(), type: text('type').notNull(), createdAt: integer('created_at').notNull() });
// Provider tokens only. Card numbers, security codes and cardholder data never enter this table.
export const embeddedCheckouts = sqliteTable('embedded_checkouts', {
  orderId: text('order_id').primaryKey().references(() => orders.id),
  token: text('token'), expiresAt: integer('expires_at').notNull(),
  paymentStartedAt: integer('payment_started_at'), redirectUrl: text('redirect_url'),
  createdAt: integer('created_at').notNull(),
});
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(), reservationsOpen: integer('reservations_open', { mode: 'boolean' }).notNull().default(false),
  checkoutOpen: integer('checkout_open', { mode: 'boolean' }).notNull().default(false), updatedAt: integer('updated_at').notNull(),
  shippingFeePerUnit: integer('shipping_fee_per_unit'),
});
