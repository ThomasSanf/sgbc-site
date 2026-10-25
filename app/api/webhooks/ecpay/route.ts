import { readBody } from '@/lib/server/http';
import { parseEcpayForm } from '@/lib/server/ecpay';
import { handleEcpayNotification } from '@/lib/server/payments';
import { StoreError } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
  try {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) throw new StoreError(415, 'Invalid content type.');
    await handleEcpayNotification(parseEcpayForm(await readBody(request, 65_536)));
    return new Response('1|OK', { headers });
  } catch (error) {
    // Non-acknowledgement permits provider retries after transient query/database failures.
    console.error('ECPay notification rejected:', error instanceof StoreError ? error.status : 'internal');
    return new Response('0|Unable to verify payment', { status: error instanceof StoreError ? error.status : 500, headers });
  }
}
