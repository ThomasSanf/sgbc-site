'use client';

import type { MouseEvent } from 'react';
import { localeLabels, localePath } from '@/lib/storefront-locale';
import type { Locale } from '@/lib/site-copy';

const shortLabels = { en: 'EN', 'zh-TW': '中', fr: 'FR' };

export function LanguageSwitcher({ locale, allowFrench, policy = false }: { locale: Locale; allowFrench: boolean; policy?: boolean }) {
  const available: Locale[] = allowFrench ? ['fr', 'en', 'zh-TW'] : ['en', 'zh-TW'];
  const label = locale === 'fr' ? 'Choisir la langue' : locale === 'zh-TW' ? '選擇語言' : 'Choose language';
  const href = (value: Locale) => `${localePath(value, policy)}?lang=${value}`;
  function followLanguage(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = href(event.currentTarget.hreflang as Locale) + window.location.hash;
    // Full navigation rechecks the country and the selected cookie, avoiding stale Next router caches.
  }

  if (!allowFrench) {
    const next = locale === 'en' ? 'zh-TW' : 'en';
    return <a className="language-toggle" href={href(next)} hrefLang={next} lang={next} onClick={followLanguage} aria-label={localeLabels[next]}>{shortLabels[next]}</a>;
  }
  return <select className="language-toggle language-select" aria-label={label} value={locale} onChange={event => window.location.assign(href(event.target.value as Locale) + window.location.hash)}>
    {available.map(value => <option key={value} value={value} lang={value}>{shortLabels[value]}</option>)}
  </select>;
}
