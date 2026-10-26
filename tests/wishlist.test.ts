import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from '../lib/server/db';
import { auditEvents, orders, products, wishlist } from '../lib/server/schema';
import { joinWishlist } from '../lib/server/wishlist';
import { dashboardData, listRecords } from '../lib/server/store';
import { wishlistInput } from '../lib/server/validation';
import { GET, POST } from '../app/api/store/[resource]/route';
import { GET as adminGet } from '../app/api/admin/[resource]/route';

const origin = 'https://www.sgbc.tw';
process.env.DATABASE_URL = ':memory:';
process.env.BETTER_AUTH_URL = origin;
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
const db = getDb(), context = (resource: string) => ({ params: Promise.resolve({ resource }) });
const request = (resource: string, body: unknown, overrides: Record<string, string> = {}) => new Request(`${origin}/api/store/${resource}/`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', ...overrides }, body: JSON.stringify(body),
});
before(async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
after(() => db.$client.close());

void test('wishlist validates email, locale, length and unexpected fields', () => {
  for (const value of [{ email: 'invalid', locale: 'en' }, { email: 'x@example.test', locale: 'fr' }, { email: 'a'.repeat(255) + '@example.test', locale: 'en' }, { email: 'x@example.test', locale: 'en', admin: true }]) assert.equal(wishlistInput.safeParse(value).success, false);
});
void test('joining normalizes and deduplicates emails without altering orders or stock', async () => {
  const initialOrders = await db.select().from(orders), initialProducts = await db.select().from(products);
  const first = await joinWishlist(db, { email: '  Person@Example.test  ', locale: 'zh-TW' });
  const second = await joinWishlist(db, { email: 'person@example.test', locale: 'en' });
  assert.deepEqual(first, second);
  const entries = await db.select().from(wishlist);
  assert.equal(entries.length, 1); assert.equal(entries[0].email, 'person@example.test'); assert.equal(entries[0].locale, 'zh-TW');
  assert.equal(entries[0].consentVersion, '2026-10-26');
  assert.equal((await db.select().from(auditEvents)).filter(row => row.action === 'wishlist.joined').length, 1);
  assert.deepEqual(await db.select().from(orders), initialOrders); assert.deepEqual(await db.select().from(products), initialProducts);
});
void test('dashboard counts and searchable paginated list use persisted signups', async () => {
  for (let i = 0; i < 27; i++) await joinWishlist(db, { email: `reader${i}@example.test`, locale: 'en' });
  assert.equal((await dashboardData(db)).wishlistCount, 28);
  const first = await listRecords(db, 'wishlist', '', 1), second = await listRecords(db, 'wishlist', '', 2);
  assert.equal(first.rows.length, 25); assert.equal(second.rows.length, 3); assert.equal(first.total, 28);
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 28);
  assert.equal((await listRecords(db, 'wishlist', 'person@', 1)).total, 1);
});
void test('public signup works on the new origin and does not reveal duplicates', async () => {
  for (let i = 0; i < 2; i++) {
    const response = await POST(request('wishlist', { email: 'api@example.test', locale: 'en' }), context('wishlist'));
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  }
  assert.equal((await POST(request('wishlist', { email: 'bad', locale: 'en' }), context('wishlist'))).status, 400);
});
void test('wishlist blocks foreign origins, old domain writes and public email-list access', async () => {
  const payload = { email: 'private@example.test', locale: 'en' };
  for (const invalidOrigin of ['https://attacker.test', 'https://sgbc-site.vercel.app', '']) assert.equal((await POST(request('wishlist', payload, { origin: invalidOrigin }), context('wishlist'))).status, 403);
  assert.equal((await GET(new Request(`${origin}/api/store/wishlist/`), context('wishlist'))).status, 404);
  assert.equal((await adminGet(new Request(`${origin}/api/admin/wishlist/`), context('wishlist'))).status, 401);
});
void test('signup requests are rate limited', async () => {
  const body = { email: 'rate@example.test', locale: 'en' };
  for (let i = 0; i < 8; i++) assert.equal((await POST(request('wishlist', body, { 'x-real-ip': 'rate-test' }), context('wishlist'))).status, 202);
  assert.equal((await POST(request('wishlist', body, { 'x-real-ip': 'rate-test' }), context('wishlist'))).status, 429);
});
void test('wishlist mode closes paid and unpaid ordering even with public sandbox enabled', async () => {
  process.env.PUBLIC_ECPAY_SANDBOX = 'true';
  try {
    const catalog = await GET(new Request(`${origin}/api/store/catalog/`), context('catalog'));
    const data = await catalog.json(); assert.equal(data.mode, 'wishlist'); assert.equal(data.checkoutOpen, false); assert.equal(data.reservationsOpen, false);
    for (const resource of ['checkout', 'preorders']) assert.equal((await POST(request(resource, {}), context(resource))).status, 409);
  } finally { delete process.env.PUBLIC_ECPAY_SANDBOX; }
});
