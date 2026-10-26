import type { Locale } from './site-copy';

export const localeCookie = 'sgbc-language';
export const localeHomes: Record<Locale, string> = { en: '/', 'zh-TW': '/zh-TW/', fr: '/fr/' };
export const localeLabels: Record<Locale, string> = { en: 'English', 'zh-TW': '繁體中文（台灣）', fr: 'Français' };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-TW' || value === 'fr';
}

export function isFranceVisitor(headers: Pick<Headers, 'get'>) {
  // Vercel supplies this header from the connection's IP; never infer location from browser language.
  return process.env.VERCEL === '1' && headers.get('x-vercel-ip-country') === 'FR';
}

export function localePath(locale: Locale, policy = false) {
  return policy ? `/sales-policy/${locale}/` : localeHomes[locale];
}
