import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { StoreDatabase } from './db';
import { orders, products, settings, auditEvents, inventoryEvents, webhookEvents } from './schema';
import { paidPreorderInput, StoreError } from './validation';
import { verifyEcpayFields, type EcpayConfig, type EcpayFields } from './ecpay';
import { publicSandboxMode, SANDBOX_PRODUCT_ID, checkoutSettingsId } from './sandbox';
import { recordPolicyAcceptance, requirePolicyAcceptance } from './policy-consent';

function assertAllocation(productId: string, config: EcpayConfig) {
  if ((publicSandboxMode() && (config.environment !== 'stage' || productId !== SANDBOX_PRODUCT_ID)) || (productId === SANDBOX_PRODUCT_ID && config.environment !== 'stage')) throw new StoreError(409, 'Test checkout cannot use live inventory.');
}

export async function reserveEcpayCheckout(db: StoreDatabase, raw: unknown, config: EcpayConfig, integration: 'aio' | 'embedded' = 'aio') {
  const { shipping, acknowledged: _acknowledged, policyAccepted: _policyAccepted, policyVersion: _policyVersion, expectedTotal, ...data } = paidPreorderInput.parse(raw);
  assertAllocation(data.productId, config);
  if (!publicSandboxMode() && data.productId === SANDBOX_PRODUCT_ID) throw new StoreError(409, 'Public test checkout is closed.');
  const shippingAddress = JSON.stringify(shipping);
  return db.transaction(async tx => {
    const [availability] = await tx.select().from(settings).where(eq(settings.id, checkoutSettingsId()));
    if (!availability?.checkoutOpen || availability.shippingFeePerUnit === null) throw new StoreError(409, 'Checkout is not open yet.');
    const [existing] = await tx.select().from(orders).where(eq(orders.requestKey, data.requestKey));
    if (existing) {
      if (existing.ecpayIntegration !== integration) throw new StoreError(409, 'This checkout uses a different payment integration.');
      if (existing.paymentProvider !== 'ecpay' || existing.paymentEnvironment !== config.environment || existing.ecpayMerchantId !== config.merchantId || existing.productId !== data.productId || existing.name !== data.name || existing.email !== data.email || existing.quantity !== data.quantity || existing.shippingAddress !== shippingAddress || existing.total !== expectedTotal || existing.locale !== data.locale || existing.status !== 'pending') throw new StoreError(409, 'Use a new checkout request.');
      // Never mint another payable trade number to recover an ambiguous browser/network failure.
      await requirePolicyAcceptance(tx, existing.id, data.locale);
      return existing;
    }
    const [product] = await tx.select().from(products).where(eq(products.id, data.productId));
    if (!product || product.status !== 'active' || product.price <= 0 || product.currency !== 'TWD' || product.price % 100 !== 0) throw new StoreError(409, 'This product is not available for ECPay checkout.');
    const shippingFee = availability.shippingFeePerUnit * data.quantity, total = product.price * data.quantity + shippingFee;
    if (total !== expectedTotal) throw new StoreError(409, 'The price or shipping charge changed. Review your total again.');
    if (total > 19_999_900) throw new StoreError(409, 'This order exceeds the card checkout limit.');
    const [held] = await tx.update(products).set({ reserved: sql`${products.reserved} + ${data.quantity}`, updatedAt: Date.now() }).where(and(eq(products.id, product.id), sql`${products.stock} - ${products.reserved} >= ${data.quantity}`)).returning();
    if (!held) throw new StoreError(409, 'This quantity is no longer available.');
    const now = Date.now(), id = crypto.randomUUID();
    const [order] = await tx.insert(orders).values({ ...data, id, productName: product.name, sku: product.sku, unitPrice: product.price, total, shippingFee, currency: 'TWD', shippingAddress, paymentProvider: 'ecpay', paymentEnvironment: config.environment, ecpayMerchantId: config.merchantId, ecpayMerchantTradeNo: `S${randomBytes(9).toString('hex')}`, ecpayIntegration: integration, createdAt: now, updatedAt: now }).returning();
    await recordPolicyAcceptance(tx, id, data.locale);
    await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'checkout', action: 'order.created', entityId: id, detail: `${data.quantity} × ${product.name} · ECPay ${config.environment} · ${publicSandboxMode() ? 'test checkout acknowledged; no payment or shipment' : 'customer acknowledged preorder without shipping date'}`, createdAt: now });
    return order;
  });
}

export async function findEcpayOrder(db: StoreDatabase, fields: EcpayFields, config: EcpayConfig) {
  verifyEcpayFields(fields, config);
  return matchVerifiedEcpayOrder(db, fields, config, 'aio');
}

