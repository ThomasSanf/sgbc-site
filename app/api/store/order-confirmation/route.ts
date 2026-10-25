import { getDb } from '@/lib/server/db';
import { apiError, input, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { authorizedOrder, orderAccessInput, privateOrderHeaders } from '@/lib/server/order-access';
import { publicOrderConfirmation } from '@/lib/server/order-confirmation';
import { reconcileOrder } from '@/lib/server/payments';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const order = await authorizedOrder(getDb(), { order: params.get('order'), token: params.get('token') });
    return Response.json(publicOrderConfirmation(order), { headers: privateOrderHeaders });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const access = await input(request, orderAccessInput);
    const order = await authorizedOrder(getDb(), access);
    await limitPublicRequest(request, 'order-confirmation', 6);
    if (order.status === 'pending') await reconcileOrder(order.id);
    return Response.json(publicOrderConfirmation(await authorizedOrder(getDb(), access)), { headers: privateOrderHeaders });
  } catch (error) { return apiError(error); }
}
