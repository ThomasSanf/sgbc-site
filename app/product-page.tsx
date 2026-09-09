'use client';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUpRight, MoveUpRight, RotateCcw, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ConsoleView } from './console-scene';
const ConsoleScene = dynamic(() => import('./console-scene'), { ssr: false });

const views: { id: ConsoleView; label: string; number: string; title: string; description: string }[] = [
  { id: 'hero', label: 'Overview', number: '01', title: 'A little nostalgia.\nA lot of character.', description: 'Softly rounded edges. A warm beige top. A quiet black base. And rich Bordeaux marble accents that make the familiar feel new again.' },
  { id: 'top', label: 'From above', number: '02', title: 'The ritual\nstarts here.', description: 'An upright cartridge slot sits beside dedicated power and reset buttons. Bordeaux marble gives each detail its own depth and texture.' },
  { id: 'rear', label: 'Connections', number: '03', title: 'Made for\nyour setup.', description: 'HDMI carries picture and stereo audio to your screen. USB-C supplies power. The original-style controller connection keeps a familiar feel in your hands.' },
  { id: 'inside', label: 'Under the shell', number: '04', title: 'Every part\nhas a purpose.', description: 'Explore the actual Rev C board beneath the enclosure: an Efinix T85 FPGA, dedicated HDMI transmitter, cartridge carrier, and a separate controls board.' },
];
const specs = [
  ['FPGA', 'Efinix T85F324C3'],
  ['Cartridge interface', 'Game Boy · Game Boy Color · Game Boy Advance'],
  ['Video & audio', 'HDMI · ADV7513 transmitter'],
  ['Controller', 'Original-style SNES connector'],
  ['Storage', 'microSD card slot'],
  ['Power', 'USB-C · 5 V input'],
  ['Enclosure', '148 × 105.75 mm · 39.5 mm cartridge crest'],
];

