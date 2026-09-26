'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ArrowDown, ArrowUpRight, ArrowUp, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import type { ConsoleView } from './console-scene';

const ConsoleScene = dynamic(() => import('./console-scene'), { ssr: false });
const views: { id: ConsoleView; label: string; title: string; description: string }[] = [
  { id: 'hero', label: 'Overview', title: 'A familiar shape.\nIts own character.', description: 'Warm gray up top. Black underneath. Bordeaux on the details you touch. A compact home for the cartridges you kept.' },
  { id: 'top', label: 'Top', title: 'The ritual\nstarts here.', description: 'An upright cartridge slot, dedicated power and reset buttons, and a clean top surface. Simple things, given room to breathe.' },
  { id: 'rear', label: 'Connections', title: 'Meet your\nbig screen.', description: 'Explore the HDMI and USB-C openings in the enclosure study. A familiar controller connection brings the setup together.' },
  { id: 'inside', label: 'Cutaway', title: 'Take the\nroof off.', description: 'Look through the earlier enclosure assembly: cartridge carrier, controls, and motherboard placement.' },
];
const specs = [
  ['FPGA', 'Efinix T85F324C3'],
  ['Cartridge interface', 'Game Boy / Game Boy Color / Game Boy Advance'],
  ['HDMI transmitter', 'ITE IT6263FN/BX'],
  ['Memory', '40 MiB PSRAM'],
  ['USB-C', '5 V power + FT232H JTAG programming'],
  ['Controller / storage', 'SNES connector / microSD'],
  ['Motherboard', '130 × 95 mm / 6 layers'],
  ['Enclosure study', '148 × 105.75 mm / 39.5 mm cartridge crest'],
];

