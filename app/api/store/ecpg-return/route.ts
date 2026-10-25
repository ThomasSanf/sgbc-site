import { embeddedResultUrl } from '@/lib/server/ecpg';
export const runtime = 'nodejs';
// Browser-controlled results never authorize payment or stock changes.
export async function POST(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'zh-TW';
  return new Response(null, { status: 303, headers: { Location: embeddedResultUrl(locale), 'Cache-Control': 'no-store' } });
}
