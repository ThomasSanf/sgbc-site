import { getDb } from '@/lib/server/db';
import { getAdmin } from '@/lib/server/auth';
import { apiError, limitPublicRequest, readBody, verifyOrigin } from '@/lib/server/http';
import { excludedVisit, recordVisit, visitCountry, visitInput } from '@/lib/server/visitor-analytics';
import { StoreError } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const empty = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    if (process.env.VERCEL_ENV === 'preview' || excludedVisit(request)) return empty();
    if (!request.headers.get('content-type')?.includes('application/json')) throw new StoreError(415, 'Send a JSON request.');
    let body: unknown;
    try { body = JSON.parse(await readBody(request, 512)); }
    catch (error) { if (error instanceof StoreError) throw error; throw new StoreError(400, 'Invalid JSON.'); }
    const data = visitInput.parse(body);
    if (await getAdmin(request.headers)) return empty();
    await limitPublicRequest(request, 'visitor-analytics', 120);
    await recordVisit(getDb(), data.visitorId, Date.now(), visitCountry(request));
    return empty();
  } catch (error) { return apiError(error); }
}