// Call only after verifying the provider envelope (AIO MAC or ECPG AES response).
export async function matchVerifiedEcpayOrder(db: StoreDatabase, fields: EcpayFields, config: EcpayConfig, integration: 'aio' | 'embedded') {
  const [order] = await db.select().from(orders).where(eq(orders.ecpayMerchantTradeNo, fields.MerchantTradeNo ?? ''));
  if (!order || order.ecpayIntegration !== integration || fields.MerchantID !== config.merchantId || order.paymentProvider !== 'ecpay' || order.paymentEnvironment !== config.environment || order.ecpayMerchantId !== config.merchantId || (fields.CustomField1 && fields.CustomField1 !== order.id) || !/^\d+$/.test(fields.TradeAmt ?? '') || Number(fields.TradeAmt) * 100 !== order.total || order.currency !== 'TWD') throw new StoreError(400, 'Payment does not match an order.');
  assertAllocation(order.productId, config);
  return order;
}

// The same transition handles signed notifications and authenticated server queries.
export async function applyEcpayResult(db: StoreDatabase, fields: EcpayFields, config: EcpayConfig, source: 'notify' | 'query') {
  verifyEcpayFields(fields, config);
  return applyVerifiedEcpayResult(db, fields, config, source, 'aio');
}

export async function applyVerifiedEcpayResult(db: StoreDatabase, fields: EcpayFields, config: EcpayConfig, source: 'notify' | 'query', integration: 'aio' | 'embedded') {
  const matched = await matchVerifiedEcpayOrder(db, fields, config, integration);
  const code = source === 'query' ? fields.TradeStatus : fields.RtnCode;
  if (!code || !/^\d+$/.test(code) || (source === 'notify' && !['0', '1'].includes(fields.SimulatePaid))) throw new StoreError(400, 'Invalid payment state.');
  const simulated = fields.SimulatePaid === '1';
  const paid = code === '1' && !simulated;
  if (paid && (!/^[A-Za-z0-9]{1,20}$/.test(fields.TradeNo ?? '') || !/^Credit(?:_|$)/.test(fields.PaymentType ?? ''))) throw new StoreError(400, 'Unexpected payment method or reference.');
  const eventId = `ecpay-${createHash('sha256').update(`${integration}:${config.environment}:${config.merchantId}:${fields.MerchantTradeNo}:${fields.TradeNo ?? ''}:${code}:${simulated}`).digest('hex')}`;
  return db.transaction(async tx => {
    const [seen] = await tx.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    if (seen) return;
    const [order] = await tx.select().from(orders).where(eq(orders.id, matched.id));
    if (order.ecpayTradeNo && fields.TradeNo && order.ecpayTradeNo !== fields.TradeNo) throw new StoreError(409, 'Payment reference changed.');
    if (paid && order.status === 'pending') {
      await tx.update(products).set({ reserved: sql`${products.reserved} - ${order.quantity}`, stock: sql`${products.stock} - ${order.quantity}`, version: sql`${products.version} + 1`, updatedAt: Date.now() }).where(eq(products.id, order.productId));
      await tx.update(orders).set({ status: 'paid', ecpayTradeNo: fields.TradeNo, ecpayPaymentCode: code, updatedAt: Date.now() }).where(eq(orders.id, order.id));
      await tx.insert(inventoryEvents).values({ id: crypto.randomUUID(), productId: order.productId, delta: -order.quantity, reason: `Paid ECPay ${config.environment} order ${order.id}`, actor: 'ecpay', createdAt: Date.now() });
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'ecpay', action: 'order.paid', entityId: order.id, detail: `${order.quantity} × ${order.productName} · ${config.environment}`, createdAt: Date.now() });
    } else if (paid && order.status === 'cancelled') {
      throw new StoreError(409, 'Late payment requires manual reconciliation.');
    } else if (!paid && order.status === 'pending') {
      // A failed attempt, browser return, or unpaid query does not prove the hosted order is unpayable.
      // Keep the hold until its outcome is reconciled, so a late payment cannot oversell the batch.
      await tx.update(orders).set({ ecpayPaymentCode: simulated ? 'simulation_ignored' : code, updatedAt: Date.now() }).where(eq(orders.id, order.id));
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'ecpay', action: simulated ? 'payment.simulation_ignored' : 'payment.pending', entityId: order.id, detail: `ECPay code ${code}; stock hold retained`, createdAt: Date.now() });
    }
    await tx.insert(webhookEvents).values({ id: eventId, type: `ecpay.${source}`, createdAt: Date.now() });
  });
}
