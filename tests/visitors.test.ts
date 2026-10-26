import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { connectDatabase, getDb } from '../lib/server/db';
import { visitorDays } from '../lib/server/schema';
import { normalizeCountry, recordVisit, visitCountry, visitorStats } from '../lib/server/visitor-analytics';
import { isPublicPage, taipeiDay } from '../lib/visitor-analytics';
import { POST } from '../app/api/store/visit/route';

process.env.DATABASE_URL = ':memory:';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3000';
process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.VERCEL_ENV;
const db = getDb(), DAY = 86_400_000;
before(async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
after(() => db.$client.close());

void test('unique visitors deduplicate repeat visits and multiple days within each period', async () => {
  const isolated = connectDatabase(':memory:');
  try {
    await migrate(isolated, { migrationsFolder: './drizzle' });
    const now = Date.parse('2026-10-26T04:00:00Z');
    const [a, b, c, d, e] = Array.from({ length: 5 }, () => crypto.randomUUID());
    await recordVisit(isolated, d, now - 30 * DAY);
    await recordVisit(isolated, c, now - 29 * DAY);
    await recordVisit(isolated, a, now - 8 * DAY);
    await recordVisit(isolated, e, now - 6 * DAY);
    await recordVisit(isolated, b, now - 5 * DAY);
    await recordVisit(isolated, a, now);
    await recordVisit(isolated, b, now);
    await Promise.all(Array.from({ length: 3 }, () => recordVisit(isolated, a, now)));
    const stats = await visitorStats(isolated, now);
    assert.equal(stats.today, 2); assert.equal(stats.last7Days, 3); assert.equal(stats.last30Days, 4);
    assert.equal(stats.days.length, 30); assert.equal(stats.days[29].visitors, 2);
    assert.equal(stats.days.reduce((sum, row) => sum + row.visitors, 0), 6);
    assert.equal(stats.startedAt, now - 30 * DAY);
    const rows = await isolated.select().from(visitorDays);
    assert.ok(rows.every(row => row.visitorHash.length === 64 && ![a,b,c,d,e].includes(row.visitorHash)));
    assert.deepEqual(Object.keys(rows[0]).sort(), ['country', 'day', 'visitorHash']);
    assert.deepEqual(stats.countries, [{ country: null, visitors: 4 }]);
    const expired = await visitorStats(isolated, now + 30 * DAY);
    assert.equal(expired.last30Days, 0);
    assert.deepEqual(expired.countries, []);
    assert.equal((await isolated.select().from(visitorDays)).length, 0);
  } finally { isolated.$client.close(); }
});

void test('Taipei midnight starts a new day while the same visitor stays unique across the week', async () => {
  const isolated = connectDatabase(':memory:');
  try {
    await migrate(isolated, { migrationsFolder: './drizzle' });
    const beforeMidnight = Date.parse('2026-10-25T15:59:59Z'), afterMidnight = beforeMidnight + 2000;
    assert.equal(taipeiDay(beforeMidnight), '2026-10-25'); assert.equal(taipeiDay(afterMidnight), '2026-10-26');
    const id = crypto.randomUUID();
    await recordVisit(isolated, id, beforeMidnight); await recordVisit(isolated, id, afterMidnight);
    const stats = await visitorStats(isolated, afterMidnight);
    assert.equal(stats.today, 1); assert.equal(stats.last7Days, 1);
    assert.deepEqual(stats.days.slice(-2).map(day => day.visitors), [1, 1]);
  } finally { isolated.$client.close(); }
});

const visit = (body: unknown = { visitorId: crypto.randomUUID(), path: '/' }, headers: Record<string, string> = {}) => new Request('http://127.0.0.1:3000/api/store/visit/', {
  method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36', 'x-real-ip': '127.0.0.1', ...headers }, body: JSON.stringify(body),
});

void test('public collection ignores privacy opt-outs, bots, prefetches and preview deployments', async () => {
  const ignoredHeaders: Record<string, string>[] = [{ dnt: '1' }, { 'sec-gpc': '1' }, { 'user-agent': 'Googlebot/2.1' }, { 'user-agent': 'HeadlessChrome' }, { purpose: 'prefetch' }];
  for (const headers of ignoredHeaders) assert.equal((await POST(visit(undefined, headers))).status, 204);
  process.env.VERCEL_ENV = 'preview';
  assert.equal((await POST(visit())).status, 204);
  delete process.env.VERCEL_ENV;
  assert.equal(await db.$count(visitorDays), 0);
});

void test('collection rejects foreign requests, oversized bodies, invalid IDs, private pages and extra personal fields', async () => {
  assert.equal((await POST(visit(undefined, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await POST(visit(undefined, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await POST(visit(undefined, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await POST(visit({ value: 'x'.repeat(513) }))).status, 413);
  for (const path of ['/admin/', '/admin/login/', '/api/store/checkout/', '/?email=secret@example.test']) {
    assert.equal(isPublicPage(path), false);
    assert.equal((await POST(visit({ visitorId: crypto.randomUUID(), path }))).status, 400);
  }
  for (const body of [{ visitorId: 'not-a-uuid', path: '/' }, { visitorId: crypto.randomUUID(), path: '/', email: 'secret@example.test' }, { visitorId: crypto.randomUUID(), path: '/', country: 'TW' }]) assert.equal((await POST(visit(body))).status, 400);
  assert.equal(await db.$count(visitorDays), 0);
});

void test('repeated public beacons count once and do not disclose analytics or raw IDs', async () => {
  const payload = { visitorId: crypto.randomUUID(), path: '/' };
  for (let i = 0; i < 2; i++) {
    const response = await POST(visit(payload));
    assert.equal(response.status, 204); assert.equal(await response.text(), '');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  }
  assert.equal((await visitorStats(db)).today, 1);
  for (const path of ['/zh-TW', '/zh-TW/', '/sales-policy/zh-TW/']) {
    assert.equal(isPublicPage(path), true);
    assert.equal((await POST(visit({ ...payload, path }))).status, 204);
  }
  assert.equal(isPublicPage('/zh-TW/admin/'), false);
  assert.equal((await visitorStats(db)).today, 1);
});

void test('database failures are not presented as zero visitors', async () => {
  const missing = connectDatabase(':memory:');
  try { await assert.rejects(visitorStats(missing)); } finally { missing.$client.close(); }
});

void test('country totals count each browser once using its latest known country', async () => {
  const isolated = connectDatabase(':memory:');
  try {
    await migrate(isolated, { migrationsFolder: './drizzle' });
    const now = Date.parse('2026-10-26T04:00:00Z');
    const [traveler, taiwan, unknown, stale] = Array.from({ length: 4 }, () => crypto.randomUUID());
    await recordVisit(isolated, stale, now - 30 * DAY, 'FR');
    await recordVisit(isolated, traveler, now - 4 * DAY, 'TW');
    await recordVisit(isolated, traveler, now - DAY, 'JP');
    await recordVisit(isolated, traveler, now); // Missing geo must not erase Japan.
    await recordVisit(isolated, taiwan, now - 3 * DAY, 'SG');
    await recordVisit(isolated, taiwan, now, 'TW');
    await Promise.all(Array.from({ length: 3 }, () => recordVisit(isolated, taiwan, now, 'TW')));
    await recordVisit(isolated, unknown, now - 2 * DAY);
    await recordVisit(isolated, unknown, now, 'XX');
    const stats = await visitorStats(isolated, now);
    assert.equal(stats.last30Days, 3);
    assert.deepEqual(stats.countries, [{ country: null, visitors: 1 }, { country: 'JP', visitors: 1 }, { country: 'TW', visitors: 1 }]);
    assert.equal(stats.countries.reduce((total, row) => total + row.visitors, 0), stats.last30Days);
    // A returning legacy/unknown visitor gains country data without an extra count.
    await recordVisit(isolated, unknown, now + 1, 'TW');
    await recordVisit(isolated, unknown, now + 2);
    const enriched = await visitorStats(isolated, now + 2);
    assert.equal(enriched.last30Days, 3);
    assert.deepEqual(enriched.countries, [{ country: 'TW', visitors: 2 }, { country: 'JP', visitors: 1 }]);
    const expired = await visitorStats(isolated, now + 30 * DAY);
    assert.deepEqual(expired.countries, []);
  } finally { isolated.$client.close(); }
});

void test('country comes only from a valid Vercel production geo header', async () => {
  for (const value of [null, '', 'XX', 'ZZ', 'EU', 'AA', 'Taiwan', 'TW,JP', '<script>']) assert.equal(normalizeCountry(value), null);
  assert.equal(normalizeCountry(' tw '), 'TW');
  const previousVercel = process.env.VERCEL, previousEnvironment = process.env.VERCEL_ENV, previousOrigin = process.env.BETTER_AUTH_URL;
  try {
    delete process.env.VERCEL;
    assert.equal(visitCountry(visit(undefined, { 'x-vercel-ip-country': 'TW' })), null);
    process.env.VERCEL = '1'; process.env.VERCEL_ENV = 'preview';
    assert.equal(visitCountry(visit(undefined, { 'x-vercel-ip-country': 'TW' })), null);
    process.env.VERCEL_ENV = 'production';
    assert.equal(visitCountry(visit(undefined, { 'x-vercel-ip-country': 'TW' })), 'TW');
    assert.equal(visitCountry(visit(undefined, { 'cf-ipcountry': 'JP' })), null);
    assert.equal(visitCountry(visit(undefined, { 'x-vercel-ip-country': 'XX' })), null);
    process.env.BETTER_AUTH_URL = 'https://store.example.test';
    const response = await POST(new Request('https://store.example.test/api/store/visit/', {
      method: 'POST', headers: { origin: process.env.BETTER_AUTH_URL, 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Chrome/131.0', 'x-vercel-ip-country': 'TW' },
      body: JSON.stringify({ visitorId: crypto.randomUUID(), path: '/' }),
    }));
    assert.equal(response.status, 204); assert.equal(await response.text(), '');
    assert.ok((await visitorStats(db)).countries.some(row => row.country === 'TW' && row.visitors === 1));
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnvironment;
    if (previousOrigin === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previousOrigin;
  }
});
