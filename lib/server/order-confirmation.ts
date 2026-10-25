import 'server-only';
import type { orders } from './schema';
import type { OrderConfirmation } from '../order-confirmation';

export function publicOrderConfirmation(order: typeof orders.$inferSelect): OrderConfirmation {
  let shipping: OrderConfirmation['shipping'] = null;
  try {
    const raw = JSON.parse(order.shippingAddress ?? 'null');
    const address = raw?.address && typeof raw.address === 'object' ? raw.address : null;
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    if (raw) shipping = address ? { phone: text(raw.phone), postalCode: text(address.postal_code), city: text(address.city), district: text(address.state), address: [text(address.line1), text(address.line2)].filter(Boolean).join(' '), country: text(address.country) }
      : { phone: text(raw.phone), postalCode: text(raw.postalCode), city: text(raw.city), district: text(raw.district), address: text(raw.address), country: text(raw.country) };
  } catch { /* Legacy records can have no delivery details. */ }
  return {
    id: order.id, reference: order.ecpayMerchantTradeNo ?? order.id, productName: order.productName, sku: order.sku,
    quantity: order.quantity, unitPrice: order.unitPrice, subtotal: order.unitPrice * order.quantity, shippingFee: order.shippingFee, total: order.total, currency: order.currency,
    name: order.name, email: order.email, createdAt: order.createdAt, updatedAt: order.updatedAt, locale: order.locale === 'zh-TW' ? 'zh-TW' : 'en',
    status: order.status, sandbox: order.paymentEnvironment === 'stage', provider: order.paymentProvider,
    paymentReference: order.ecpayTradeNo, refundedAmount: order.refundedAmount, trackingNumber: order.trackingNumber, shipping,
  };
}
