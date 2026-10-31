'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, ArrowUp, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WishlistButton } from '@/components/wishlist-button';
import { FeatureSection } from '@/components/feature-section';
import type { ConsoleView } from './console-scene';
import { languageStorageKey, siteCopy, type Locale } from '@/lib/site-copy';
import { salesPolicy } from '@/lib/sales-policy';
import { VisitorPrivacy } from '@/components/visitor-tracker';
import { LanguageSwitcher } from '@/components/language-switcher';

const ConsoleScene = dynamic(() => import('./console-scene'), { ssr: false });
function LazyScene({ view, resetKey, locale }: { view: ConsoleView; resetKey: number; locale: Locale }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div className="lazy-scene" ref={host}>{ready && <ConsoleScene view={view} resetKey={resetKey} locale={locale} dark />}</div>;
}

export default function ProductPage({ locale = 'en', allowFrench = false }: { locale?: Locale; allowFrench?: boolean }) {
  const [detailView, setDetailView] = useState<ConsoleView>('hero');
  const [detailReset, setDetailReset] = useState(0);
  const copy = siteCopy[locale];
  const views = copy.views;

  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(languageStorageKey, locale); } catch { /* The URL remains the language source when storage is unavailable. */ }
  }, [locale]);

  return <div lang={locale}>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <header className="site-header">
      <a className="wordmark" href="#console" aria-label={copy.home}>sgbc<span>™</span></a>
      <nav aria-label={copy.nav.label}><a href="#console">{copy.nav.console} <sup>01</sup></a><a href="#specs">{copy.nav.specs} <sup>02</sup></a><a href="#design">{copy.nav.design} <sup>03</sup></a></nav>
      <div className="header-actions">
        <LanguageSwitcher locale={locale} allowFrench={allowFrench}/>
        <WishlistButton className="header-preorder" locale={locale}/>
      </div>
    </header>
    <main id="main">
      <section className="hero" id="console" aria-labelledby="hero-title">
        <div className="hero-topline mono"><span>{copy.hero.eyebrow}</span><span>{copy.hero.revision}</span></div>
        <div className="hero-layout" data-console-tilt>
          <div className="hero-copy">
            <h1 id="hero-title">{copy.hero.title}<br/><span>{copy.hero.subtitle}</span></h1>
            <div className="hero-intro"><p>{copy.hero.intro[0]}<br/>{copy.hero.intro[1]}<br className="desktop-only"/>{copy.hero.intro[2]}</p></div>
            <div className="hero-actions">
              <WishlistButton locale={locale}/>
              <a className="text-link" href="#specs">{copy.hero.explore} <ArrowDown size={18}/></a>
            </div>
          </div>
          <div className="hero-stage">
            <div className="stage-wordmark" aria-hidden="true">sgbc<span>™</span></div>
            <ConsoleScene view="hero" interaction="cursor" locale={locale} dark />
            <div className="stage-corner mono"><Plus size={18}/><span>{copy.hero.label}</span></div>
          </div>
        </div>
      </section>
      <FeatureSection copy={copy.specs} story={copy.story}/>
      <section className="design-section section-shell" id="design" aria-labelledby="design-title">
        <div className="section-kicker mono"><span>{copy.design.eyebrow}</span><span>{copy.design.colors}</span></div>
        <div className="section-heading"><h2 id="design-title">{copy.design.title}<br/><span>{copy.design.subtitle}</span></h2><p>{copy.design.intro}<br/>{copy.design.detail}</p></div>
        <Tabs value={detailView} onValueChange={value => { setDetailView(value as ConsoleView); setDetailReset(n => n + 1); }} className="design-tabs">
          <TabsList className="view-tabs" aria-label={copy.design.angles}>{views.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}</TabsList>
          <div className="design-grid"><div className="detail-stage"><LazyScene view={detailView} resetKey={detailReset} locale={locale}/><div className="viewer-bottom mono"><span><span className="desktop-hint">{copy.design.study}</span><span className="touch-hint">{copy.design.drag}</span></span><button className="reset-view" onClick={() => setDetailReset(n => n + 1)} aria-label={copy.design.reset}><RotateCcw size={18}/></button></div></div><div className="detail-copy">{views.map((v, i) => <TabsContent value={v.id} key={v.id}><span className="detail-number mono">[ 0{i + 1} ]</span><h3>{v.title}</h3><p>{v.description}</p></TabsContent>)}<div className="material-strip"><span><i className="shell-swatch"/>{copy.design.gray}</span><span><i className="black-swatch"/>{copy.design.black}</span><span><i className="bordeaux-swatch"/>{copy.design.bordeaux}</span></div></div></div>
        </Tabs>
      </section>
      <section className="closing"><p className="mono">{copy.closing.eyebrow}</p><a href="#console" aria-label={copy.preorder.close}>{copy.closing.title}<ArrowUpRight aria-hidden="true"/></a><div className="closing-bottom mono"><span>{copy.closing.project}</span><span>{copy.closing.tagline}</span></div></section>
    </main>
    <footer className="site-footer"><a className="wordmark" href="#console" aria-label={copy.home}>sgbc<span>™</span></a><p>{copy.footer.trademarks}<br/>{copy.footer.independent}</p><Link className="footer-policy-link" href={`/sales-policy/${locale}/`}>{salesPolicy[locale].title}</Link><VisitorPrivacy locale={locale}/><a className="mono" href="#console">{copy.footer.top} <ArrowUp size={16}/></a></footer>
  </div>;
}
