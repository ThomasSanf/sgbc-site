'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/site-copy';
import { isPublicPage, taipeiDay, VISITOR_ID_KEY, VISITOR_ID_LIFETIME, VISITOR_OPTOUT_KEY, VISITOR_PREFERENCE_EVENT } from '@/lib/visitor-analytics';

type Preference = 'on' | 'off' | 'browser' | 'unavailable';
function preference(): Preference {
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return 'browser';
  try { return localStorage.getItem(VISITOR_OPTOUT_KEY) === '1' ? 'off' : 'on'; }
  catch { return 'unavailable'; }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(VISITOR_PREFERENCE_EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(VISITOR_PREFERENCE_EVENT, callback); };
}
function visitorId() {
  const now = Date.now();
  try {
    let saved: { id?: string; expires?: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(VISITOR_ID_KEY) ?? 'null'); } catch { /* Replace damaged storage. */ }
    if (saved?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id) && typeof saved.expires === 'number' && saved.expires > now && saved.expires <= now + VISITOR_ID_LIFETIME) return saved.id;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, JSON.stringify({ id, expires: now + VISITOR_ID_LIFETIME }));
    return id;
  } catch { return null; } // Do not invent a fresh visitor on every reload when storage is blocked.
}

export function VisitorTracker() {
  const path = usePathname();
  const recorded = useRef('');
  useEffect(() => {
    if (!isPublicPage(path)) return;
    let active = true, sending = false;
    async function report() {
      if (!active || sending || document.visibilityState !== 'visible' || navigator.webdriver || preference() !== 'on') return;
      const day = taipeiDay(Date.now());
      if (recorded.current === day) return;
      const id = visitorId();
      if (!id) return;
      sending = true;
      try {
        const response = await fetch('/api/store/visit/', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: id, path }), keepalive: true,
        });
        if (response.ok) recorded.current = day;
      } catch { /* Analytics must never interrupt browsing or checkout. */ }
      finally { sending = false; }
    }
    const timer = window.setTimeout(() => { void report(); }, 1000);
    const onVisibility = () => { void report(); };
    const onPreference = () => {
      if (preference() !== 'on') { try { localStorage.removeItem(VISITOR_ID_KEY); } catch { /* Storage is optional. */ } }
      else void report();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(VISITOR_PREFERENCE_EVENT, onPreference);
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener(VISITOR_PREFERENCE_EVENT, onPreference); };
  }, [path]);
  return null;
}

const privacyCopy = {
  en: {
    title: 'Privacy choices',
    description: 'We count unique visitors using a random ID stored in this browser for up to 180 days. Our server retains its hashed value, visit dates, and the approximate country supplied by our hosting provider based on the IP address for the last 30 days. Visitor records are not linked to orders, and raw IP addresses are not stored for analytics. You can turn this counting off.',
    turnOff: 'Turn off visitor counting', turnOn: 'Turn on visitor counting', disabled: 'Visitor counting is disabled',
    browser: 'Your browser’s privacy preference is respected.',
  },
  'zh-TW': {
    title: '隱私選項',
    description: '我們使用儲存在此瀏覽器的隨機識別碼統計不重複訪客。識別碼最長保留 180 天；伺服器保留最近 30 天的雜湊識別碼、造訪日期，以及由網站代管服務根據 IP 位址推估的國家，不將訪客紀錄連結至訂單，也不儲存原始 IP 位址。你可以關閉這項統計。',
    turnOff: '關閉訪客統計', turnOn: '開啟訪客統計', disabled: '訪客統計已停用',
    browser: '已遵循瀏覽器的隱私設定。',
  },
  fr: {
    title: 'Préférences de confidentialité',
    description: 'Nous comptons les visiteurs uniques à l’aide d’un identifiant aléatoire conservé dans ce navigateur pendant 180 jours au maximum. Notre serveur conserve sa valeur hachée, les dates de visite et le pays approximatif fourni par notre hébergeur à partir de l’adresse IP pour les 30 derniers jours. Les données de visite ne sont pas liées aux commandes et les adresses IP brutes ne sont pas conservées à des fins statistiques. Vous pouvez désactiver ce comptage.',
    turnOff: 'Désactiver le comptage des visiteurs', turnOn: 'Activer le comptage des visiteurs', disabled: 'Le comptage des visiteurs est désactivé',
    browser: 'La préférence de confidentialité de votre navigateur est respectée.',
  },
} as const;

export function VisitorPrivacy({ locale }: { locale: Locale }) {
  const state = useSyncExternalStore(subscribe, preference, (): Preference => 'unavailable');
  const copy = privacyCopy[locale];
  return <details className="visitor-privacy">
    <summary className="disclosure-summary"><ChevronRight size={16} aria-hidden="true"/>{copy.title}</summary>
    <div>
      <p>{copy.description}</p>
      <button type="button" disabled={state === 'browser' || state === 'unavailable'} onClick={() => {
        try {
          localStorage.setItem(VISITOR_OPTOUT_KEY, state === 'on' ? '1' : '0');
          if (state === 'on') localStorage.removeItem(VISITOR_ID_KEY);
          window.dispatchEvent(new Event(VISITOR_PREFERENCE_EVENT));
        } catch { /* Blocked storage also disables collection. */ }
      }}>{state === 'on' ? copy.turnOff : state === 'off' ? copy.turnOn : copy.disabled}</button>
      {state === 'browser' && <small>{copy.browser}</small>}
    </div>
  </details>;
}
