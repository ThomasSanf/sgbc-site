import { getAuth } from '@/lib/server/auth';
import { json } from '@/lib/server/http';
export const runtime = 'nodejs';
const allowed = new Set(['sign-in/social', 'callback/google', 'get-session', 'sign-out', 'error']);
async function handle(request: Request, context: { params: Promise<{ all: string[] }> }) {
  const path = (await context.params).all.join('/');
  if (!allowed.has(path)) return json({ error: 'Not found.' }, 404);
  const auth = getAuth();
  if (!auth) return json({ error: 'Admin sign-in is awaiting configuration.' }, 503);
  // The storefront uses trailing slashes; Better Auth endpoints use canonical paths.
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/+$/, '');
  const response = await auth.handler(new Request(url, request));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const GET = handle;
export const POST = handle;
