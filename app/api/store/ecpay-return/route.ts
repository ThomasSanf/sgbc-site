import { appOrigin } from '@/lib/server/config';
import { ecpayConfig, parseEcpayForm } from '@/lib/server/ecpay';
import { findEcpayOrder } from '@/lib/server/ecpay-store';
import { getDb } from '@/lib/server/db';
import { readBody } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let locale = 'zh-TW', result = 'unverified';
  try {
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Error('Invalid format');
    const fields = parseEcpayForm(await readBody(request, 65_536));
    const order = await findEcpayOrder(getDb(), fields, ecpayConfig());
    locale = order.locale;
    result = fields.RtnCode === '1' ? 'received' : 'returned';
  } catch { /* Browser redirects never change payment or inventory state. */ }
  return new Response(null, { status: 303, headers: { Location: `${appOrigin()}/checkout/result/?result=${result}&locale=${locale}`, 'Cache-Control': 'no-store' } });
}
