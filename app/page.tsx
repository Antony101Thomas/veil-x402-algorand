'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardPath, readSession } from '@/lib/session';

const FLOW_STEPS = [
  {
    code: '01',
    label: 'Browse',
    detail: 'Pick your GPU tier & session length.',
  },
  {
    code: '02',
    label: '402',
    detail: 'Server replies Payment Required with x402 terms.',
  },
  {
    code: '03',
    label: 'Pay',
    detail: 'Agent/User settles USDC payment on Algorand.',
  },
  {
    code: '04',
    label: 'Credential',
    detail: 'HyperDeck mints an on-chain session capability.',
  },
  {
    code: '05',
    label: 'Connect',
    detail: 'Stream full-power gaming & rendering instantly.',
  },
];

const FEATURES = [
  {
    title: 'Instant Hardware Scaling',
    body: 'No local GPU required. Stream up to RTX 4090 power directly to any web browser or screen.',
  },
  {
    title: 'Pay-Per-Session (x402)',
    body: 'Zero monthly subscriptions. Pay only for the exact hours you rent using Algorand cryptocurrency.',
  },
  {
    title: 'Cryptographic Session Auth',
    body: 'Your session access is bound to a single-use disposable keypair verified against Algorand box storage.',
  },
  {
    title: 'Instant Admin Revocation',
    body: 'Sessions can be cut on-chain immediately if security or policy violations occur.',
  },
  {
    title: 'Reward Points per Hour',
    body: 'Earn 10 points for every $1 spent. Redeem 100 points for free rental session discounts.',
  },
  {
    title: 'Community Rig Ratings',
    body: 'User ratings and performance reviews ensure you get peak FPS and low latency every time.',
  },
];

function useRevealOnScroll() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function useTypewriter(text: string, speed = 40, start = true) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    if (!start) return;
    setOutput('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOutput(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, start]);

  return output;
}

