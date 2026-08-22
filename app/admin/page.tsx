'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY = 'veil-session'

type Session = { handle: string; role: 'agent' | 'admin' }
type CapStatus = 'active' | 'revoked' | 'expired'

type Capability = {
  id: string
  credentialId: string
  agentHandle: string
  resource: string
  action: 'READ' | 'WRITE'
  quotaUsed: number
  quotaTotal: number
  expiresIn: number
  status: CapStatus
  payment: number
}

function randHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
}

const SEED_CAPS: Capability[] = [
  {
    id: '1',
    credentialId: 'CRED-' + randHex(5),
    agentHandle: 'agent-01',
    resource: 'place-order',
    action: 'WRITE',
    quotaUsed: 2,
    quotaTotal: 5,
    expiresIn: 1120,
    status: 'active',
    payment: 0.1,
  },
  {
    id: '2',
    credentialId: 'CRED-' + randHex(5),
    agentHandle: 'agent-07',
    resource: 'place-order',
    action: 'WRITE',
    quotaUsed: 5,
    quotaTotal: 5,
    expiresIn: 0,
    status: 'expired',
    payment: 0.1,
  },
  {
    id: '3',
    credentialId: 'CRED-' + randHex(5),
    agentHandle: 'agent-12',
    resource: 'place-order',
    action: 'WRITE',
    quotaUsed: 1,
    quotaTotal: 5,
    expiresIn: 1750,
    status: 'active',
    payment: 0.1,
  },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [caps, setCaps] = useState<Capability[]>(SEED_CAPS)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      router.replace('/login')
      return
    }
    try {
      const parsed = JSON.parse(raw) as Session
      if (parsed.role !== 'admin') {
        router.replace(parsed.role === 'agent' ? '/agent' : '/login')
        return
      }
      setSession(parsed)
    } catch {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    const t = setInterval(() => {
      setCaps((prev) =>
        prev.map((c) =>
          c.status === 'active' && c.expiresIn > 0
            ? { ...c, expiresIn: c.expiresIn - 1, ...(c.expiresIn - 1 <= 0 ? { status: 'expired' as CapStatus } : {}) }
            : c
        )
      )
    }, 1000)
    return () => clearInterval(t)
  }, [])

  function revoke(id: string) {
    setCaps((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'revoked' } : c)))
    const target = caps.find((c) => c.id === id)
    setToast(`Revoked ${target?.credentialId} — ${target?.agentHandle}'s next request will return 403.`)
    setTimeout(() => setToast(null), 3500)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    router.push('/login')
  }

  if (!session) return null

  const activeCount = caps.filter((c) => c.status === 'active').length
  const totalPaid = caps.reduce((sum, c) => sum + c.payment, 0)
  const revokedCount = caps.filter((c) => c.status === 'revoked').length

  const statusMeta: Record<CapStatus, { label: string; tone: 'ok' | 'err' | 'muted' }> = {
    active: { label: 'ACTIVE', tone: 'ok' },
    revoked: { label: 'REVOKED', tone: 'err' },
    expired: { label: 'EXPIRED', tone: 'muted' },
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">Veil</div>
        <div className="sidebar__role">Admin / Provider</div>
        <button className="sidebar__logout" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">VEIL · PROVIDER CONSOLE</p>
            <h1>
              Welcome, <span className="accent-text">{session.handle}</span>
            </h1>
          </div>
          <div className="topbar__status">
            <span className="dot dot--ok" />
            Algorand Connected
          </div>
        </header>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-card__num">{activeCount}</span>
            <span className="stat-card__label">active capabilities</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{caps.length}</span>
            <span className="stat-card__label">total issued</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{totalPaid.toFixed(2)}</span>
            <span className="stat-card__label">ALGO collected</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{revokedCount}</span>
            <span className="stat-card__label">revoked</span>
          </div>
        </div>

        <section className="card">
          <h2 className="card__title">Active Capabilities</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Agent</th>
                  <th>Resource</th>
                  <th>Action</th>
                  <th>Quota</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {caps.map((c) => {
                  const mins = Math.floor(c.expiresIn / 60)
                  const secs = c.expiresIn % 60
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.credentialId}</td>
                      <td>{c.agentHandle}</td>
                      <td className="mono">{c.resource}</td>
                      <td>{c.action}</td>
                      <td>
                        {c.quotaUsed} / {c.quotaTotal}
                      </td>
                      <td className="mono">
                        {c.status === 'active' ? `${mins}:${secs.toString().padStart(2, '0')}` : '—'}
                      </td>
                      <td>
                        <span className={`badge badge--${statusMeta[c.status].tone}`}>
                          {statusMeta[c.status].label}
                        </span>
                      </td>
                      <td>
                        {c.status === 'active' && (
                          <button className="btn btn--revoke-sm" onClick={() => revoke(c.id)}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .shell {
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: calc(100vh - 56px);
        }
        @media (max-width: 800px) {
          .shell {
            grid-template-columns: 1fr;
          }
        }
        .accent-text {
          color: var(--accent);
        }

        .sidebar {
          border-right: 1px solid var(--border);
          padding: 24px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sidebar__brand {
          font-size: 1.1rem;
          font-weight: 700;
          padding: 0 10px;
        }
        .sidebar__role {
          padding: 0 10px;
          font-size: 0.8rem;
          color: var(--text-muted);
          flex: 1;
        }
        .sidebar__logout {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          border-radius: 8px;
          padding: 9px 10px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .sidebar__logout:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .main {
          padding: 32px 28px 64px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
        }
        .topbar__eyebrow {
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin: 0 0 6px;
        }
        h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .topbar__status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot--ok {
          background: #3ddc84;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 700px) {
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .stat-card {
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-card__num {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--accent);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .stat-card__label {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .card {
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px;
        }
        .card__title {
          margin: 0 0 16px;
          font-size: 1rem;
          font-weight: 600;
        }

        .table-wrap {
          overflow-x: auto;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border);
        }
        .table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .table tr:last-child td {
          border-bottom: none;
        }
        .mono {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.82rem;
        }

        .badge {
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }
        .badge--ok {
          background: rgba(61, 220, 132, 0.14);
          color: #1f9d5c;
        }
        .badge--err {
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          color: var(--accent);
        }
        .badge--muted {
          background: color-mix(in srgb, var(--text-muted) 14%, transparent);
          color: var(--text-muted);
        }

        .btn--revoke-sm {
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          border: 1px solid var(--accent);
          background: transparent;
          color: var(--accent);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .btn--revoke-sm:hover {
          background: var(--accent);
          color: #fff;
        }

        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 20px;
          font-size: 0.85rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          z-index: 60;
        }
      `}</style>
    </div>
  )
}