function LazyScene({ view, resetKey }: { view: ConsoleView; resetKey: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div className="lazy-scene" ref={host}>{ready && <ConsoleScene view={view} resetKey={resetKey} dark />}</div>;
}

export default function ProductPage() {
  const [detailView, setDetailView] = useState<ConsoleView>('hero');
  const [detailReset, setDetailReset] = useState(0);

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#console" aria-label="SGBC home">sgbc<span>™</span></a>
      <nav aria-label="Main navigation"><a href="#console">Console <sup>01</sup></a><a href="#design">Design <sup>02</sup></a><a href="#specs">Specs <sup>03</sup></a></nav>
      <a href="#specs" className="nav-status"><span className="status-dot"/> Rev C <ArrowUpRight size={15}/></a>
    </header>
    <main id="main">
      <section className="hero" id="console" aria-labelledby="hero-title">
        <div className="hero-topline mono"><span>INDEPENDENT HARDWARE / FAMILIAR FEELING</span><span>FPGA CONSOLE — REV C</span></div>
        <div className="hero-layout" data-console-tilt>
          <div className="hero-copy">
            <h1 id="hero-title">Old soul.<br/><span>New hardware.</span></h1>
            <div className="hero-intro"><p>Your cartridges. Your big screen.<br/>An FPGA console for the games<br className="desktop-only"/> that never left you.</p></div>
            <div className="hero-actions">
              <Dialog>
                <DialogTrigger className="preorder-button">Preorder <ArrowUpRight size={18}/></DialogTrigger>
                <DialogContent className="preorder-dialog" showCloseButton={false}>
                  <span className="mono preorder-eyebrow"><span className="status-dot"/> SGBC / COMING SOON</span>
                  <DialogTitle className="preorder-title">Preorders<br/>opening soon.</DialogTitle>
                  <DialogDescription className="preorder-description">We’re getting SGBC ready for its next chapter. Pricing and availability will be announced when preorders open.</DialogDescription>
                  <DialogClose className="preorder-button preorder-dismiss">Back to the console <ArrowUpRight size={18}/></DialogClose>
                </DialogContent>
              </Dialog>
              <a className="text-link" href="#specs">Explore the hardware <ArrowDown size={18}/></a>
            </div>
          </div>
          <div className="hero-stage">
            <div className="stage-wordmark" aria-hidden="true">sgbc<span>™</span></div>
            <ConsoleScene view="hero" interaction="cursor" dark />
            <div className="stage-corner mono"><Plus size={18}/><span>THE CONSOLE<br/><span className="muted">ENCLOSURE STUDY / 001</span></span></div>
          </div>
          <span className="hero-number mono">(01—03)</span>
        </div>
      </section>
      <section className="manifesto section-shell" aria-labelledby="story-title">
        <div className="section-kicker mono"><span><span className="status-dot"/> BUILT AROUND THE RITUAL</span><Plus size={20}/></div>
        <h2 id="story-title">Keep the cartridges.<br/>Change the <span>possibilities.</span></h2>
        <figure className="cartridge-display">
          <Image
            src="/images/cartridge-lineup.webp"
            alt="Three floating Game Boy and Game Boy Color cartridges with translucent clear, blue, and Bordeaux shells."
            width={1672}
            height={941}
            sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1156px) calc(100vw - 56px), 1100px"
            loading="lazy"
            draggable={false}
          />
        </figure>
        <div className="manifesto-bottom"><p>The click of a cartridge. A controller you know by heart. SGBC brings programmable hardware to a console designed around three generations of handheld classics.</p><div className="system-list" aria-label="Intended cartridge families"><span>GAME BOY</span><span>GAME BOY COLOR</span><span>GAME BOY ADVANCE</span></div></div>
      </section>
      <section className="design-section section-shell" id="design" aria-labelledby="design-title">
        <div className="section-kicker mono"><span>02 / THE OBJECT</span><span>CLASSIC GRAY. BLACK. BORDEAUX.</span></div>
        <div className="section-heading"><h2 id="design-title">Every angle.<br/><span>Every detail.</span></h2><p>A look at the enclosure study.<br/>From the outside, in.</p></div>
        <Tabs value={detailView} onValueChange={value => { setDetailView(value as ConsoleView); setDetailReset(n => n + 1); }} className="design-tabs">
          <TabsList className="view-tabs" aria-label="Console viewing angle">{views.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}</TabsList>
          <div className="design-grid"><div className="detail-stage"><LazyScene view={detailView} resetKey={detailReset}/><div className="viewer-bottom mono"><span>ENCLOSURE / ASSEMBLY STUDY</span><button className="reset-view" onClick={() => setDetailReset(n => n + 1)} aria-label="Reset detail view"><RotateCcw size={18}/></button></div></div><div className="detail-copy">{views.map((v, i) => <TabsContent value={v.id} key={v.id}><span className="detail-number mono">[ 0{i + 1} ]</span><h3>{v.title}</h3><p>{v.description}</p></TabsContent>)}<div className="material-strip"><span><i className="shell-swatch"/>Gray</span><span><i className="black-swatch"/>Black</span><span><i className="bordeaux-swatch"/>Bordeaux</span></div></div></div>
        </Tabs>
      </section>
      <section className="specs section-shell" id="specs" aria-labelledby="specs-title">
        <div className="specs-heading"><p className="mono section-label">03 / THE PARTICULARS</p><h2 id="specs-title">Small footprint.<br/><span>Real hardware.</span></h2><p className="revision-label mono"><span className="status-dot"/> REV C / IN DEVELOPMENT</p></div>
        <div><dl className="spec-table">{specs.map(([label, value], i) => <div className="spec-row" key={label}><dt><span className="mono">{String(i + 1).padStart(2, '0')}</span>{label}</dt><dd>{value}</dd></div>)}</dl><p className="model-note">An independent engineering prototype. Hardware integration, game compatibility, and final specifications are still being validated. Console renders show the earlier enclosure assembly.</p></div>
      </section>
      <section className="closing"><p className="mono">A NEW HOME FOR YOUR CLASSICS.</p><a href="#console" aria-label="Back to the console">Still game.<ArrowUpRight aria-hidden="true"/></a><div className="closing-bottom mono"><span>SGBC / AN INDEPENDENT PROJECT</span><span>BUILT FOR THE GAMES THAT STAY.</span></div></section>
    </main>
    <footer className="site-footer"><a className="wordmark" href="#console" aria-label="SGBC home">sgbc<span>™</span></a><p>Game Boy, Game Boy Color, and Game Boy Advance are trademarks of Nintendo.<br/>SGBC is an independent project and is not affiliated with Nintendo.</p><a className="mono" href="#console">BACK TO TOP <ArrowUp size={16}/></a></footer>
  </>;
}
