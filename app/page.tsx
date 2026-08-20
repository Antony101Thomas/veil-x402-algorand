'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Veil — landing page (app/page.tsx)
 *
 * Drop this in at app/page.tsx. It assumes the theme system already wired
 * in this project: `data-theme="dark" | "light"` set on <html>, with CSS
 * variables --bg, --surface, --border, --text, --text-muted, --accent
 * defined globally (as built in ThemeContext/globals.css). Every color
 * below falls back to a sane default via var(--token, fallback) so the
 * page still renders correctly even before those variables load.
 *
 * No external deps — motion is IntersectionObserver + CSS, so it doesn't
 * depend on framer-motion or any font not already loaded by the project.
 */

const SESSION_KEY = 'veil-session';

const FLOW_STEPS = [
  {
    code: '01',
    label: 'Request',
    detail: 'Agent calls GET /api/premium-data.',
  },
  {
    code: '02',
    label: '402',
    detail: 'Server replies Payment Required with x402 terms.',
  },
  {
    code: '03',
    label: 'Pay',
    detail: 'Agent signs and settles payment on Algorand.',
  },
  {
    code: '04',
    label: 'Capability',
    detail: 'Veil issues a scoped, quota-limited credential.',
  },
  {
    code: '05',
    label: 'Access',
    detail: 'Agent retries with the capability — 200 OK.',
  },
];

const SECURITY_LAYERS = [
  {
    title: 'Resource scope',
    body: 'A capability is valid for exactly one resource — nothing else it could ask for.',
  },
  {
    title: 'Action scope',
    body: 'READ does not imply WRITE. Each permission is named, not assumed.',
  },
  {
    title: 'Quota',
    body: 'Every capability carries a hard usage ceiling, decremented on each call.',
  },
  {
    title: 'Expiry',
    body: 'Access lapses automatically at a fixed round — no permanent keys, ever.',
  },
  {
    title: 'Nonce + signature',
    body: 'Every request proves fresh possession, so an old signed call can’t be replayed.',
  },
  {
    title: 'Revocation',
    body: 'The provider can cut access mid-session. The next call fails immediately.',
  },
];

const TEAM = [
  {
    role: 'Agent / x402',
    focus: 'LLM integration, tool calls, 402 handling, payment + retry logic.',
  },
  {
    role: 'Algorand / Contract',
    focus: 'Capability fields, box storage, create / read / revoke, TestNet deploy.',
  },
  {
    role: 'Web / Resource Server',
    focus: 'Dashboard, capability cards, admin revoke, protected endpoint.',
  },
];

