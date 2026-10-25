import 'server-only';
import Stripe from 'stripe';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { appOrigin, stripeConfigured, paymentProvider } from './config';
import { orders } from './schema';
import { applyPayment, applyRefund, reserveCheckout } from './store';
import { StoreError } from './validation';
import { ecpayConfig, ecpayCheckout, queryEcpay, type EcpayFields } from './ecpay';
import { reserveEcpayCheckout, applyEcpayResult, applyVerifiedEcpayResult, findEcpayOrder } from './ecpay-store';
import { createEmbeddedCheckout, embeddedEcpayEnabled, queryEcpg } from './ecpg';

export function stripeClient() {
  if (!stripeConfigured()) throw new StoreError(503, 'Stripe is not configured yet.');
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2, timeout: 20_000 });
}
export async function createCheckout(raw: unknown) {
  if (paymentProvider() === 'ecpay') {
    const config = ecpayConfig();
    if (embeddedEcpayEnabled()) return createEmbeddedCheckout(getDb(), raw, config);
    return ecpayCheckout(await reserveEcpayCheckout(getDb(), raw, config), config);
  }
  const stripe = stripeClient(), db = getDb();
  const order = await reserveCheckout(db, raw);
  const origin = appOrigin();
  let session: Stripe.Checkout.Session;
  if (order.stripeSessionId) session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  else {
    // Preserve this hold on a network error: Stripe may have created a payable session.
    // Retry with the same order id; never issue a second session for the same hold.
    if (Date.now() - order.createdAt > 23 * 60 * 60 * 1000) throw new StoreError(409, 'This checkout needs admin reconciliation.');
    session = await stripe.checkout.sessions.create({
      mode: 'payment', allowed_payment_method_types: ['card'], customer_email: order.email,
      client_reference_id: order.id, metadata: { sgbc_order_id: order.id },
      payment_intent_data: { metadata: { sgbc_order_id: order.id } },
      line_items: [{ quantity: order.quantity, price_data: { currency: order.currency.toLowerCase(), unit_amount: order.unitPrice, product_data: { name: order.productName } } }],
      shipping_address_collection: { allowed_countries: ['TW'] },
      success_url: `${origin}/checkout/result/?result=complete`, cancel_url: `${origin}/checkout/result/?result=cancelled`,
      // Keep all create parameters stable when replaying an idempotency key.
      expires_at: Math.floor(order.createdAt / 1000) + 60 * 60,
    }, { idempotencyKey: `sgbc-checkout-${order.id}` });
    await db.update(orders).set({ stripeSessionId: session.id, updatedAt: Date.now() }).where(and(eq(orders.id, order.id), isNull(orders.stripeSessionId)));
  }
  if (!session.url || session.status !== 'open') throw new StoreError(409, 'This checkout is no longer open.');
  return { provider: 'stripe' as const, url: session.url, orderId: order.id };
}
async function syncSession(session: Stripe.Checkout.Session, eventId: string, eventType: string) {
  const orderId = session.metadata?.sgbc_order_id;
  if (!orderId) return; // Ignore other applications using this Stripe account.
  if (session.status === 'expired' || session.payment_status === 'paid') {
    await applyPayment(getDb(), {
      eventId, eventType, orderId, sessionId: session.id, status: session.payment_status === 'paid' ? 'paid' : 'cancelled',
      amount: session.amount_total ?? -1, currency: session.currency ?? '',
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      shippingAddress: session.collected_information?.shipping_details ? JSON.stringify(session.collected_information.shipping_details) : undefined,
    });
  }
}
export async function handleStripeEvent(event: Stripe.Event) {
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
    const eventSession = event.data.object as Stripe.Checkout.Session;
    // Query current payment state instead of trusting event delivery order.
    const session = await stripeClient().checkout.sessions.retrieve(eventSession.id);
    await syncSession(session, event.id, event.type);
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (intent && charge.metadata.sgbc_order_id) await applyRefund(getDb(), event.id, intent, charge.amount_refunded);
  }
}
export async function reconcileOrder(id: string) {
  const [order] = await getDb().select().from(orders).where(eq(orders.id, id));
  if (!order) throw new StoreError(404, 'Order not found.');
  if (order.paymentProvider === 'ecpay') {
    const config = ecpayConfig();
    if (order.ecpayMerchantId !== config.merchantId || order.paymentEnvironment !== config.environment || !order.ecpayMerchantTradeNo) throw new StoreError(409, 'Use this order’s ECPay merchant and environment to reconcile it.');
    const result = order.ecpayIntegration === 'embedded' ? await queryEcpg(order.ecpayMerchantTradeNo, config) : await queryEcpay(order.ecpayMerchantTradeNo, config);
    if (order.ecpayIntegration === 'embedded') await applyVerifiedEcpayResult(getDb(), result, config, 'query', 'embedded');
    else await applyEcpayResult(getDb(), result, config, 'query');
    return { status: result.TradeStatus, paymentStatus: result.TradeStatus === '1' ? 'paid' : 'pending', message: result.TradeStatus === '1' ? 'Payment confirmed by ECPay.' : 'ECPay has not confirmed payment. The stock hold remains in place.' };
  }
  if (!order.stripeSessionId) {
    throw new StoreError(409, 'No session id was saved. Retry the original checkout request within 23 hours, or locate the order id in Stripe before resolving the stock hold.');
  }
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  await syncSession(session, `reconcile-${session.id}-${session.status}-${session.payment_status}`, 'admin.reconcile');
  return { status: session.status, paymentStatus: session.payment_status };
}

export async function handleEcpayNotification(fields: EcpayFields) {
  const config = ecpayConfig(), db = getDb();
  await findEcpayOrder(db, fields, config);
  if (fields.RtnCode === '1' && fields.SimulatePaid === '0') {
    // Confirm against ECPay's current server-side record before accepting a successful notification.
    const current = await queryEcpay(fields.MerchantTradeNo, config);
    if (current.TradeStatus !== '1' || current.TradeNo !== fields.TradeNo) throw new StoreError(503, 'Payment is still being confirmed.');
    await applyEcpayResult(db, current, config, 'query');
  } else await applyEcpayResult(db, fields, config, 'notify');
}
