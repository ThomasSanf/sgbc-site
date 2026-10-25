import 'server-only';
import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { ZodError, type ZodType } from 'zod';
import { appOrigin } from './config';
import { getAdmin } from './auth';
import { getDb } from './db';
import { StoreError } from './validation';

export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export function verifyOrigin(request: Request) {
  if (request.headers.get('origin') !== appOrigin() || request.headers.get('sec-fetch-site') === 'cross-site') throw new StoreError(403, 'This request was not sent from the store.');
}
export async function requireAdmin(request: Request) {
  const admin = await getAdmin(request.headers);
  if (!admin) throw new StoreError(401, 'Please sign in with an approved admin account.');
  if (!['GET', 'HEAD'].includes(request.method)) verifyOrigin(request);
  return admin;
}
export async function readBody(request: Request, maxBytes = 16_384) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new StoreError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError(400, 'A request body is required.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new StoreError(413, 'Request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
export async function input<T>(request: Request, schema: ZodType<T>) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new StoreError(415, 'Send a JSON request.');
  const body = await readBody(request);
  let value: unknown; try { value = JSON.parse(body); } catch { throw new StoreError(400, 'Invalid JSON.'); }
  return schema.parse(value);
}
export function apiError(error: unknown) {
  if (error instanceof StoreError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: 'Please check the form fields.', fields: error.flatten().fieldErrors }, 400);
  // Do not echo SQL, customer details, payment keys, or provider errors to the browser.
  console.error('Store request failed:', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'The request could not be completed. Please try again.' }, 500);
}
export async function limitPublicRequest(request: Request, scope: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new StoreError(503, 'The store is not configured yet.');
  // Vercel overwrites x-real-ip. On another host, configure a trusted proxy to do so.
  const ip = request.headers.get('x-real-ip') ?? 'local';
  const bucket = Math.floor(Date.now() / 60_000);
  const key = createHmac('sha256', secret).update(`${scope}:${ip}`).digest('hex');
  const result = await getDb().run(sql`INSERT INTO rate_limit (id, key, count, last_request) VALUES (${key}, ${key}, 1, ${bucket})
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN last_request = ${bucket} THEN count + 1 ELSE 1 END, last_request = ${bucket}
    RETURNING count`);
  if (Number(result.rows[0]?.count) > 8) throw new StoreError(429, 'Too many requests. Please wait a minute and try again.');
}