const ROUTES = [
  { path: '/login', label: 'Sign in' },
  { path: '/agent', label: 'Agent dashboard' },
  { path: '/capabilities', label: 'Capabilities' },
  { path: '/admin', label: 'Admin' },
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

export default function LandingPage() {
  const [revoked, setRevoked] = useState(false);
  const router = useRouter();

  // Returning visitor with an existing demo session? Skip straight to their dashboard.
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as { role?: 'agent' | 'admin' };
      if (session.role === 'admin') router.replace('/admin');
      else if (session.role === 'agent') router.replace('/agent');
    } catch {
      // corrupted session value — ignore and let them see the landing page
    }
  }, [router]);

  return (
    <main className="veil-landing">
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="hero__inner">
          <p className="eyebrow">AGENTIC ACCESS · x402 + ALGORAND</p>
          <h1 className="hero__headline">
            Payment becomes <span className="accent-text">authorization.</span>
          </h1>
          <p className="hero__sub">
            Veil is an economic authorization layer for autonomous AI agents.
            An agent requests a paid resource, pays for it automatically over
            x402 on Algorand, and receives a temporary, scoped, revocable
            capability — not a long-lived API key.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="/agent">
              View agent dashboard
            </a>
            <a className="btn btn--ghost" href="/login">
              Sign in
            </a>
            <a className="btn btn--ghost" href="/login?mode=signup">
              Sign up
            </a>
          </div>
        </div>

        {/* Signature element: a live HTTP transcript that flips on revoke */}
        <Reveal className="transcript-wrap" delay={120}>
          <div className="transcript" role="group" aria-label="Veil request lifecycle">
            <div className="transcript__bar">
              <span className="dot dot--red" />
              <span className="dot dot--amber" />
              <span className="dot dot--green" />
              <span className="transcript__title">agent → /api/premium-data</span>
            </div>
            <pre className="transcript__body">
              <code>
                <span className="line line--muted">GET /api/premium-data</span>
                {'\n'}
                <span className="line line--warn">402 Payment Required</span>
                {'\n'}
                <span className="line line--muted">
                  x402-pay: algorand · amount=0.05 ALGO
                </span>
                {'\n'}
                <span className="line line--muted">retry with payment proof…</span>
                {'\n\n'}
                {!revoked ? (
                  <>
                    <span className="line line--ok">200 OK</span>
                    {'\n'}
                    <span className="line line--muted">
                      {'{ asset: "ALGO", price: 0.214, change24h: "+4.8%" }'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="line line--err">403 Forbidden</span>
                    {'\n'}
                    <span className="line line--muted">
                      capability revoked — access denied
                    </span>
                  </>
                )}
              </code>
            </pre>
            <button
              className="transcript__toggle"
              onClick={() => setRevoked((r) => !r)}
            >
              {revoked ? 'Reissue capability' : 'Revoke capability'}
            </button>
          </div>
        </Reveal>
      </section>

      {/* ---------- STATS ---------- */}
      <Reveal className="stats">
        <div className="stats__grid">
          <div className="stat">
            <span className="stat__num">1</span>
            <span className="stat__label">payment → capability, atomically</span>
          </div>
          <div className="stat">
            <span className="stat__num">5</span>
            <span className="stat__label">request quota per capability</span>
          </div>
          <div className="stat">
            <span className="stat__num">30m</span>
            <span className="stat__label">default expiry window</span>
          </div>
          <div className="stat">
            <span className="stat__num">1-click</span>
            <span className="stat__label">revoke, enforced on next request</span>
          </div>
        </div>
      </Reveal>

      {/* ---------- FLOW ---------- */}
      <section className="flow">
        <Reveal>
          <p className="section-eyebrow">How a request becomes access</p>
          <h2 className="section-title">Five steps, no standing keys</h2>
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

      {/* ---------- SECURITY / FEATURES ---------- */}
      <section className="security">
        <Reveal>
          <p className="section-eyebrow">Blast-radius, not buzzwords</p>
          <h2 className="section-title">
            Every capability is narrow, temporary, and revocable
          </h2>
        </Reveal>
        <div className="security__grid">
          {SECURITY_LAYERS.map((layer, i) => (
            <Reveal key={layer.title} delay={i * 60} className="security__card">
              <h3>{layer.title}</h3>
              <p>{layer.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- PIPELINE ---------- */}
      <section className="pipeline">
        <Reveal>
          <p className="section-eyebrow">System architecture</p>
          <h2 className="section-title">One path, four layers</h2>
        </Reveal>
        <Reveal className="pipeline__diagram" delay={100}>
          {[
            'Browser UI — agent dashboard, capabilities, admin revoke',
            'Node.js / TypeScript — orchestrator, x402 client, capability service',
            'Algorand TestNet — payment settlement + capability box state',
            'Protected resource — GET /api/premium-data',
          ].map((layer, i, arr) => (
            <div className="pipeline__row" key={layer}>
              <div className="pipeline__node">
                <span className="pipeline__index">{i + 1}</span>
                <span className="pipeline__text">{layer}</span>
              </div>
              {i < arr.length - 1 && <span className="pipeline__arrow">↓</span>}
            </div>
          ))}
        </Reveal>
      </section>

      {/* ---------- TEAM ---------- */}
      <section className="team">
        <Reveal>
          <p className="section-eyebrow">Built by three people, in one week</p>
          <h2 className="section-title">Who owns what</h2>
        </Reveal>
        <div className="team__grid">
          {TEAM.map((member, i) => (
            <Reveal key={member.role} delay={i * 80} className="team__card">
              <h3>{member.role}</h3>
              <p>{member.focus}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="footer">
        <div className="footer__top">
          <span className="footer__brand">Veil</span>
          <nav className="footer__routes">
            {ROUTES.map((r) => (
              <a key={r.path} href={r.path}>
                {r.label}
              </a>
            ))}
          </nav>
        </div>
        <p className="footer__note">
          Agentic access to paid digital resources, using x402 on Algorand.
          Payment becomes authorization: temporary, scoped, quota-limited,
          revocable.
        </p>
      </footer>

      <style jsx>{`
        .veil-landing {
          --bg: var(--bg, #0f0f0f);
          --surface: var(--surface, #181818);
          --border: var(--border, #303030);
          --text: var(--text, #f1f1f1);
          --text-muted: var(--text-muted, #aaaaaa);
          --accent: var(--accent, #ff0000);
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans, 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif);
          overflow-x: hidden;
        }

        .accent-text {
          color: var(--accent);
        }

        .eyebrow,
        .section-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin: 0 0 12px;
        }

        .section-title {
          font-size: clamp(1.5rem, 3vw, 2.15rem);
          font-weight: 500;
          line-height: 1.25;
          margin: 0 0 40px;
          max-width: 640px;
        }

        /* ---------- Reveal-on-scroll ---------- */
        .reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal--visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }

        /* ---------- Hero ---------- */
        .hero {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 56px;
          align-items: center;
          max-width: 1180px;
          margin: 0 auto;
          padding: 96px 32px 72px;
        }
        .hero__headline {
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          line-height: 1.08;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0 0 22px;
        }
        .hero__sub {
          color: var(--text-muted);
          font-size: 1.05rem;
          line-height: 1.65;
          max-width: 46ch;
          margin: 0 0 32px;
        }
        .hero__cta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 12px 22px;
          border-radius: 999px;
          font-size: 0.92rem;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .btn--primary {
          background: var(--accent);
          color: #fff;
        }
        .btn--primary:hover {
          transform: translateY(-1px);
        }
        .btn--ghost {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
        }
        .btn--ghost:hover {
          border-color: var(--accent);
        }

        /* ---------- Transcript (signature element) ---------- */
        .transcript {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }
        .transcript__bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot--red {
          background: #ff5f57;
        }
        .dot--amber {
          background: #febc2e;
        }
        .dot--green {
          background: #28c840;
        }
        .transcript__title {
          margin-left: 8px;
          font-size: 0.78rem;
          color: var(--text-muted);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .transcript__body {
          margin: 0;
          padding: 20px 18px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.85rem;
          line-height: 1.9;
          min-height: 168px;
        }
        .line--muted {
          color: var(--text-muted);
        }
        .line--warn {
          color: #febc2e;
          font-weight: 600;
        }
        .line--ok {
          color: #3ddc84;
          font-weight: 600;
        }
        .line--err {
          color: var(--accent);
          font-weight: 600;
        }
        .transcript__toggle {
          width: 100%;
          padding: 13px;
          background: transparent;
          border: none;
          border-top: 1px solid var(--border);
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .transcript__toggle:hover {
          background: rgba(255, 0, 0, 0.08);
        }

        /* ---------- Stats ---------- */
        .stats {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .stats__grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 40px 32px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .stat {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stat__num {
          font-size: 2rem;
          font-weight: 600;
          color: var(--accent);
        }
        .stat__label {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* ---------- Flow ---------- */
        .flow {
          max-width: 1180px;
          margin: 0 auto;
          padding: 88px 32px;
        }
        .flow__strip {
          display: flex;
          align-items: stretch;
          gap: 0;
          flex-wrap: wrap;
        }
        .flow__step-wrap {
          display: flex;
          align-items: center;
          flex: 1 1 180px;
        }
        .flow__step {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px 18px;
          flex: 1;
          min-height: 150px;
        }
        .flow__code {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.75rem;
          color: var(--accent);
          font-weight: 700;
        }
        .flow__label {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 8px 0 6px;
        }
        .flow__detail {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin: 0;
        }
        .flow__connector {
          width: 24px;
          height: 1px;
          background: var(--border);
          flex-shrink: 0;
          margin: 0 4px;
          align-self: center;
        }
        @media (max-width: 900px) {
          .flow__connector {
            display: none;
          }
        }

        /* ---------- Security grid ---------- */
        .security {
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .security__grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 32px 88px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .security > :global(.reveal:first-child) {
          padding: 88px 32px 0;
          max-width: 1180px;
          margin: 0 auto;
        }
        .security__card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
        }
        .security__card h3 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .security__card p {
          font-size: 0.87rem;
          color: var(--text-muted);
          line-height: 1.55;
          margin: 0;
        }

        /* ---------- Pipeline ---------- */
        .pipeline {
          max-width: 900px;
          margin: 0 auto;
          padding: 88px 32px;
        }
        .pipeline__diagram {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .pipeline__row {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .pipeline__node {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px 18px;
        }
        .pipeline__index {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          color: var(--accent);
          font-weight: 700;
          flex-shrink: 0;
        }
        .pipeline__text {
          font-size: 0.92rem;
          color: var(--text);
        }
        .pipeline__arrow {
          color: var(--text-muted);
          padding: 6px 0;
        }

        /* ---------- Team ---------- */
        .team {
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 88px 32px;
        }
        .team__grid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .team__card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }
        .team__card h3 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--accent);
        }
        .team__card p {
          font-size: 0.87rem;
          color: var(--text-muted);
          line-height: 1.55;
          margin: 0;
        }

        /* ---------- Footer ---------- */
        .footer {
          max-width: 1180px;
          margin: 0 auto;
          padding: 56px 32px 64px;
        }
        .footer__top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }
        .footer__brand {
          font-size: 1.1rem;
          font-weight: 700;
        }
        .footer__routes {
          display: flex;
          gap: 22px;
          flex-wrap: wrap;
        }
        .footer__routes a {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.88rem;
        }
        .footer__routes a:hover {
          color: var(--accent);
        }
        .footer__note {
          margin: 22px 0 0;
          font-size: 0.82rem;
          color: var(--text-muted);
          max-width: 60ch;
          line-height: 1.6;
        }

        /* ---------- Responsive ---------- */
        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
            padding: 64px 20px 48px;
          }
          .stats__grid {
            grid-template-columns: repeat(2, 1fr);
            padding: 32px 20px;
          }
          .security__grid,
          .team__grid {
            grid-template-columns: 1fr;
            padding-left: 20px;
            padding-right: 20px;
          }
          .security > :global(.reveal:first-child) {
            padding-left: 20px;
            padding-right: 20px;
          }
          .flow {
            padding: 64px 20px;
          }
          .pipeline {
            padding: 64px 20px;
          }
          .team {
            padding: 64px 20px;
          }
        }
      `}</style>
    </main>
  );
}