export const VISITOR_ID_KEY = 'sgbc-visitor-v1';
export const VISITOR_OPTOUT_KEY = 'sgbc-visitor-optout';
export const VISITOR_PREFERENCE_EVENT = 'sgbc-visitor-preference';
export const VISITOR_ID_LIFETIME = 180 * 24 * 60 * 60 * 1000;

export function isPublicPage(path: string) {
  return ['/', '/zh-TW', '/fr', '/sales-policy/en', '/sales-policy/zh-TW', '/sales-policy/fr', '/checkout/result'].includes(path === '/' ? path : path.replace(/\/$/, ''));
}

export function taipeiDay(time: number) {
  return new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type VisitorStats = {
  today: number; last7Days: number; last30Days: number;
  days: Array<{ day: string; visitors: number }>;
  countries: Array<{ country: string | null; visitors: number }>;
  startedAt: number | null; updatedAt: number;
};
