import Image from 'next/image';
import type { siteCopy } from '@/lib/site-copy';
import styles from './feature-section.module.css';

const featureKinds = ['display', 'upscaling', 'link', 'speed', 'controller', 'storage', 'dump'] as const;
type FeatureKind = typeof featureKinds[number];

function Dpad({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 4} ${y - 12}h8v8h8v8h-8v8h-8v-8h-8v-8h8z`} fill="currentColor"/>;
}

function Handheld({ x, y, color = 'var(--feature-shell)' }: { x: number; y: number; color?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M0 9Q0 0 9 0h48q9 0 9 9v102q0 18-18 18H9q-9 0-9-9z" fill={color} stroke="var(--feature-edge)"/>
    <rect x="7" y="11" width="52" height="49" rx="4" fill="#242522"/>
    <rect x="13" y="17" width="40" height="34" rx="1" fill="#65705a"/>
    <path d="M17 43h8v-8h8v-8h8v-5h8" fill="none" stroke="#b4bea3" strokeWidth="3"/>
    <g color="#30312d"><Dpad x={21} y={82}/></g>
    <g fill="var(--feature-wine)"><circle cx="45" cy="88" r="5"/><circle cx="56" cy="79" r="5"/></g>
    <path d="M25 108h7m6 0h7" stroke="#686b61" strokeWidth="3" strokeLinecap="round"/>
  </g>;
}

function MicroSD({ x, y, color = 'var(--feature-wine)' }: { x: number; y: number; color?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M20 0h52q8 0 8 8v98q0 8-8 8H8q-8 0-8-8V20z" fill={color} stroke="#a98c91" strokeWidth="1.5"/>
    <path d="M22 7h7v23h-7zm12 0h7v23h-7zm12 0h7v23h-7zm12 0h7v23h-7z" fill="#c6bc91"/>
    <rect x="12" y="42" width="56" height="57" rx="4" fill="#321f28"/>
    <path d="M29 56h15l10 10v21H29z" stroke="#d3b8bd" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M44 56v10h10M35 74h13m-13 6h9" stroke="#d3b8bd" strokeWidth="1.5"/>
  </g>;
}

function FeatureIllustration({ kind }: { kind: FeatureKind }) {
  return <svg viewBox="0 0 320 190" className={styles.art} aria-hidden="true" focusable="false" fill="none">
    {kind === 'display' && <>
      <path d="M145 150v15h-27m57-15v15h27M112 168h96" stroke="#929689" strokeWidth="3" strokeLinecap="round"/>
      <rect x="42" y="18" width="236" height="134" rx="7" fill="#252723" stroke="#9c9f94" strokeWidth="1.5"/>
      <rect x="50" y="26" width="220" height="117" rx="2" fill="#151d18"/>
      <path d="M50 120h220v23H50z" fill="#334938"/>
      <path d="M50 120v-16h30V88h30V72h30v48m40 0V88h30V72h30V56h30v64" fill="#4e6950"/>
      <g fill="#d3dcc2"><path d="M139 59h24v8h8v24h-8v8h-24v-8h-8V67h8z"/><path d="M139 99h8v14h-8zm16 0h8v14h-8z"/></g>
      <path d="M146 70h4v5h-4zm12 0h4v5h-4z" fill="#27362a"/>
      <path d="M65 40h19m-19 0v19m190-19h-19m19 0v19M65 130h19m-19 0v-19m190 19h-19m19 0v-19" stroke="#c1c9b6" strokeWidth="1" opacity=".7"/>
      <circle cx="260" cy="147" r="2" fill="var(--accent)"/>
    </>}
    {kind === 'upscaling' && <>
      <rect x="26" y="65" width="66" height="66" rx="3" fill="#1c251e" stroke="#7d8974" strokeWidth="1.5"/>
      <path d="M39 115V83h8v8h8v8h8v8h8v8z" fill="#b9c8a8"/>
      <path d="M106 98h40m-10-9 10 9-10 9" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="166" y="35" width="130" height="130" rx="5" fill="#1c251e" stroke="#a1ad93" strokeWidth="1.5"/>
      <path d="M192 135V71h16v16h16v16h16v16h16v16z" fill="#b9c8a8"/>
      <path d="M192 55v96m16-96v96m16-96v96m16-96v96m16-96v96m-80-80h96m-96 16h96m-96 16h96m-96 16h96m-96 16h96" stroke="#6d805f" strokeWidth=".7" opacity=".55"/>
      <path d="M163 50V29h21m96 0h21v21m0 100v21h-21m-96 0h-21v-21" stroke="var(--feature-wine)" strokeWidth="2"/>
    </>}
    {kind === 'storage' && <>
      <ellipse cx="163" cy="169" rx="82" ry="7" fill="#000" opacity=".25"/>
      <g transform="rotate(-13 124 99)"><MicroSD x={81} y={37} color="#51594a"/></g>
      <g transform="rotate(9 190 91)"><MicroSD x={149} y={26}/></g>
      <path d="M239 45h15m-7-7v14M66 134h9" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
    </>}
    {kind === 'dump' && <>
      <g transform="translate(26 30)">
        <path d="M10 0h71v9h13v116H0V9h10z" fill="var(--feature-shell)" stroke="#d2d2c7" strokeWidth="1.5"/>
        <path d="M10 22h74M10 29h74M10 36h74" stroke="#878c7f"/>
        <rect x="11" y="48" width="72" height="57" rx="3" fill="var(--feature-wine)"/>
        <path d="M24 93l13-21 13 14 11-25 12 32z" fill="#b17b89"/>
        <path d="M42 114h10l-5 5z" fill="#72786b"/>
      </g>
      <path d="M136 92h53m-10-10 10 10-10 10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M137 113h4m8 0h4m8 0h4m8 0h4" stroke="#8b947c" strokeWidth="3"/>
      <MicroSD x={211} y={38}/>
    </>}
    {kind === 'link' && <>
      <path d="M93 33V20q0-9 10-9h113q10 0 10 9v13" stroke="#6e7667" strokeWidth="3"/>
      <path d="M124 99h72m-10-7 10 7-10 7m-52-14-10 7 10 7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <Handheld x={60} y={33}/><Handheld x={193} y={33} color="#959c88"/>
      <path d="M87 30h12m121 0h12" stroke="#c0c3b6" strokeWidth="5"/>
      <circle cx="159" cy="11" r="4" fill="var(--accent)"/>
    </>}
    {kind === 'speed' && <>
      <path d="M82 142a91 91 0 1 1 156 0" stroke="#30352d" strokeWidth="12" strokeLinecap="round"/>
      <path d="M82 142a91 91 0 1 1 156 0" pathLength="100" strokeDasharray="65 100" strokeDashoffset="-35" stroke="var(--feature-wine)" strokeWidth="12" strokeLinecap="round"/>
      <path d="M160 25v11m-59 13 8 8m-33 47h11m146 0h11m-25-55-8 8" stroke="#a0a790" strokeWidth="2"/>
      <path d="m160 112 48-48" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="160" cy="112" r="9" fill="#c8cbbb"/><circle cx="160" cy="112" r="3" fill="#22261e"/>
      <path d="m140 148 13 9-13 9zm19 0 13 9-13 9z" fill="#bec5ad"/>
      <path d="M52 91h-9m13 14H34m22 14H43" stroke="#626b55" strokeWidth="2" strokeLinecap="round"/>
    </>}
    {kind === 'controller' && <>
      <path d="M160 66V37q0-18 24-18h47" stroke="#7a806f" strokeWidth="3" strokeLinecap="round"/>
      <g transform="rotate(-8 160 112)">
        <path d="M94 62h132c30 0 51 24 48 55-3 31-35 50-61 34l-23-15h-59l-23 15c-27 16-59-3-62-34-3-31 18-55 48-55Z" fill="var(--feature-shell)" stroke="#d0d2c4" strokeWidth="1.5"/>
        <path d="M87 71h33m80 0h33" stroke="#747a6c" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="96" cy="109" r="27" fill="#858d7b"/><g color="#30372e"><Dpad x={96} y={109}/></g>
        <path d="m140 116 11-7m10 7 11-7" stroke="#5c6355" strokeWidth="5" strokeLinecap="round"/>
        <g fill="var(--feature-wine)" stroke="#6c3e49"><circle cx="215" cy="94" r="9"/><circle cx="234" cy="111" r="9"/><circle cx="197" cy="111" r="9"/><circle cx="215" cy="128" r="9"/></g>
      </g>
    </>}
  </svg>;
}

export function FeatureSection({ copy, story }: { copy: typeof siteCopy.en.specs; story: typeof siteCopy.en.story }) {
  return <section className={`section-shell ${styles.section}`} id="specs" aria-labelledby="story-title">
    <div className={styles.kicker}>
      <p className={`mono ${styles.eyebrow}`}><span className="status-dot"/>02 / {story.eyebrow}</p>
      <p className={`mono ${styles.revision}`}>{copy.revision}</p>
    </div>
    <div className={styles.intro}>
      <div className={styles.story}>
        <h2 id="story-title">{story.title}<br/>{story.lead}<span>{story.accent}</span></h2>
        <p className={styles.description}>{story.description}</p>
        <ul className={styles.systems} aria-label={story.systems}>
          <li>GAME BOY</li><li>GAME BOY COLOR</li><li>GAME BOY ADVANCE</li>
        </ul>
      </div>
      <figure className={styles.cartridges}>
        <Image src="/images/cartridge-lineup.webp" alt={story.alt} width={1672} height={941}
          sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1800px) 55vw, 940px"
          loading="lazy" draggable={false}/>
      </figure>
    </div>
    <div className={styles.heading}>
      <h3 id="specs-title">{copy.title} <span>{copy.subtitle}</span></h3>
      <p className={`mono ${styles.eyebrow}`}>{copy.eyebrow}</p>
    </div>
    <div className={styles.grid}>
      {featureKinds.map((kind, index) => {
        const [title, description] = copy.features[kind];
        return <article className={styles.card} key={kind} data-feature={kind}>
          <div className={styles.visual}>
            <span className={`mono ${styles.number}`} aria-hidden="true">0{index + 1}</span>
            <FeatureIllustration kind={kind}/>
          </div>
          <div className={styles.copy}><h4>{title}</h4><p>{description}</p></div>
        </article>;
      })}
    </div>
    <p className={styles.note}>{copy.note}</p>
  </section>;
}
