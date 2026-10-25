import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHmac, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import Stripe from 'stripe';
import { getDb } from '../lib/server/db';
import { getAuth } from '../lib/server/auth';
import { session, user } from '../lib/server/schema';
import { GET, POST } from '../app/api/admin/[resource]/route';
import { POST as authPost } from '../app/api/auth/[...all]/route';
import { POST as publicPost } from '../app/api/store/[resource]/route';
import { POST as webhookPost } from '../app/api/webhooks/stripe/route';

const origin = 'http://127.0.0.1:3000';
// Disposable test identities and keys. No test bypass exists in the application.
process.env.PAYMENT_PROVIDER = 'stripe';
process.env.DATABASE_URL = ':memory:';
process.env.BETTER_AUTH_URL = origin;
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-only-client-secret';
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
process.env.STRIPE_WEBHOOK_SECRET = randomBytes(32).toString('hex');
const db = getDb();
let cookie = '', adminId = '', sessionId = '';
const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });
const req = (path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) => new Request(`${origin}${path}`, { method, headers: { 'x-real-ip': '127.0.0.1', ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
before(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  const context = await getAuth()!.$context;
  adminId = crypto.randomUUID();
  await db.insert(user).values({ id: adminId, name: 'Test owner', email: 'owner@example.test', emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  const created = await context.internalAdapter.createSession(adminId); assert.ok(created); sessionId = created.id;
  const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(created.token).digest('base64');
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${created.token}.${signature}`)}`;
});
after(() => { db.$client.close(); });
test('private reads and writes reject missing and forged sessions', async () => {
  for (const value of ['', 'better-auth.session_token=forged']) {
    assert.equal((await GET(req('/api/admin/dashboard/', 'GET', undefined, { cookie: value }), ctx('dashboard'))).status, 401);
    assert.equal((await POST(req('/api/admin/products/', 'POST', {}, { cookie: value, origin }), ctx('products'))).status, 401);
  }
});
test('authenticated admin can read data, and responses are never cached', async () => {
  const response = await GET(req('/api/admin/dashboard/'), ctx('dashboard'));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal((await response.json()).orderCount, 0);
});
test('CSRF protection rejects foreign or absent origins even with a valid session', async () => {
  assert.equal((await POST(req('/api/admin/products/', 'POST', {}), ctx('products'))).status, 403);
  assert.equal((await POST(req('/api/admin/products/', 'POST', {}, { origin: 'https://attacker.example' }), ctx('products'))).status, 403);
  assert.equal((await publicPost(req('/api/store/preorders/', 'POST', {}, { origin: 'https://attacker.example' }), ctx('preorders'))).status, 403);
});
test('approved mutations are validated before writing', async () => {
  assert.equal((await POST(req('/api/admin/products/', 'POST', { name: 'Invalid', stock: 999 }, { origin }), ctx('products'))).status, 400);
});
test('non-admin or unverified Google users cannot be provisioned', async () => {
  const beforeCreate = getAuth()!.options.databaseHooks!.user!.create!.before!;
  const fixture = { id: crypto.randomUUID(), name: 'Test', createdAt: new Date(), updatedAt: new Date(), image: null };
  await assert.rejects(async () => beforeCreate({ ...fixture, email: 'other@example.test', emailVerified: true }, null));
  await assert.rejects(async () => beforeCreate({ ...fixture, email: 'owner@example.test', emailVerified: false }, null));
});
test('allowlist removal immediately blocks existing sessions', async () => {
  process.env.ADMIN_EMAILS = 'different@example.test';
  assert.equal((await GET(req('/api/admin/dashboard/'), ctx('dashboard'))).status, 401);
  await assert.rejects((await getAuth()!.$context).internalAdapter.createSession(adminId));
  process.env.ADMIN_EMAILS = 'owner@example.test';
});
test('expired or unverified sessions cannot read admin data', async () => {
  await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.id, sessionId));
  assert.equal((await GET(req('/api/admin/dashboard/'), ctx('dashboard'))).status, 401);
  const context = await getAuth()!.$context;
  const fresh = await context.internalAdapter.createSession(adminId); assert.ok(fresh);
  const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(fresh.token).digest('base64');
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${fresh.token}.${signature}`)}`;
  await db.update(user).set({ emailVerified: false }).where(eq(user.id, adminId));
  assert.equal((await GET(req('/api/admin/dashboard/'), ctx('dashboard'))).status, 401);
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, adminId));
});
test('public registration, password login and account linking routes are unavailable', async () => {
  for (const path of ['sign-up/email', 'sign-in/email', 'link-social', 'change-email']) {
    const response = await authPost(req(`/api/auth/${path}/`, 'POST', {}, { origin }), { params: Promise.resolve({ all: path.split('/') }) });
    assert.equal(response.status, 404);
  }
});
test('Google authorization starts with protected state cookies and fixed callback', async () => {
  const response = await authPost(req('/api/auth/sign-in/social/', 'POST', { provider: 'google', callbackURL: '/admin/', disableRedirect: true }, { origin }), { params: Promise.resolve({ all: ['sign-in', 'social'] }) });
  assert.equal(response.status, 200);
  const result = await response.json(), url = new URL(result.url);
  assert.equal(url.hostname, 'accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback/google`);
  assert.ok(url.searchParams.get('state'));
  const cookies = response.headers.getSetCookie().join(';');
  assert.match(cookies, /HttpOnly/i); assert.match(cookies, /SameSite=Lax/i);
});
test('Stripe webhooks reject missing or invalid signatures', async () => {
  assert.equal((await webhookPost(req('/api/webhooks/stripe/', 'POST', {}))).status, 400);
  assert.equal((await webhookPost(req('/api/webhooks/stripe/', 'POST', {}, { 'stripe-signature': 'forged' }))).status, 400);
});
test('a correctly signed unrelated Stripe event is acknowledged without changing orders', async () => {
  const stripe = new Stripe('sk_test_fixture');
  const payload = JSON.stringify({ id: 'evt_test_unrelated', object: 'event', type: 'customer.created', data: { object: {} } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const response = await webhookPost(new Request(`${origin}/api/webhooks/stripe/`, { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
  assert.equal(response.status, 200);
});
test('sign-out invalidates the database-backed session', async () => {
  const response = await authPost(req('/api/auth/sign-out/', 'POST', {}, { origin }), { params: Promise.resolve({ all: ['sign-out'] }) });
  assert.equal(response.status, 200);
  assert.equal((await GET(req('/api/admin/dashboard/'), ctx('dashboard'))).status, 401);
});
