'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dashboardPath, writeSession, type SessionRole } from '@/lib/session'

type Role = SessionRole
type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  )
  const [role, setRole] = useState<Role>('agent')
  const [handle, setHandle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    const finalHandle = handle || (role === 'agent' ? 'agent-01' : 'provider-demo')

    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: finalHandle, role, mode }),
      })
      const data = await res.json()

      if (!res.ok) {
        // e.g. signin attempted for a handle that doesn't exist
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      if (data.note === 'handle_already_existed_logged_in') {
        setInfo(`"${finalHandle}" already exists — signing you in instead.`)
      }

      const sessionRole: SessionRole =
        data.user.role === 'admin' ? 'admin' : 'agent'
      writeSession({ handle: data.user.handle, role: sessionRole })

      const go = () => router.push(dashboardPath(sessionRole))
      if (data.note === 'handle_already_existed_logged_in') {
        setTimeout(go, 900)
      } else {
        go()
      }
    } catch {
      setError('Could not reach the server. Try again.')
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={handleSubmit}>
        <div className="card__bar" aria-hidden="true" />

        <div className="modegroup" role="tablist" aria-label="Mode">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              type="button"
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`modebtn ${mode === m ? 'modebtn--active' : ''}`}
              onClick={() => {
                setMode(m)
                setError(null)
                setInfo(null)
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <h1>{mode === 'signin' ? 'Sign in to Veil' : 'Create a demo account'}</h1>
        <p className="card__subtitle">
          Demo access — choose the role you want to watch this run as.
        </p>

        <div className="rolegroup" role="radiogroup" aria-label="Role">
          {(['agent', 'admin'] as Role[]).map((r) => (
            <button
              type="button"
              key={r}
              role="radio"
              aria-checked={role === r}
              className={`rolebtn ${role === r ? 'rolebtn--active' : ''}`}
              onClick={() => setRole(r)}
            >
              {r === 'agent' ? 'Agent' : 'Admin / Provider'}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Handle</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={role === 'agent' ? 'agent-01' : 'provider-demo'}
            autoFocus
          />
        </label>

        {error && <p className="card__error">{error}</p>}
        {info && <p className="card__info">{info}</p>}

        <button type="submit" className="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Continue' : 'Create & Continue'}
        </button>

        <p className="card__footnote">TestNet demo — no real credentials required.</p>
      </form>

      <style jsx>{`
        .login {
          min-height: calc(100vh - 56px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .card {
          width: 100%;
          max-width: 380px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 32px 28px 24px;
          position: relative;
          overflow: hidden;
        }
        .card__bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent);
        }
        .modegroup {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 3px;
        }
        .modebtn {
          flex: 1;
          padding: 7px 0;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }
        .modebtn--active {
          background: var(--surface-raised);
          color: var(--text);
        }
        h1 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .card__subtitle {
          margin: 0 0 20px;
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .rolegroup {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
        }
        .rolebtn {
          flex: 1;
          padding: 9px 10px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-muted);
          cursor: pointer;
          transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
        }
        .rolebtn--active {
          border-color: var(--accent);
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 20px;
        }
        .field input {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .field input:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .card__error {
          margin: -8px 0 16px;
          font-size: 12px;
          color: var(--accent);
          text-align: center;
        }
        .card__info {
          margin: -8px 0 16px;
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
        .submit {
          width: 100%;
          padding: 11px 0;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          background: var(--accent);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 150ms ease;
        }
        .submit:hover {
          background: var(--accent-hover);
        }
        .submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .card__footnote {
          margin: 16px 0 0;
          text-align: center;
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}