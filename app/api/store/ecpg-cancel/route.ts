import { apiError, input, json, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { cancelEmbeddedCheckout, embeddedCancelInput } from '@/lib/server/ecpg';
import { getDb } from '@/lib/server/db';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await limitPublicRequest(request, 'ecpg-cancel');
    return json(await cancelEmbeddedCheckout(getDb(), await input(request, embeddedCancelInput)));
  } catch (error) { return apiError(error); }
}
