import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { isFranceVisitor } from '../lib/storefront-locale';

const originalVercel = process.env.VERCEL;
process.env.VERCEL = '1';
after(() => { if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel; });
const request = (path: string, country?: string, cookie?: string, extra: Record<string, string> = {}) => new NextRequest(`https://www.sgbc.tw${path}`, { nextConfig: { trailingSlash: true }, headers: { ...(country ? { 'x-vercel-ip-country': country } : {}), ...(cookie ? { cookie: `sgbc-language=${cookie}` } : {}), ...extra } });
const target = (response: Response) => response.headers.get('location');

void test('French is automatic only for France and preserves campaign queries', () => {
  assert.equal(target(proxy(request('/?utm_source=story', 'FR'))), 'https://www.sgbc.tw/fr/?utm_source=story');
  for (const country of ['TW', 'JP', 'SG', 'US', 'BE', 'CA', undefined]) assert.equal(target(proxy(request('/', country))), null);
  assert.equal(target(proxy(request('/', 'TW', undefined, { 'accept-language': 'fr-FR,fr;q=0.9' }))), null);
});

void test('an explicit English or Chinese choice persists without a redirect loop', () => {
  const english = proxy(request('/?lang=en', 'FR'));
  assert.equal(target(english), 'https://www.sgbc.tw/');
  assert.match(english.headers.get('set-cookie') ?? '', /sgbc-language=en/);
  assert.match(english.headers.get('set-cookie') ?? '', /HttpOnly/);
  assert.equal(target(proxy(request('/', 'FR', 'en'))), null);
  assert.equal(target(proxy(request('/', 'FR', 'zh-TW'))), 'https://www.sgbc.tw/zh-TW/');
  assert.equal(target(proxy(request('/zh-TW/?lang=zh-TW', 'FR'))), 'https://www.sgbc.tw/zh-TW/');
  assert.equal(target(proxy(request('/fr/?lang=fr', 'FR', 'en'))), 'https://www.sgbc.tw/fr/');
});

void test('French pages, language query and saved preference cannot enable French elsewhere', () => {
  for (const country of ['TW', 'US', undefined]) {
    assert.equal(target(proxy(request('/fr/', country, 'fr'))), 'https://www.sgbc.tw/');
    assert.equal(target(proxy(request('/sales-policy/fr/', country, 'fr'))), 'https://www.sgbc.tw/sales-policy/en/');
    assert.equal(target(proxy(request('/?lang=fr&utm_source=story', country))), 'https://www.sgbc.tw/?utm_source=story');
    assert.equal(target(proxy(request('/', country, 'fr'))), null);
  }
});

void test('French content is available in France and geographic responses are never shared by caches', () => {
  for (const path of ['/', '/fr/', '/sales-policy/fr/', '/zh-TW/']) {
    const result = proxy(request(path, 'FR'));
    assert.match(result.headers.get('cache-control') ?? '', /private, no-store/);
    assert.match(result.headers.get('vary') ?? '', /Cookie/);
    assert.match(result.headers.get('vary') ?? '', /X-Vercel-IP-Country/);
  }
  const french = proxy(request('/fr/', 'FR'));
  assert.equal(target(french), null);
  assert.match(french.headers.get('x-robots-tag') ?? '', /noindex/);
  assert.equal(french.headers.get('set-cookie'), null);
  assert.equal(target(proxy(request('/fr/', 'US', undefined, { rsc: '1', 'next-router-prefetch': '1' }))), 'https://www.sgbc.tw/');
});

void test('untrusted local geo headers and unknown language preferences do not activate French', () => {
  process.env.VERCEL = '0';
  try {
    assert.equal(isFranceVisitor(new Headers({ 'x-vercel-ip-country': 'FR' })), false);
    assert.equal(target(proxy(request('/', 'FR'))), null);
    assert.equal(target(proxy(request('/fr/', 'FR'))), 'https://www.sgbc.tw/');
  } finally { process.env.VERCEL = '1'; }
  const invalid = proxy(request('/?lang=https://attacker.test', 'TW'));
  assert.equal(target(invalid), null); assert.equal(invalid.headers.get('set-cookie'), null);
});
