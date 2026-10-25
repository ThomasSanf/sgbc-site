import 'server-only';
import { createHmac } from 'node:crypto';
import { desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StoreDatabase } from './db';
import { analyticsState, visitorDays } from './schema';
import { StoreError } from './validation';
import { isPublicPage, taipeiDay, type VisitorStats } from '../visitor-analytics';

export const visitInput = z.object({ visitorId: z.uuid(), path: z.string().max(80).refine(isPublicPage) }).strict();
const DAY = 86_400_000;
const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

export function normalizeCountry(value: string | null) {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || ['XX', 'ZZ', 'EU', 'UN', 'QO', 'EZ', 'XA', 'XB'].includes(code)) return null;
  return countryNames.of(code) ? code : null;
}

export function visitCountry(request: Request) {
  // Only use the hosting platform's header, never a country sent in the beacon body.
  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'
    ? normalizeCountry(request.headers.get('x-vercel-ip-country')) : null;
}

export function excludedVisit(request: Request) {
  const agent = request.headers.get('user-agent') ?? '';
  return request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1'
    || !agent || /bot\b|crawler|spider|headless|lighthouse|facebookexternalhit|preview|curl|wget/i.test(agent)
    || request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')?.includes('prefetch');
}

export async function recordVisit(db: StoreDatabase, visitorId: string, now = Date.now(), country: string | null = null) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new StoreError(503, 'Visitor analytics is not configured.');
  const visitorHash = createHmac('sha256', secret).update(`sgbc-visitor-v1:${visitorId}`).digest('hex');
  await db.batch([
    db.insert(analyticsState).values({ id: 'storefront', startedAt: now }).onConflictDoNothing(),
    db.delete(visitorDays).where(lt(visitorDays.day, taipeiDay(now - 29 * DAY))),
    db.insert(visitorDays).values({ day: taipeiDay(now), visitorHash, country: normalizeCountry(country) }).onConflictDoUpdate({
      target: [visitorDays.day, visitorDays.visitorHash],
      set: { country: sql`coalesce(excluded.country, ${visitorDays.country})` },
    }),
  ]);
}

export async function visitorStats(db: StoreDatabase, now = Date.now()): Promise<VisitorStats> {
  const today = taipeiDay(now), weekStart = taipeiDay(now - 6 * DAY), monthStart = taipeiDay(now - 29 * DAY);
  // Prune on collection and reads, so inactive sites do not expose stale identifiers.
  await db.delete(visitorDays).where(lt(visitorDays.day, monthStart));
  // Attribute each browser to its latest known country within the retained window.
  // Unknown visits must not erase a known country or count a returning browser twice.
  const ranked = db.select({
    country: visitorDays.country,
    rank: sql<number>`row_number() over (partition by ${visitorDays.visitorHash} order by (${visitorDays.country} is null), ${visitorDays.day} desc)`.as('country_rank'),
  }).from(visitorDays).where(gte(visitorDays.day, monthStart)).as('ranked_visitors');
  const [totals, counts, state, countries] = await db.batch([
    db.select({
      today: sql<number>`count(distinct case when ${visitorDays.day} = ${today} then ${visitorDays.visitorHash} end)`,
      last7Days: sql<number>`count(distinct case when ${visitorDays.day} >= ${weekStart} then ${visitorDays.visitorHash} end)`,
      last30Days: sql<number>`count(distinct ${visitorDays.visitorHash})`,
    }).from(visitorDays).where(gte(visitorDays.day, monthStart)),
    db.select({ day: visitorDays.day, visitors: sql<number>`count(*)` }).from(visitorDays).where(gte(visitorDays.day, monthStart)).groupBy(visitorDays.day),
    db.select().from(analyticsState).limit(1),
    db.select({ country: ranked.country, visitors: sql<number>`count(*)`.as('visitors') })
      .from(ranked).where(eq(ranked.rank, 1)).groupBy(ranked.country).orderBy(desc(sql`count(*)`), ranked.country),
  ]);
  const byDay = new Map(counts.map(item => [item.day, Number(item.visitors)]));
  return {
    today: Number(totals[0].today), last7Days: Number(totals[0].last7Days), last30Days: Number(totals[0].last30Days),
    days: Array.from({ length: 30 }, (_, index) => { const day = taipeiDay(now - (29 - index) * DAY); return { day, visitors: byDay.get(day) ?? 0 }; }),
    countries: countries.map(row => ({ country: row.country, visitors: Number(row.visitors) })),
    startedAt: state[0]?.startedAt ?? null, updatedAt: now,
  };
}
