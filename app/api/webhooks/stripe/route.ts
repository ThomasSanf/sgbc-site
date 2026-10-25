import { apiError, json, readBody } from '@/lib/server/http';
import { handleStripeEvent, stripeClient } from '@/lib/server/payments';
import { StoreError } from '@/lib/server/validation';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const stripe = stripeClient(), signature = request.headers.get('stripe-signature');
    if (!signature) throw new StoreError(400, 'Missing signature.');
    const body = await readBody(request, 262_144);
    let event;
    try { event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!); }
    catch { throw new StoreError(400, 'Invalid signature.'); }
    await handleStripeEvent(event);
    return json({ received: true });
  } catch (error) { return apiError(error); }
}
