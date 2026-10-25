import { getDb } from '@/lib/server/db';
import { appOrigin } from '@/lib/server/config';
import { authorizedOrder, confirmationUrl, privateOrderHeaders } from '@/lib/server/order-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Return bodies and success flags are untrusted. Only server verification changes payment state.
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  let url = `${appOrigin()}/checkout/result/?locale=${params.get('locale') === 'en' ? 'en' : 'zh-TW'}`;
  try {
    const order = await authorizedOrder(getDb(), { order: params.get('order'), token: params.get('token') });
    url = confirmationUrl(order);
  } catch { /* Missing or invalid access links never reveal order details. */ }
  return new Response(null, { status: 303, headers: { ...privateOrderHeaders, Location: url } });
}
export const GET = POST;