export default function ProductPage() {
  const [resetKey, setResetKey] = useState(0);
  const [detailView, setDetailView] = useState<ConsoleView>('hero');
  const [detailReset, setDetailReset] = useState(0);
  const [detailReady, setDetailReady] = useState(false);
  const detailHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setDetailReady(true); observer.disconnect(); }
    }, { rootMargin: '500px' });
    if (detailHost.current) observer.observe(detailHost.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 800, easing: 'cubic-bezier(.2,.65,.2,1)', fill: 'both' });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#" aria-label="SGBC home">sgbc<span>™</span></a>
      <nav aria-label="Main navigation"><a href="#console">The console</a><a href="#design">A closer look</a><a href="#specs">Tech specs</a></nav>
      <a className="nav-action" href="#console">Explore in 3D <ArrowUpRight size={16} /></a>
    </header>
    <main id="main">
      <section className="hero" id="console" aria-labelledby="hero-title">
        <div className="hero-heading">
          <div><p className="eyebrow"><span className="status-dot" /> INTRODUCING SGBC</p><h1 id="hero-title">Old soul.<br/><span>New possibilities.</span></h1></div>
          <div className="hero-intro"><p>Your favorite cartridges.<br/>A whole new way to come home.</p><a className="text-link" href="#story">Meet the console <ArrowDown size={16} /></a></div>
        </div>
        <div className="hero-stage">
          <div className="stage-wordmark" aria-hidden="true">sgbc</div>
          <ConsoleScene view="hero" resetKey={resetKey} />
          <div className="stage-corner"><span className="tiny-cross">+</span><span>SGBC / REV C<br/>BORDEAUX & BEIGE</span></div>
          <button className="reset-view" onClick={() => setResetKey(k => k + 1)} aria-label="Reset console rotation"><RotateCcw size={17}/></button>
        </div>
        <div className="hero-baseline"><div className="finish-label"><span className="finish-dot"/> Beige. Black. Bordeaux.</div><p>Drag to explore <MoveUpRight size={14}/></p><a href="#story">Rediscover the feeling <ArrowDown size={16}/></a></div>
      </section>
      <section id="story" className="story section-shell">
        <div data-reveal><p className="eyebrow">THE GAMES STAY WITH YOU</p><h2>A new home<br/>for your classics.</h2><p className="story-copy">Some things never lose their magic. The click of a cartridge. A familiar controller. That first level you still know by heart. SGBC is designed to bring those moments to your big screen, with an FPGA at its heart.</p></div>
        <div className="system-list" data-reveal><div><span className="system-era">THE ORIGINAL</span><span className="game-boy">Game Boy</span></div><div><span className="system-era">A LITTLE MORE COLOR</span><span className="game-boy">Game Boy <em>Color</em></span></div><div><span className="system-era">THE NEXT CHAPTER</span><span className="game-boy">Game Boy <em>Advance</em></span></div></div>
        <p className="compatibility-note">Designed around original GB, GBC, and GBA cartridges.</p>
      </section>
      <section className="hardware section-shell" aria-labelledby="hardware-title">
        <div className="hardware-top" data-reveal><p className="eyebrow">HARDWARE, AT HEART</p><span className="hardware-index">001 — THE ARCHITECTURE</span></div>
        <div className="hardware-content"><div data-reveal><h2 id="hardware-title">The original spirit.<br/><span>Rebuilt in silicon.</span></h2><p>Great games are more than their pixels. They’re timing, sound, and the feeling of being in control. SGBC puts programmable hardware at the center of the experience.</p><a className="text-link" href="#specs">Discover what’s inside <ArrowDown size={16}/></a></div><div className="fpga-type" data-reveal><span>FIELD-PROGRAMMABLE GATE ARRAY</span><strong>FPGA<span>↗</span></strong><div className="signal-path"><span>Cartridge</span><ArrowRight size={18}/><span>Hardware core</span><ArrowRight size={18}/><span>HDMI</span></div></div></div>
        <div className="hardware-facts" data-reveal><div><strong>T85</strong><span>Efinix FPGA at the core</span></div><div><strong>3<span> generations</span></strong><span>One shared cartridge interface</span></div><div><strong>HDMI</strong><span>Picture and stereo sound, together</span></div></div>
      </section>
      <section id="design" className="design-section section-shell">
        <div className="section-heading" data-reveal><div><p className="eyebrow">THE FINER DETAILS</p><h2>Considered.<br/>From every angle.</h2></div><p>A familiar silhouette.<br/>An entirely different finish.</p></div>
        <Tabs value={detailView} onValueChange={value => { setDetailView(value as ConsoleView); setDetailReset(n => n + 1); }} className="design-tabs">
          <TabsList className="view-tabs" aria-label="Console viewing angle">{views.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}</TabsList>
          <div className="design-grid"><div className="detail-stage" ref={detailHost}>
            {detailReady && <ConsoleScene view={detailView} resetKey={detailReset}/>}
            <span className="detail-watermark" aria-hidden="true">C.</span>
            <div className="detail-stage-bottom"><span><span className="desktop-hint">Drag to rotate</span><span className="touch-hint">Rotate with two fingers</span></span><button className="detail-reset" onClick={() => setDetailReset(n => n + 1)} aria-label="Reset detail view"><RotateCcw size={17}/></button></div>
          </div><div className="detail-copy">{views.map(v => <TabsContent value={v.id} key={v.id}><span className="detail-number">/ {v.number}</span><h3>{v.title}</h3><p>{v.description}</p></TabsContent>)}<div className="material-strip"><div><span className="material-swatch beige-swatch"/><span>Beige shell</span></div><div><span className="material-swatch black-swatch"/><span>Black base</span></div><div><span className="material-swatch marble-swatch"/><span>Bordeaux marble</span></div></div></div></div>
        </Tabs>
      </section>
      <section id="specs" className="section-shell specs">
        <div className="specs-heading" data-reveal><p className="eyebrow">UNDER THE SURFACE</p><h2>Small console.<br/>Real hardware.</h2><p className="specs-intro">Purposeful on the outside.<br/>Thoughtful on the inside.</p><span className="revision-label"><span className="status-dot"/> REV C · IN DEVELOPMENT</span></div>
        <div data-reveal><dl className="spec-table">{specs.map(([label, value]) => <div className="spec-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="prototype-note">Shown with a concept finish on the actual Rev C design. This is an engineering prototype; hardware integration, compatibility validation, and final specifications are still in development.</p></div>
      </section>
      <section className="closing"><div data-reveal><p className="eyebrow">SOME THINGS ARE WORTH COMING BACK TO</p><h2>Press play.<br/>Feel at home.</h2><a href="#console" className="closing-link">Meet SGBC <ArrowUpRight size={21}/></a></div><span className="closing-mark" aria-hidden="true">sgbc</span></section>
    </main>
    <footer className="site-footer"><a href="#" className="wordmark" aria-label="SGBC home">sgbc<span>™</span></a><span>Built for the games that stay with us.<small>Game Boy, Game Boy Color, and Game Boy Advance are trademarks of Nintendo. SGBC is an independent project.</small></span><a href="#console">Back to the console <ArrowUpRight size={16}/></a></footer>
  </>;
}
