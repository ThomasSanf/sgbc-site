import 'server-only';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { appOrigin } from './config';
import type { StoreDatabase } from './db';
import { auditEvents, embeddedCheckouts, orders, products } from './schema';
import { StoreError } from './validation';
import { taipeiTradeDate, type EcpayConfig, type EcpayFields } from './ecpay';
import { applyVerifiedEcpayResult, matchVerifiedEcpayOrder, reserveEcpayCheckout } from './ecpay-store';
import { publicSandboxMode } from './sandbox';
import { readBody } from './http';
import type { EmbeddedCheckout } from '../storefront-types';

// Live Embedded Checkout must be activated by ECPay before enabling this setting.
export function embeddedEcpayEnabled() { return publicSandboxMode() || process.env.ECPAY_CHECKOUT === 'embedded'; }

export function encryptEcpg(data: unknown, config: EcpayConfig) {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(config.hashKey), Buffer.from(config.hashIV));
  const encoded = encodeURIComponent(JSON.stringify(data));
  return Buffer.concat([cipher.update(encoded, 'utf8'), cipher.final()]).toString('base64');
}
export function decryptEcpg(data: string, config: EcpayConfig): Record<string, unknown> {
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 65_536 || data.length % 4 !== 0) throw new Error();
    const decipher = createDecipheriv('aes-128-cbc', Buffer.from(config.hashKey), Buffer.from(config.hashIV));
    const encoded = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    return z.record(z.string(), z.unknown()).parse(JSON.parse(decodeURIComponent(encoded.replace(/\+/g, ' '))));
  } catch { throw new StoreError(400, 'Invalid encrypted payment response.'); }
}
export function decodeEcpgEnvelope(raw: unknown, config: EcpayConfig) {
  const envelope = z.object({ MerchantID: z.string(), TransCode: z.literal(1), Data: z.string() }).safeParse(raw);
  if (!envelope.success || envelope.data.MerchantID !== config.merchantId) throw new StoreError(400, 'Invalid payment response.');
  const data = decryptEcpg(envelope.data.Data, config);
  if (data.MerchantID !== config.merchantId) throw new StoreError(400, 'Invalid payment merchant.');
  return data;
}
type Endpoint = 'GetTokenbyTrade' | 'CreatePayment' | 'QueryTrade';
export async function callEcpg(endpoint: Endpoint, data: Record<string, unknown>, config: EcpayConfig) {
  const stage = config.environment === 'stage' ? '-stage' : '';
  const url = endpoint === 'QueryTrade' ? `https://ecpayment${stage}.ecpay.com.tw/1.0.0/Cashier/QueryTrade` : `https://ecpg${stage}.ecpay.com.tw/Merchant/${endpoint}`;
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ MerchantID: config.merchantId, RqHeader: { Timestamp: Math.floor(Date.now() / 1000) }, Data: encryptEcpg({ MerchantID: config.merchantId, ...data }, config) }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) throw new Error();
    return decodeEcpgEnvelope(JSON.parse(await readBody(response, 65_536)), config);
  } catch { throw new StoreError(502, 'The payment service could not respond. Your order remains held; please retry this checkout.'); }
}
export function ecpgResultFields(data: Record<string, unknown>): EcpayFields {
  const result = z.object({
    MerchantID: z.string(), RtnCode: z.number().int(), SimulatePaid: z.union([z.literal(0), z.literal(1)]).optional(), CustomField: z.string().optional(),
    OrderInfo: z.object({ MerchantTradeNo: z.string().regex(/^[A-Za-z0-9]{1,20}$/), TradeNo: z.string(), TradeAmt: z.number().int().positive(), PaymentType: z.string(), TradeStatus: z.enum(['0', '1']) }),
  }).parse(data);
  return { MerchantID: result.MerchantID, ...result.OrderInfo, TradeAmt: String(result.OrderInfo.TradeAmt), RtnCode: String(result.RtnCode), SimulatePaid: String(result.SimulatePaid ?? 0), ...(result.CustomField ? { CustomField1: result.CustomField } : {}) };
}
export async function queryEcpg(tradeNo: string, config: EcpayConfig) {
  const data = await callEcpg('QueryTrade', { MerchantTradeNo: tradeNo }, config);
  if (data.RtnCode !== 1) throw new StoreError(502, 'Payment is still being confirmed.');
  const fields = ecpgResultFields(data);
  if (fields.MerchantTradeNo !== tradeNo) throw new StoreError(502, 'Payment reference mismatch.');
  return fields;
}
export function embeddedResultUrl(locale: string) { return `${appOrigin()}/checkout/result/?result=returned&locale=${locale === 'en' ? 'en' : 'zh-TW'}`; }
export function verificationUrl(value: unknown) {
  const url = new URL(z.string().max(2000).parse(value));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.endsWith('.ecpay.com.tw')) throw new StoreError(502, 'Invalid bank verification destination.');
  return url.href;
}
export async function createEmbeddedCheckout(db: StoreDatabase, raw: unknown, config: EcpayConfig): Promise<EmbeddedCheckout> {
  const order = await reserveEcpayCheckout(db, raw, config, 'embedded');
  const now = Date.now();
  const [created] = await db.insert(embeddedCheckouts).values({ orderId: order.id, expiresAt: now + 25 * 60_000, createdAt: now }).onConflictDoNothing().returning();
  if (created) {
    try {
      const shipping = JSON.parse(order.shippingAddress!);
      const data = await callEcpg('GetTokenbyTrade', {
        RememberCard: 0, PaymentUIType: 2, ChoosePaymentList: '1',
        OrderInfo: { MerchantTradeNo: order.ecpayMerchantTradeNo, MerchantTradeDate: taipeiTradeDate(order.createdAt), TotalAmount: order.total / 100, ReturnURL: `${appOrigin()}/api/webhooks/ecpg/`, TradeDesc: 'SGBC console preorder', ItemName: `SGBC Rev C x ${order.quantity}#Delivery ${order.shippingFee / 100} TWD` },
        CardInfo: { OrderResultURL: `${appOrigin()}/api/store/ecpg-return/?locale=${order.locale}`, Redeem: '0' },
        ConsumerInfo: { Phone: shipping.phone.replace(/\D/g, ''), ...(order.email.length <= 100 ? { Email: order.email } : {}), CountryCode: '158' }, CustomField: order.id,
      }, config);
      if (data.RtnCode !== 1 || typeof data.Token !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(data.Token)) throw new StoreError(502, 'The secure payment form could not be prepared. Please retry.');
      await db.update(embeddedCheckouts).set({ token: data.Token }).where(eq(embeddedCheckouts.orderId, order.id));
    } catch (error) {
      // No PayToken has been accepted. Retrying uses the same merchant trade number and hold.
      await db.delete(embeddedCheckouts).where(and(eq(embeddedCheckouts.orderId, order.id), isNull(embeddedCheckouts.token), isNull(embeddedCheckouts.paymentStartedAt)));
      throw error;
    }
  }
  const [session] = await db.select().from(embeddedCheckouts).where(eq(embeddedCheckouts.orderId, order.id));
  if (!session?.token) throw new StoreError(503, 'The payment form is being prepared. Please retry shortly.');
  if (session.expiresAt <= Date.now()) throw new StoreError(409, 'This payment session expired. Please contact the store before starting another order.');
  return { provider: 'ecpay-embedded', orderId: order.id, merchantTradeNo: order.ecpayMerchantTradeNo!, token: session.token, environment: config.environment, expiresAt: session.expiresAt,
    summary: { name: order.name, email: order.email, quantity: order.quantity, address: JSON.parse(order.shippingAddress!), subtotal: order.unitPrice * order.quantity, shippingFee: order.shippingFee, total: order.total } };
}
export const embeddedPaymentInput = z.object({ orderId: z.uuid(), requestKey: z.uuid(), payToken: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/) }).strict();
export const embeddedCancelInput = embeddedPaymentInput.omit({ payToken: true });
export async function cancelEmbeddedCheckout(db: StoreDatabase, raw: unknown) {
  const input = embeddedCancelInput.parse(raw);
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.requestKey, input.requestKey)));
    if (!order || order.ecpayIntegration !== 'embedded') throw new StoreError(404, 'Checkout not found.');
    if (order.status === 'cancelled') return { ok: true };
    if (order.status !== 'pending') throw new StoreError(409, 'This payment cannot be edited.');
    const [cancelled] = await tx.update(embeddedCheckouts).set({ paymentStartedAt: -1, token: null }).where(and(eq(embeddedCheckouts.orderId, order.id), isNull(embeddedCheckouts.paymentStartedAt))).returning();
    if (!cancelled) throw new StoreError(409, 'Payment is already being processed.');
    await tx.update(orders).set({ status: 'cancelled', updatedAt: Date.now() }).where(eq(orders.id, order.id));
    await tx.update(products).set({ reserved: sql`${products.reserved} - ${order.quantity}`, updatedAt: Date.now() }).where(eq(products.id, order.productId));
    await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'checkout', action: 'checkout.edit_details', entityId: order.id, detail: 'Embedded checkout cancelled before payment submission; hold released.', createdAt: Date.now() });
    return { ok: true };
  });
}
export async function completeEmbeddedPayment(db: StoreDatabase, raw: unknown, config: EcpayConfig) {
  const input = embeddedPaymentInput.parse(raw);
  // The unpredictable request key is the buyer's checkout capability; order ID alone is never sufficient.
  const [order] = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.requestKey, input.requestKey)));
  if (!order || order.ecpayIntegration !== 'embedded' || order.paymentProvider !== 'ecpay' || order.paymentEnvironment !== config.environment || order.ecpayMerchantId !== config.merchantId || !order.ecpayMerchantTradeNo) throw new StoreError(404, 'Checkout not found.');
  if (order.status !== 'pending') return { url: embeddedResultUrl(order.locale) };
  const [session] = await db.select().from(embeddedCheckouts).where(eq(embeddedCheckouts.orderId, order.id));
  if (!session?.token) throw new StoreError(409, 'The payment form is not ready.');
  if (session.paymentStartedAt) return { url: session.redirectUrl ?? embeddedResultUrl(order.locale) };
  if (session.expiresAt <= Date.now()) throw new StoreError(409, 'The payment session expired. Please contact the store.');
  const [claimed] = await db.update(embeddedCheckouts).set({ paymentStartedAt: Date.now() }).where(and(eq(embeddedCheckouts.orderId, order.id), isNull(embeddedCheckouts.paymentStartedAt))).returning();
  if (!claimed) return { url: embeddedResultUrl(order.locale) };
  // Never automatically retry CreatePayment after an ambiguous timeout or accept another PayToken.
  // The original trade is reconciled by webhook/query; this also makes double clicks harmless.
  const data = await callEcpg('CreatePayment', { MerchantTradeNo: order.ecpayMerchantTradeNo, PayToken: input.payToken }, config);
  const info = z.object({ MerchantTradeNo: z.literal(order.ecpayMerchantTradeNo) }).safeParse(data.OrderInfo);
  if (!info.success) throw new StoreError(502, 'Payment reference mismatch.');
  let url = embeddedResultUrl(order.locale);
  if (data.RtnCode === 1 && data.ThreeDInfo) {
    const threeD = z.object({ ThreeDURL: z.string() }).parse(data.ThreeDInfo);
    url = verificationUrl(threeD.ThreeDURL);
  }
  await db.update(embeddedCheckouts).set({ redirectUrl: url }).where(eq(embeddedCheckouts.orderId, order.id));
  // Only the verified notification/query path changes stock or marks the order paid.
  return { url };
}
export async function handleEcpgNotification(db: StoreDatabase, raw: unknown, config: EcpayConfig) {
  const fields = ecpgResultFields(decodeEcpgEnvelope(raw, config));
  await matchVerifiedEcpayOrder(db, fields, config, 'embedded');
  if (fields.RtnCode === '1' && fields.SimulatePaid === '0') {
    const current = await queryEcpg(fields.MerchantTradeNo, config);
    if (current.TradeStatus !== '1' || current.TradeNo !== fields.TradeNo) throw new StoreError(503, 'Payment is still being confirmed.');
    await applyVerifiedEcpayResult(db, current, config, 'query', 'embedded');
  } else await applyVerifiedEcpayResult(db, fields, config, 'notify', 'embedded');
}
