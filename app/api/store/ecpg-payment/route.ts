import { apiError, input, json, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { completeEmbeddedPayment, embeddedPaymentInput } from '@/lib/server/ecpg';
import { ecpayConfig } from '@/lib/server/ecpay';
import { getDb } from '@/lib/server/db';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await limitPublicRequest(request, 'ecpg-payment');
    return json(await completeEmbeddedPayment(getDb(), await input(request, embeddedPaymentInput), ecpayConfig()));
  } catch (error) { return apiError(error); }
}
