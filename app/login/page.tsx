'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { writeSession } from '@/lib/session'

type Mode = 'signin' | 'signup'
type Role = 'agent' | 'admin'

const TERMINAL_LINES = [
  { text: 'GET /api/sessions/connect?rig=rig-beast&hours=2', cls: 'muted' },
  { text: '402 Payment Required', cls: 'warn' },
  { text: 'x402-pay: algorand · price=3.00 USDC', cls: 'muted' },
  { text: 'settling on Algorand TestNet…', cls: 'muted' },
  { text: '200 OK — Capability Issued', cls: 'ok' },
  { text: '{ rig: "RTX 4090", fps: 240, status: "streaming" }', cls: 'muted' },
]

function useTypewriterLines(lines: string[], speed = 18, start = true) {
  const [output, setOutput] = useState<string[]>(() => lines.map(() => ''))

  useEffect(() => {
    if (!start) return
    setOutput(lines.map(() => ''))
    let li = 0, ci = 0
    const id = setInterval(() => {
      setOutput((prev) => {
        if (li >= lines.length) { clearInterval(id); return prev }
        const next = [...prev]
        ci += 1
        next[li] = lines[li].slice(0, ci)
        if (ci >= lines[li].length) { li++; ci = 0 }
        return next
      })
    }, speed)
    return () => clearInterval(id)
  }, [start, speed])

  return output
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialMode: Mode = searchParams.get('mode') === 'register' ? 'signup' : 'signin'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const termLines = useTypewriterLines(TERMINAL_LINES.map((l) => l.text))

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setMessage(null)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setMessage(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration failed'); return }
      setMessage('Account created! Signing you in…')
      setMode('signin')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setMessage(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Sign in failed'); return }
      writeSession({ handle: data.user.handle, role: data.user.role })
      router.push(data.user.role === 'admin' ? '/admin' : '/agent')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError(null); setMessage(null)
    if (!email) { setError('Enter your email first, then click "Forgot password".'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send reset email'); return }
      setMessage(data.message || 'Password reset email sent — check your inbox.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <div className="auth-left__inner">
          <a href="/" className="auth-brand">
            <span className="auth-brand__play" aria-hidden="true" />
            HyperDesk
          </a>

          <div className="auth-pitch">
            <p className="auth-pitch__eye">⚡ AGENTIC ACCESS · X402 + ALGORAND</p>
            <h2 className="auth-pitch__title">
              Payment becomes<br />
              <span className="auth-pitch__accent">authorization.</span>
            </h2>
            <p className="auth-pitch__body">
              Rent cloud rigs. Pay per session with x402 on Algorand.
              Your access is a cryptographic capability — not a password.
            </p>
          </div>

          <div className="auth-terminal">
            <div className="auth-terminal__bar">
              <span className="dot dot--red" />
              <span className="dot dot--amber" />
              <span className="dot dot--green" />
              <span className="auth-terminal__title">agent → /api/sessions/connect</span>
            </div>
            <pre className="auth-terminal__body">
              <code>
                {TERMINAL_LINES.map((def, i) => (
                  <span key={i}>
                    <span className={`tline tline--${def.cls}`}>{termLines[i]}</span>
                    {i < TERMINAL_LINES.length - 1 ? '\n' : null}
                  </span>
                ))}
              </code>
            </pre>
          </div>

          <div className="auth-stats">
            <div className="auth-stat"><span className="auth-stat__n">1</span><span className="auth-stat__l">payment → capability</span></div>
            <div className="auth-stat"><span className="auth-stat__n">30m</span><span className="auth-stat__l">default expiry</span></div>
            <div className="auth-stat"><span className="auth-stat__n">1-click</span><span className="auth-stat__l">instant revoke</span></div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-card">
          {/* Tab switcher */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <div className="auth-card__body">
            <h1 className="auth-card__title">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="auth-card__sub">
              {mode === 'signin'
                ? 'Sign in to access your cloud rigs and sessions.'
                : 'Join HyperDesk and start renting GPU rigs instantly.'}
            </p>

            {message && (
              <div className="auth-alert auth-alert--ok">
                <span>✓</span> {message}
              </div>
            )}
            {error && (
              <div className="auth-alert auth-alert--err">
                <span>✕</span> {error}
              </div>
            )}

            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  className="auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'signup' && (
                <div className="auth-field">
                  <label className="auth-label">Account type</label>
                  <select
                    className="auth-input auth-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    <option value="agent">Agent (Rent rigs)</option>
                    <option value="admin">Admin (Manage platform)</option>
                  </select>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <span className="auth-spinner" aria-hidden="true" />
                ) : mode === 'signin' ? (
                  'Sign In →'
                ) : (
                  'Create Account →'
                )}
              </button>
            </form>

            {mode === 'signin' && (
              <button
                type="button"
                className="auth-forgot"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}
          </div>

          <div className="auth-card__footer">
            {mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button className="auth-switch" onClick={() => switchMode('signup')}>Sign up free</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button className="auth-switch" onClick={() => switchMode('signin')}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-root {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
          background: #000;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
        }
        @media (max-width: 860px) {
          .auth-root { grid-template-columns: 1fr; }
        }

        /* ── LEFT ── */
        .auth-left {
          background: #0d0d0d;
          border-right: 1px solid #27272a;
          display: flex;
          align-items: stretch;
        }
        @media (max-width: 860px) { .auth-left { display: none; } }
        .auth-left__inner {
          display: flex;
          flex-direction: column;
          gap: 36px;
          padding: 48px 44px;
          width: 100%;
        }
        .auth-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 1.25rem;
          font-weight: 800;
          color: #fff;
          text-decoration: none;
          letter-spacing: -0.01em;
        }
        .auth-brand__play {
          width: 0; height: 0;
          border-top: 7px solid transparent;
          border-bottom: 7px solid transparent;
          border-left: 11px solid #ff2d2d;
        }
        .auth-pitch__eye {
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #ff2d2d;
          font-weight: 700;
          margin: 0 0 10px;
        }
        .auth-pitch__title {
          font-size: clamp(1.6rem, 2.6vw, 2.2rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0 0 14px;
        }
        .auth-pitch__accent { color: #ff2d2d; }
        .auth-pitch__body {
          color: #a1a1aa;
          font-size: 0.9rem;
          line-height: 1.6;
          margin: 0;
        }

        /* Terminal */
        .auth-terminal {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 12px;
          overflow: hidden;
        }
        .auth-terminal__bar {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          border-bottom: 1px solid #27272a;
          background: #111;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot--red   { background: #ff5f57; }
        .dot--amber { background: #febc2e; }
        .dot--green { background: #28c840; }
        .auth-terminal__title {
          margin-left: 6px;
          font-size: 0.75rem;
          color: #a1a1aa;
          font-family: monospace;
        }
        .auth-terminal__body {
          margin: 0;
          padding: 16px 18px;
          font-family: 'Menlo', 'Consolas', monospace;
          font-size: 0.78rem;
          line-height: 1.85;
          min-height: 140px;
        }
        .tline--muted { color: #a1a1aa; }
        .tline--warn  { color: #febc2e; font-weight: 600; }
        .tline--ok    { color: #3ddc84; font-weight: 600; }

        /* Stats */
        .auth-stats {
          display: flex;
          gap: 28px;
          padding-top: 8px;
          border-top: 1px solid #27272a;
        }
        .auth-stat { display: flex; flex-direction: column; gap: 2px; }
        .auth-stat__n { font-size: 1.3rem; font-weight: 800; color: #fff; }
        .auth-stat__l { font-size: 0.75rem; color: #a1a1aa; }

        /* ── RIGHT ── */
        .auth-right {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #000;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: #111;
          border: 1px solid #27272a;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }

        /* Tabs */
        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid #27272a;
        }
        .auth-tab {
          padding: 16px;
          background: transparent;
          border: none;
          color: #a1a1aa;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
          font-family: inherit;
        }
        .auth-tab:first-child {
          border-right: 1px solid #27272a;
        }
        .auth-tab--active {
          color: #fff;
          background: #181818;
          box-shadow: inset 0 -2px 0 #ff2d2d;
        }
        .auth-tab:hover:not(.auth-tab--active) {
          color: #fff;
          background: rgba(255,255,255,0.03);
        }

        /* Card body */
        .auth-card__body {
          padding: 28px 28px 20px;
        }
        .auth-card__title {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .auth-card__sub {
          font-size: 0.85rem;
          color: #a1a1aa;
          margin: 0 0 22px;
          line-height: 1.5;
        }

        /* Alerts */
        .auth-alert {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.84rem;
          margin-bottom: 18px;
          line-height: 1.4;
        }
        .auth-alert--ok  { background: rgba(61,220,132,0.1); border: 1px solid rgba(61,220,132,0.3); color: #3ddc84; }
        .auth-alert--err { background: rgba(255,45,45,0.1);  border: 1px solid rgba(255,45,45,0.3);  color: #ff6b6b; }

        /* Form */
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .auth-input {
          background: #0a0a0a;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 11px 14px;
          color: #fff;
          font-size: 0.92rem;
          font-family: inherit;
          width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }
        .auth-input::placeholder { color: #a1a1aa; opacity: 0.6; }
        .auth-input:focus {
          border-color: #ff2d2d;
          box-shadow: 0 0 0 3px rgba(255,45,45,0.15);
        }
        .auth-select { cursor: pointer; appearance: none; }

        /* Submit */
        .auth-submit {
          margin-top: 4px;
          width: 100%;
          padding: 13px;
          background: #ff2d2d;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s ease, transform 0.1s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
        }
        .auth-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Spinner */
        .auth-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Forgot */
        .auth-forgot {
          display: block;
          margin: 14px auto 0;
          background: none;
          border: none;
          color: #a1a1aa;
          font-size: 0.82rem;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.15s ease;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .auth-forgot:hover { color: #fff; }

        /* Footer */
        .auth-card__footer {
          padding: 16px 28px 20px;
          border-top: 1px solid #27272a;
          text-align: center;
          font-size: 0.84rem;
          color: #a1a1aa;
        }
        .auth-switch {
          background: none;
          border: none;
          color: #ff2d2d;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .auth-switch:hover { opacity: 0.8; }
      `}</style>
    </div>
  )
}
