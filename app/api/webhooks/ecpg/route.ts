import { readBody } from '@/lib/server/http';
import { handleEcpgNotification } from '@/lib/server/ecpg';
import { ecpayConfig } from '@/lib/server/ecpay';
import { getDb } from '@/lib/server/db';
import { StoreError } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
  try {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new StoreError(415, 'Invalid content type.');
    await handleEcpgNotification(getDb(), JSON.parse(await readBody(request, 65_536)), ecpayConfig());
    return new Response('1|OK', { headers });
  } catch (error) {
    console.error('Embedded payment notification rejected:', error instanceof StoreError ? error.status : 'invalid');
    return new Response('0|Unable to verify payment', { status: error instanceof StoreError ? error.status : 400, headers });
  }
}
