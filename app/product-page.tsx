'use client';

import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUpRight, ArrowUp, Download, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ConsoleView } from './console-scene';

const ConsoleScene = dynamic(() => import('./console-scene'), { ssr: false });
const modelUrl = '/models/sgbc-revc-it6263.glb';
const views: { id: ConsoleView; label: string; title: string; description: string }[] = [
  { id: 'hero', label: 'Overview', title: 'A familiar shape.\nIts own character.', description: 'Warm gray up top. Black underneath. Bordeaux on the details you touch. A compact home for the cartridges you kept.' },
  { id: 'top', label: 'Top', title: 'The ritual\nstarts here.', description: 'An upright cartridge slot, dedicated power and reset buttons, and a clean top surface. Simple things, given room to breathe.' },
  { id: 'rear', label: 'Connections', title: 'Meet your\nbig screen.', description: 'Explore the HDMI and USB-C openings in the enclosure study. A familiar controller connection brings the setup together.' },
  { id: 'inside', label: 'Cutaway', title: 'Take the\nroof off.', description: 'Look through the earlier enclosure assembly: cartridge carrier, controls, and motherboard placement. The latest IT6263 board is shown separately above.' },
];
const boardViews: { id: ConsoleView; label: string }[] = [
  { id: 'hero', label: 'Perspective' }, { id: 'top', label: 'Top' }, { id: 'bottom', label: 'Bottom' },
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

function LazyScene({ view, resetKey, model = 'console' }: { view: ConsoleView; resetKey: number; model?: 'console' | 'pcb' }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div className="lazy-scene" ref={host}>{ready && <ConsoleScene view={view} resetKey={resetKey} model={model} dark />}</div>;
}

export default function ProductPage() {
  const [heroReset, setHeroReset] = useState(0);
  const [boardView, setBoardView] = useState<ConsoleView>('hero');
  const [boardReset, setBoardReset] = useState(0);
  const [detailView, setDetailView] = useState<ConsoleView>('hero');
  const [detailReset, setDetailReset] = useState(0);

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#console" aria-label="SGBC home">sgbc<span>™</span></a>
      <nav aria-label="Main navigation"><a href="#console">Console <sup>01</sup></a><a href="#board">Motherboard <sup>02</sup></a><a href="#design">Design <sup>03</sup></a><a href="#specs">Specs <sup>04</sup></a></nav>
      <a href="#board" className="nav-status"><span className="status-dot"/> Rev C <ArrowUpRight size={15}/></a>
    </header>
    <main id="main">
      <section className="hero" id="console" aria-labelledby="hero-title">
        <div className="hero-topline mono"><span>INDEPENDENT HARDWARE / FAMILIAR FEELING</span><span>FPGA CONSOLE — REV C</span></div>
        <div className="hero-stage">
          <div className="stage-wordmark" aria-hidden="true">sgbc<span>™</span></div>
          <ConsoleScene view="hero" resetKey={heroReset} dark />
          <div className="stage-corner mono"><Plus size={18}/><span>THE CONSOLE<br/><span className="muted">ENCLOSURE STUDY / 001</span></span></div>
          <button className="reset-view" onClick={() => setHeroReset(n => n + 1)} aria-label="Reset console rotation"><RotateCcw size={18}/></button>
          <a className="hero-board-link mono" href="#board"><span className="status-dot"/> NEW PCB MODEL <ArrowDown size={16}/></a>
        </div>
        <div className="hero-bottom"><h1 id="hero-title">Old soul.<br/><span>New hardware.</span></h1><div className="hero-intro"><p>Your cartridges. Your big screen.<br/>An FPGA console for the games<br className="desktop-only"/> that never left you.</p><a className="text-link" href="#board">Explore the hardware <ArrowDown size={18}/></a></div><span className="hero-number mono">(01—04)</span></div>
      </section>
      <section className="manifesto section-shell" aria-labelledby="story-title">
        <div className="section-kicker mono"><span><span className="status-dot"/> BUILT AROUND THE RITUAL</span><Plus size={20}/></div>
        <h2 id="story-title">Keep the cartridges.<br/>Change the <span>possibilities.</span></h2>
        <div className="manifesto-bottom"><p>The click of a cartridge. A controller you know by heart. SGBC brings programmable hardware to a console designed around three generations of handheld classics.</p><div className="system-list" aria-label="Intended cartridge families"><span>GAME BOY</span><span>GAME BOY COLOR</span><span>GAME BOY ADVANCE</span></div></div>
      </section>
      <section className="board-section section-shell" id="board" aria-labelledby="board-title">
        <div className="section-kicker mono"><span>02 / UNDER THE SURFACE</span><span className="revision-tag">LATEST BOARD · IT6263</span></div>
        <div className="section-heading"><h2 id="board-title">No shell.<br/><span>All substance.</span></h2><p>The current Rev C motherboard.<br/>Turn it over. Follow the connections.<br/>Get closer to the hardware.</p></div>
        <Tabs value={boardView} onValueChange={value => { setBoardView(value as ConsoleView); setBoardReset(n => n + 1); }} className="board-tabs">
          <div className="viewer-toolbar"><TabsList className="view-tabs" aria-label="Motherboard viewing angle">{boardViews.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}</TabsList><a className="download-link mono" href={modelUrl} download="SGBC_RevC_IT6263.glb">GET GLB <Download size={16}/></a></div>
          <div className="board-stage">
            <span className="board-watermark" aria-hidden="true">REV C</span>
            <LazyScene view={boardView} resetKey={boardReset} model="pcb"/>
            <div className="viewer-top mono"><span>IT6263FN/BX</span><span>130 × 95 MM</span></div>
            <div className="viewer-bottom mono"><span><span className="desktop-hint">DRAG TO ROTATE / ARROW KEYS</span><span className="touch-hint">TWO FINGERS TO ROTATE</span></span><button className="reset-view" onClick={() => setBoardReset(n => n + 1)} aria-label="Reset motherboard rotation"><RotateCcw size={18}/></button></div>
          </div>
          {boardViews.map(v => <TabsContent value={v.id} key={v.id} className="view-caption mono">{v.label} / native KiCad board export / 22.95 MB</TabsContent>)}
        </Tabs>
        <div className="board-facts"><div><span className="mono">01 / COMPUTE</span><strong>Efinix T85</strong><p>Programmable hardware at the center.</p></div><div><span className="mono">02 / VIDEO</span><strong>ITE IT6263</strong><p>The revised HDMI transmitter.</p></div><div><span className="mono">03 / CONNECT</span><strong>USB-C</strong><p>Power and onboard JTAG programming.</p></div></div>
        <p className="model-note">Engineering review model. Some component bodies use nominal substitutes; this export does not confirm hardware operation or enclosure fit.</p>
      </section>
      <section className="design-section section-shell" id="design" aria-labelledby="design-title">
        <div className="section-kicker mono"><span>03 / THE OBJECT</span><span>CLASSIC GRAY. BLACK. BORDEAUX.</span></div>
        <div className="section-heading"><h2 id="design-title">Every angle.<br/><span>Every detail.</span></h2><p>A look at the enclosure study.<br/>From the outside, in.</p></div>
        <Tabs value={detailView} onValueChange={value => { setDetailView(value as ConsoleView); setDetailReset(n => n + 1); }} className="design-tabs">
          <TabsList className="view-tabs" aria-label="Console viewing angle">{views.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}</TabsList>
          <div className="design-grid"><div className="detail-stage"><LazyScene view={detailView} resetKey={detailReset}/><div className="viewer-bottom mono"><span>ENCLOSURE / ASSEMBLY STUDY</span><button className="reset-view" onClick={() => setDetailReset(n => n + 1)} aria-label="Reset detail view"><RotateCcw size={18}/></button></div></div><div className="detail-copy">{views.map((v, i) => <TabsContent value={v.id} key={v.id}><span className="detail-number mono">[ 0{i + 1} ]</span><h3>{v.title}</h3><p>{v.description}</p></TabsContent>)}<div className="material-strip"><span><i className="shell-swatch"/>Gray</span><span><i className="black-swatch"/>Black</span><span><i className="bordeaux-swatch"/>Bordeaux</span></div></div></div>
        </Tabs>
      </section>
      <section className="specs section-shell" id="specs" aria-labelledby="specs-title">
        <div className="specs-heading"><p className="mono section-label">04 / THE PARTICULARS</p><h2 id="specs-title">Small footprint.<br/><span>Real hardware.</span></h2><p className="revision-label mono"><span className="status-dot"/> REV C / IN DEVELOPMENT</p></div>
        <div><dl className="spec-table">{specs.map(([label, value], i) => <div className="spec-row" key={label}><dt><span className="mono">{String(i + 1).padStart(2, '0')}</span>{label}</dt><dd>{value}</dd></div>)}</dl><p className="model-note">An independent engineering prototype. Hardware integration, game compatibility, and final specifications are still being validated. Console renders show the earlier enclosure assembly; the separate PCB viewer shows the current IT6263 revision.</p></div>
      </section>
      <section className="closing"><p className="mono">A NEW HOME FOR YOUR CLASSICS.</p><a href="#console" aria-label="Back to the console">Still game.<ArrowUpRight aria-hidden="true"/></a><div className="closing-bottom mono"><span>SGBC / AN INDEPENDENT PROJECT</span><span>BUILT FOR THE GAMES THAT STAY.</span></div></section>
    </main>
    <footer className="site-footer"><a className="wordmark" href="#console" aria-label="SGBC home">sgbc<span>™</span></a><p>Game Boy, Game Boy Color, and Game Boy Advance are trademarks of Nintendo.<br/>SGBC is an independent project and is not affiliated with Nintendo.</p><a className="mono" href="#console">BACK TO TOP <ArrowUp size={16}/></a></footer>
  </>;
}
