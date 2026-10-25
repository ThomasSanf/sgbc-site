import 'server-only';
import { createHmac } from 'node:crypto';
import { gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { StoreDatabase } from './db';
import { analyticsState, visitorDays } from './schema';
import { StoreError } from './validation';
import { isPublicPage, taipeiDay, type VisitorStats } from '../visitor-analytics';

export const visitInput = z.object({ visitorId: z.uuid(), path: z.string().max(80).refine(isPublicPage) }).strict();
const DAY = 86_400_000;

export function excludedVisit(request: Request) {
  const agent = request.headers.get('user-agent') ?? '';
  return request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1'
    || !agent || /bot\b|crawler|spider|headless|lighthouse|facebookexternalhit|preview|curl|wget/i.test(agent)
    || request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')?.includes('prefetch');
}

export async function recordVisit(db: StoreDatabase, visitorId: string, now = Date.now()) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new StoreError(503, 'Visitor analytics is not configured.');
  const visitorHash = createHmac('sha256', secret).update(`sgbc-visitor-v1:${visitorId}`).digest('hex');
  await db.batch([
    db.insert(analyticsState).values({ id: 'storefront', startedAt: now }).onConflictDoNothing(),
    db.delete(visitorDays).where(lt(visitorDays.day, taipeiDay(now - 29 * DAY))),
    db.insert(visitorDays).values({ day: taipeiDay(now), visitorHash }).onConflictDoNothing(),
  ]);
}

export async function visitorStats(db: StoreDatabase, now = Date.now()): Promise<VisitorStats> {
  const today = taipeiDay(now), weekStart = taipeiDay(now - 6 * DAY), monthStart = taipeiDay(now - 29 * DAY);
  // Prune on collection and reads, so inactive sites do not expose stale identifiers.
  await db.delete(visitorDays).where(lt(visitorDays.day, monthStart));
  const [totals, counts, state] = await Promise.all([
    db.select({
      today: sql<number>`count(distinct case when ${visitorDays.day} = ${today} then ${visitorDays.visitorHash} end)`,
      last7Days: sql<number>`count(distinct case when ${visitorDays.day} >= ${weekStart} then ${visitorDays.visitorHash} end)`,
      last30Days: sql<number>`count(distinct ${visitorDays.visitorHash})`,
    }).from(visitorDays).where(gte(visitorDays.day, monthStart)),
    db.select({ day: visitorDays.day, visitors: sql<number>`count(*)` }).from(visitorDays).where(gte(visitorDays.day, monthStart)).groupBy(visitorDays.day),
    db.select().from(analyticsState).limit(1),
  ]);
  const byDay = new Map(counts.map(item => [item.day, Number(item.visitors)]));
  return {
    today: Number(totals[0].today), last7Days: Number(totals[0].last7Days), last30Days: Number(totals[0].last30Days),
    days: Array.from({ length: 30 }, (_, index) => { const day = taipeiDay(now - (29 - index) * DAY); return { day, visitors: byDay.get(day) ?? 0 }; }),
    startedAt: state[0]?.startedAt ?? null, updatedAt: now,
  };
}