function useTypewriterLines(lines: string[], speed = 16, start = true) {
  const [output, setOutput] = useState<string[]>(() => lines.map(() => ''));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!start) return;
    setOutput(lines.map(() => ''));
    setDone(false);
    let lineIndex = 0;
    let charIndex = 0;
    const id = setInterval(() => {
      setOutput((prev) => {
        if (lineIndex >= lines.length) {
          clearInterval(id);
          setDone(true);
          return prev;
        }
        const next = [...prev];
        charIndex += 1;
        next[lineIndex] = lines[lineIndex].slice(0, charIndex);
        if (charIndex >= lines[lineIndex].length) {
          lineIndex += 1;
          charIndex = 0;
        }
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [start, speed]);

  return { lines: output, done };
}

const HERO_HEADLINE_PREFIX = 'Rent a Rig. Pay with Crypto. ';
const HERO_HEADLINE_ACCENT = 'Game at Full Power.';

const TRANSCRIPT_LINE_DEFS = [
  { text: 'GET /api/sessions/connect?rig=rig-beast&hours=2', className: 'line line--muted' },
  { text: '402 Payment Required', className: 'line line--warn' },
  { text: 'x402-pay: algorand · price=3.00 USDC', className: 'line line--muted' },
  { text: 'settling payment on Algorand TestNet...', className: 'line line--muted' },
  { text: '200 OK — Session Credential Issued', className: 'line line--ok' },
  { text: '{ rig: "RTX 4090", fps: 240, status: "streaming", rdp: "rdp://hyperdesk.io/session/HD-908" }', className: 'line line--muted' },
];

export default function LandingPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setHasSession(true);
      router.replace(dashboardPath(session.role));
    } else {
      setHasSession(false);
    }
  }, [router]);

  if (hasSession === true) {
    return <div style={{ minHeight: '100vh', background: '#000' }} />;
  }

  const typedHeadline = useTypewriter(HERO_HEADLINE_PREFIX + HERO_HEADLINE_ACCENT, 35, true);
  const typedPrefix = typedHeadline.slice(0, HERO_HEADLINE_PREFIX.length);
  const typedAccent = typedHeadline.slice(HERO_HEADLINE_PREFIX.length);
  const headlineDone = typedHeadline.length >= HERO_HEADLINE_PREFIX.length + HERO_HEADLINE_ACCENT.length;

  const { ref: transcriptRef, visible: transcriptVisible } = useRevealOnScroll();
  const { lines: transcriptLines, done: transcriptDone } =
    useTypewriterLines(TRANSCRIPT_LINE_DEFS.map((l) => l.text), 16, transcriptVisible);


  return (
    <main className="novadeck-landing">
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="hero__inner">
          <p className="eyebrow">⚡ HYPERDESK · CLOUD RIG RENTALS</p>
          <h1 className="hero__headline">
            {typedPrefix}
            <span className="accent-text">{typedAccent}</span>
            {!headlineDone && <span className="caret" aria-hidden="true" />}
          </h1>
          <p className="hero__sub">
            HyperDesk grants on-demand access to high-performance virtual PCs.
            Choose your GPU specs, pay per session with x402 on Algorand, and stream
            RTX 4090 power directly to your browser.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="/rigs">
              Browse Rigs
            </a>
            <a className="btn btn--ghost" href="/login">
              Sign In
            </a>
          </div>
        </div>

        <div
          ref={transcriptRef as React.RefObject<HTMLDivElement>}
          className={`transcript-wrap reveal ${transcriptVisible ? 'reveal--visible' : ''}`}
          style={{ transitionDelay: '120ms' }}
        >
          <div className="transcript">
            <div className="transcript__bar">
              <span className="dot dot--red" />
              <span className="dot dot--amber" />
              <span className="dot dot--green" />
              <span className="transcript__title">HyperDesk Session Stream</span>
            </div>
            <pre className="transcript__body">
              <code>
                {TRANSCRIPT_LINE_DEFS.map((def, i) => (
                  <span key={i}>
                    <span className={def.className}>{transcriptLines[i]}</span>
                    {i < TRANSCRIPT_LINE_DEFS.length - 1 ? '\n' : null}
                  </span>
                ))}
                {!transcriptDone && <span className="caret" aria-hidden="true" />}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <Reveal className="stats">
        <div className="stats__grid">
          <div className="stat">
            <span className="stat__num">3</span>
            <span className="stat__label">rig tiers (RTX 3060 to 4090)</span>
          </div>
          <div className="stat">
            <span className="stat__num">x402</span>
            <span className="stat__label">native crypto pay-per-session</span>
          </div>
          <div className="stat">
            <span className="stat__num">100%</span>
            <span className="stat__label">on-chain capability security</span>
          </div>
          <div className="stat">
            <span className="stat__num">10 pts</span>
            <span className="stat__label">reward points earned per $1</span>
          </div>
        </div>
      </Reveal>

      {/* ---------- FLOW ---------- */}
      <section className="flow">
        <Reveal>
          <p className="section-eyebrow">How It Works</p>
          <h2 className="section-title">Five steps to cloud gaming freedom</h2>
        </Reveal>
        <div className="flow__strip">
          {FLOW_STEPS.map((step, i) => (
            <Reveal key={step.code} delay={i * 90} className="flow__step-wrap">
              <div className="flow__step">
                <span className="flow__code">{step.code}</span>
                <h3 className="flow__label">{step.label}</h3>
                <p className="flow__detail">{step.detail}</p>
              </div>
              {i < FLOW_STEPS.length - 1 && <span className="flow__connector" />}
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- RIG TIERS PREVIEW ---------- */}
      <section className="rig-preview-section">
        <Reveal>
          <p className="section-eyebrow">Rig Fleet</p>
          <h2 className="section-title">Choose your power tier</h2>
        </Reveal>
        <div className="rig-preview-grid">
          <Reveal delay={100} className="preview-card">
            <span className="preview-badge">STARTER</span>
            <h3>Starter Rig</h3>
            <p className="preview-spec">RTX 3060 12GB · Ryzen 5 5600X · 16GB RAM</p>
            <div className="preview-price">$0.50 <span>/ hr</span></div>
            <a href="/rigs" className="btn-preview">Rent Starter</a>
          </Reveal>
          <Reveal delay={200} className="preview-card preview-card--featured">
            <span className="preview-badge preview-badge--accent">MOST POPULAR</span>
            <h3>Pro Rig</h3>
            <p className="preview-spec">RTX 4070 Ti 12GB · i9-13900K · 32GB RAM</p>
            <div className="preview-price">$1.50 <span>/ hr</span></div>
            <a href="/rigs" className="btn-preview btn-preview--accent">Rent Pro</a>
          </Reveal>
          <Reveal delay={300} className="preview-card">
            <span className="preview-badge">BEAST</span>
            <h3>Beast Rig</h3>
            <p className="preview-spec">RTX 4090 24GB · Ryzen 9 7950X · 64GB RAM</p>
            <div className="preview-price">$3.00 <span>/ hr</span></div>
            <a href="/rigs" className="btn-preview">Rent Beast</a>
          </Reveal>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="security">
        <Reveal>
          <p className="section-eyebrow">Why HyperDesk</p>
          <h2 className="section-title">Built for speed, backed by Algorand</h2>
        </Reveal>
        <div className="security__grid">
          {FEATURES.map((feat, i) => (
            <Reveal key={feat.title} delay={i * 60} className="security__card">
              <h3>{feat.title}</h3>
              <p>{feat.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="footer">
        <div className="footer__top">
          <span className="footer__brand">HyperDesk</span>
          <nav className="footer__routes">
            <a href="/rigs">Browse Rigs</a>
            <a href="/sessions">My Sessions</a>
            <a href="/rewards">Rewards</a>
            <a href="/login">Sign In</a>
            <a href="/admin">Admin Console</a>
          </nav>
        </div>
        <p className="footer__note">
          HyperDesk — Instant Cloud PC rentals powered by x402 payments on Algorand.
        </p>
      </footer>

      <style jsx>{`
        .novadeck-landing {
          --bg: var(--bg, #0f0f0f);
          --surface: var(--surface, #181818);
          --border: var(--border, #303030);
          --text: var(--text, #f1f1f1);
          --text-muted: var(--text-muted, #aaaaaa);
          --accent: var(--accent, #ff0000);
          background: var(--bg);
          color: var(--text);
          font-family: system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
        }
        .accent-text { color: var(--accent); }
        .eyebrow, .section-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 700;
          margin: 0 0 12px;
        }
        .section-title {
          font-size: clamp(1.5rem, 3vw, 2.15rem);
          font-weight: 700;
          line-height: 1.25;
          margin: 0 0 40px;
        }
        .reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal--visible { opacity: 1; transform: translateY(0); }
        .hero {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 56px;
          align-items: center;
          max-width: 1180px;
          margin: 0 auto;
          padding: 96px 32px 72px;
        }
        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; gap: 36px; padding-top: 48px; }
        }
        .hero__headline {
          font-size: clamp(2.2rem, 4.5vw, 3.2rem);
          line-height: 1.1;
          font-weight: 800;
          margin: 0 0 22px;
        }
        .hero__sub {
          color: var(--text-muted);
          font-size: 1.05rem;
          line-height: 1.65;
          margin: 0 0 32px;
        }
        .hero__cta { display: flex; gap: 14px; }
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 12px 26px;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .btn--primary { background: var(--btn-bg); color: var(--btn-text); }
        .btn--primary:hover { transform: translateY(-2px); opacity: 0.9; }
        .btn--ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn--ghost:hover { border-color: var(--accent); }
        .caret {
          display: inline-block;
          width: 2px;
          height: 0.9em;
          margin-left: 3px;
          background: currentColor;
          animation: caret-blink 1s step-end infinite;
        }
        @keyframes caret-blink { 50% { opacity: 0; } }
        .transcript {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        .transcript__bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot--red { background: #ff5f57; }
        .dot--amber { background: #febc2e; }
        .dot--green { background: #28c840; }
        .transcript__title { margin-left: 8px; font-size: 0.78rem; color: var(--text-muted); font-family: monospace; }
        .transcript__body { margin: 0; padding: 20px 18px; font-family: monospace; font-size: 0.82rem; line-height: 1.8; }
        .line--muted { color: var(--text-muted); }
        .line--warn { color: #febc2e; font-weight: 600; }
        .line--ok { color: #3ddc84; font-weight: 600; }
        .stats { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--surface); }
        .stats__grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 40px 32px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        @media (max-width: 700px) { .stats__grid { grid-template-columns: repeat(2, 1fr); } }
        .stat__num { font-size: 2rem; font-weight: 800; color: var(--text); }
        .stat__label { font-size: 0.85rem; color: var(--text-muted); }
        .flow { max-width: 1180px; margin: 0 auto; padding: 88px 32px; }
        .flow__strip { display: flex; gap: 12px; flex-wrap: wrap; }
        .flow__step-wrap { flex: 1 1 180px; }
        .flow__step { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 18px; min-height: 140px; }
        .flow__code { font-family: monospace; font-size: 0.75rem; color: var(--text); font-weight: 700; }
        .flow__label { font-size: 1.05rem; font-weight: 700; margin: 8px 0 6px; }
        .flow__detail { font-size: 0.85rem; color: var(--text-muted); margin: 0; }
        .rig-preview-section { max-width: 1180px; margin: 0 auto; padding: 0 32px 88px; }
        .rig-preview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 900px) { .rig-preview-grid { grid-template-columns: 1fr; } }
        .preview-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
        }
        .preview-card--featured { border-color: var(--accent); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); }
        .preview-badge { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.1em; }
        .preview-badge--accent { color: var(--text); }
        .preview-spec { color: var(--text-muted); font-size: 0.85rem; margin: 0; }
        .preview-price { font-size: 1.8rem; font-weight: 800; color: var(--text); margin-top: auto; }
        .preview-price span { font-size: 0.9rem; color: var(--text-muted); }
        .btn-preview {
          display: block;
          text-align: center;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.9rem;
          transition: all 0.15s ease;
        }
        .btn-preview:hover { border-color: var(--accent); }
        .btn-preview--accent { background: var(--btn-bg); color: var(--btn-text); border: none; }
        .btn-preview--accent:hover { opacity: 0.9; }
        .security { background: var(--surface); border-top: 1px solid var(--border); padding: 88px 32px; }
        .security__grid { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 900px) { .security__grid { grid-template-columns: 1fr; } }
        .security__card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 22px; }
        .security__card h3 { font-size: 1rem; font-weight: 700; margin: 0 0 8px; }
        .security__card p { font-size: 0.87rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
        .footer { max-width: 1180px; margin: 0 auto; padding: 60px 32px; border-top: 1px solid var(--border); }
        .footer__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .footer__brand { font-size: 1.3rem; font-weight: 800; color: var(--text); }
        .footer__routes { display: flex; gap: 20px; }
        .footer__routes a { color: var(--text-muted); text-decoration: none; font-size: 0.88rem; }
        .footer__routes a:hover { color: var(--text); }
        .footer__note { color: var(--text-muted); font-size: 0.82rem; margin: 0; }

      `}</style>
    </main>
  );
}