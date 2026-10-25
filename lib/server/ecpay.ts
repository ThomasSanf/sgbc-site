import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ecpayConfigured, ecpayEnvironment, appOrigin } from './config';
import { StoreError } from './validation';
import type { orders } from './schema';

export type EcpayConfig = { merchantId: string; hashKey: string; hashIV: string; environment: 'stage' | 'live' };
export type EcpayFields = Record<string, string>;
export function ecpayConfig(): EcpayConfig {
  if (!ecpayConfigured()) throw new StoreError(503, 'ECPay is not configured for this environment.');
  return { merchantId: process.env.ECPAY_MERCHANT_ID!, hashKey: process.env.ECPAY_HASH_KEY!, hashIV: process.env.ECPAY_HASH_IV!, environment: ecpayEnvironment() };
}
export function ecpayBase(config: EcpayConfig) {
  return config.environment === 'live' ? 'https://payment.ecpay.com.tw' : 'https://payment-stage.ecpay.com.tw';
}
// AIO uses the legacy .NET URL-encoding rules, not the encoding used by ECPay's other APIs.
export function checkMacValue(fields: EcpayFields, config: Pick<EcpayConfig, 'hashKey' | 'hashIV'>) {
  const keys = Object.keys(fields).filter(key => key !== 'CheckMacValue').sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
  const raw = `HashKey=${config.hashKey}&${keys.map(key => `${key}=${fields[key]}`).join('&')}&HashIV=${config.hashIV}`;
  const encoded = encodeURIComponent(raw).replace(/%20/g, '+').replace(/~/g, '%7e').replace(/'/g, '%27').toLowerCase();
  return createHash('sha256').update(encoded).digest('hex').toUpperCase();
}
export function verifyEcpayFields(fields: EcpayFields, config: EcpayConfig) {
  const supplied = fields.CheckMacValue;
  if (!supplied || !/^[A-Fa-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied.toUpperCase()), Buffer.from(checkMacValue(fields, config))) || fields.MerchantID !== config.merchantId) {
    throw new StoreError(400, 'Invalid payment notification.');
  }
}
export function parseEcpayForm(body: string): EcpayFields {
  const fields: EcpayFields = Object.create(null), names = new Set<string>();
  for (const [key, value] of new URLSearchParams(body)) {
    const lower = key.toLowerCase();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || names.has(lower) || names.size >= 100 || value.length > 8000) throw new StoreError(400, 'Invalid payment notification.');
    names.add(lower); fields[key] = value;
  }
  return fields;
}
export function taipeiTradeDate(timestamp: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp).map(p => [p.type, p.value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
export function ecpayCheckout(order: typeof orders.$inferSelect, config: EcpayConfig): { provider: 'ecpay'; orderId: string; url: string; fields: EcpayFields } {
  const origin = appOrigin();
  if (order.paymentProvider !== 'ecpay' || order.ecpayMerchantId !== config.merchantId || order.paymentEnvironment !== config.environment || !order.ecpayMerchantTradeNo || order.currency !== 'TWD' || order.total % 100 !== 0) throw new StoreError(409, 'Checkout configuration changed. Contact the store.');
  const fields: EcpayFields = {
    MerchantID: config.merchantId, MerchantTradeNo: order.ecpayMerchantTradeNo,
    MerchantTradeDate: taipeiTradeDate(order.createdAt), PaymentType: 'aio', TotalAmount: String(order.total / 100),
    TradeDesc: 'SGBC console preorder', ItemName: `SGBC Rev C x ${order.quantity}#Taiwan delivery ${order.shippingFee / 100} TWD`,
    ReturnURL: `${origin}/api/webhooks/ecpay/`, OrderResultURL: `${origin}/api/store/ecpay-return/`,
    ClientBackURL: `${origin}/checkout/result/?result=returned&locale=${order.locale}`,
    ChoosePayment: 'Credit', IgnorePayment: 'ApplePay#DigitalPayment', EncryptType: '1', UnionPay: '2', BindingCard: '0',
    CustomField1: order.id, CustomField2: order.locale, NeedExtraPaidInfo: 'N',
    ...(order.locale === 'en' ? { Language: 'ENG' } : {}),
  };
  return { provider: 'ecpay' as const, orderId: order.id, url: `${ecpayBase(config)}/Cashier/AioCheckOut/V5`, fields: { ...fields, CheckMacValue: checkMacValue(fields, config) } };
}
export async function queryEcpay(merchantTradeNo: string, config: EcpayConfig): Promise<EcpayFields> {
  const fields: EcpayFields = { MerchantID: config.merchantId, MerchantTradeNo: merchantTradeNo, TimeStamp: String(Math.floor(Date.now() / 1000)) };
  let response: Response;
  try {
    response = await fetch(`${ecpayBase(config)}/Cashier/QueryTradeInfo/V5`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...fields, CheckMacValue: checkMacValue(fields, config) }), signal: AbortSignal.timeout(30_000), cache: 'no-store', redirect: 'error' });
  } catch { throw new StoreError(502, 'ECPay could not be reached. The order remains held; please retry.'); }
  if (!response.ok) throw new StoreError(502, 'ECPay could not confirm this payment yet.');
  // Bound the body before parsing, including when the provider omits Content-Length.
  const { readBody } = await import('./http');
  const result = parseEcpayForm(await readBody(response, 65_536));
  verifyEcpayFields(result, config);
  if (result.MerchantTradeNo !== merchantTradeNo) throw new StoreError(502, 'ECPay returned a different order.');
  return result;
}
