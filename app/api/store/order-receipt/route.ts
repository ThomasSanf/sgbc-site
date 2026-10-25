import { getDb } from '@/lib/server/db';
import { apiError, limitPublicRequest } from '@/lib/server/http';
import { authorizedOrder, privateOrderHeaders } from '@/lib/server/order-access';
import { publicOrderConfirmation } from '@/lib/server/order-confirmation';
import { createOrderPdf } from '@/lib/server/order-pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const order = publicOrderConfirmation(await authorizedOrder(getDb(), { order:params.get('order'), token:params.get('token') }));
    await limitPublicRequest(request, 'order-pdf', 20);
    const locale = params.get('locale') === 'zh-TW' ? 'zh-TW' : params.get('locale') === 'en' ? 'en' : order.locale;
    const bytes = await createOrderPdf(order, locale);
    return new Response(new Uint8Array(bytes), { headers: { ...privateOrderHeaders, 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="SGBC-${order.id}.pdf"` } });
  } catch (error) { return apiError(error); }
}
