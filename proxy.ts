import { NextResponse, type NextRequest } from 'next/server';
import { isFranceVisitor, isLocale, localeCookie, localePath } from './lib/storefront-locale';

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone(), path = url.pathname.replace(/\/$/, '') || '/';
  const policy = path.startsWith('/sales-policy/');
  const frenchPath = path === '/fr' || path.startsWith('/fr/') || path === '/sales-policy/fr';
  const france = isFranceVisitor(request.headers);
  const selected = url.searchParams.get('lang');
  const preference = request.cookies.get(localeCookie)?.value;
  let response: NextResponse;

  // A saved French preference or a shared French link cannot enable French outside France.
  if (!france && (frenchPath || selected === 'fr')) {
    url.pathname = localePath('en', policy); url.searchParams.delete('lang');
    response = NextResponse.redirect(url, 307);
  } else if (isLocale(selected)) {
    url.pathname = localePath(selected, policy); url.searchParams.delete('lang');
    response = NextResponse.redirect(url, 307);
    // Persist only an explicit selection. Ordinary visits and prefetches do not change preference.
    response.cookies.set(localeCookie, selected, { path: '/', maxAge: 60 * 60 * 24 * 180, httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' });
  } else if (france && path === '/' && preference !== 'en') {
    url.pathname = preference === 'zh-TW' ? localePath('zh-TW') : localePath('fr');
    response = NextResponse.redirect(url, 307);
  } else {
    response = NextResponse.next();
  }

  // Never share a geographical redirect or a locale selector between visitors through a cache.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.append('Vary', 'Cookie, X-Vercel-IP-Country');
  if (frenchPath) response.headers.set('X-Robots-Tag', 'noindex, follow');
  return response;
}

export const config = { matcher: ['/', '/zh-TW', '/fr/:path*', '/sales-policy/:path*'] };
