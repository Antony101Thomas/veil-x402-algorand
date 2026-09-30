'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearSession, dashboardPath, readSession, type Session } from '@/lib/session'

type CapStatus = 'active' | 'revoked' | 'expired'

type ApiCapability = {
  credential_id: string
  resource_id: string
  action: string
  quota: number
  quota_used: number
  expiry_at: string | null
  revoked: boolean
  revoked_at: string | null
  created_at: string
  agents: { agent_id: string; name: string; status: string } | null
}

type Capability = {
  credentialId: string
  agentHandle: string
  resource: string
  action: string
  quotaUsed: number
  quotaTotal: number
  expiresAt: number | null
  status: CapStatus
  payment: number
}

function toCapability(row: ApiCapability): Capability {
  const expiresAt = row.expiry_at ? new Date(row.expiry_at).getTime() : null
  const isExpired = expiresAt !== null && expiresAt <= Date.now()
  const status: CapStatus = row.revoked ? 'revoked' : isExpired ? 'expired' : 'active'

  return {
    credentialId: row.credential_id,
    agentHandle: row.agents?.name ?? 'HyperDeck User',
    resource: row.resource_id,
    action: row.action || 'CONNECT',
    quotaUsed: row.quota_used || 0,
    quotaTotal: row.quota || 10,
    expiresAt,
    status,
    payment: 0.50,
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [caps, setCaps] = useState<Capability[]>([])
  const [rigs, setRigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [, forceTick] = useState(0)

  useEffect(() => {
    const parsed = readSession()
    if (!parsed) {
      router.replace('/login')
      return
    }
    if (parsed.role !== 'admin') {
      router.replace(dashboardPath(parsed.role))
      return
    }
    setSession(parsed)
  }, [router])

  async function loadData() {
    try {
      const res = await fetch('/api/capabilities')
      const json = await res.json()
      if (res.ok) {
        setCaps((json.capabilities as ApiCapability[]).map(toCapability))
      }

      const rigRes = await fetch('/api/rigs')
      const rigJson = await rigRes.json()
      if (rigRes.ok) {
        setRigs(rigJson.rigs || [])
      }
      setLoadError(null)
    } catch (err) {
      setLoadError('Network error loading admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    loadData()
    const poll = setInterval(loadData, 15000)
    return () => clearInterval(poll)
  }, [session])

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function revoke(credentialId: string) {
    try {
      const res = await fetch(`/api/sessions/${credentialId}/revoke`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setToast(`Failed to revoke: ${json.error ?? 'unknown error'}`)
        setTimeout(() => setToast(null), 3500)
        return
      }
      setCaps((prev) =>
        prev.map((c) => (c.credentialId === credentialId ? { ...c, status: 'revoked' } : c))
      )
      setToast(`Session ${credentialId} terminated. User disconnected.`)
      setTimeout(() => setToast(null), 3500)
    } catch {
      setToast('Network error ending session')
      setTimeout(() => setToast(null), 3500)
    }
  }

  function handleLogout() {
    clearSession()
    router.push('/login')
  }

  if (!session) return null

  const activeCount = caps.filter((c) => c.status === 'active').length
  const totalPaid = caps.reduce((sum, c) => sum + c.payment, 0)
  const revokedCount = caps.filter((c) => c.status === 'revoked').length

  const statusMeta: Record<CapStatus, { label: string; tone: 'ok' | 'err' | 'muted' }> = {
    active: { label: 'ACTIVE', tone: 'ok' },
    revoked: { label: 'ENDED', tone: 'err' },
    expired: { label: 'EXPIRED', tone: 'muted' },
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">HyperDesk</div>
        <div className="sidebar__role">Admin / Fleet Console</div>
        <button className="sidebar__logout" onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">HYPERDESK · FLEET CONSOLE</p>
            <h1>
              Welcome, <span className="accent-text">{session.handle}</span>
            </h1>
          </div>
          <div className="topbar__status">
            <span className="dot dot--ok" />
            Algorand TestNet Connected
          </div>
        </header>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-card__num">{activeCount}</span>
            <span className="stat-card__label">Active Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{caps.length}</span>
            <span className="stat-card__label">Total Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{rigs.length}</span>
            <span className="stat-card__label">Rig Fleet Tiers</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__num">{revokedCount}</span>
            <span className="stat-card__label">Terminated</span>
          </div>
        </div>

        {/* Rig Fleet Section */}
        <section className="card">
          <h2 className="card__title">Cloud Rig Fleet Status</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rig ID</th>
                  <th>Name</th>
                  <th>GPU</th>
                  <th>CPU</th>
                  <th>Price / hr</th>
                  <th>Slots Free</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {rigs.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.gpu}</td>
                    <td>{r.cpu}</td>
                    <td>${r.pricePerHour.toFixed(2)}</td>
                    <td>{r.availableSlots} / {r.totalSlots}</td>
                    <td>★ {r.avgRating} ({r.ratingCount})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sessions Section */}
        <section className="card">
          <h2 className="card__title">Live User Sessions</h2>

          {loading && <p className="muted-note">Loading session telemetry...</p>}
          {loadError && <p className="error-note">{loadError}</p>}

          {!loading && !loadError && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Credential ID</th>
                    <th>User / Agent</th>
                    <th>Rig ID</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {caps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        No active sessions on Algorand box storage yet.
                      </td>
                    </tr>
                  ) : (
                    caps.map((c) => (
                      <tr key={c.credentialId}>
                        <td className="mono">{c.credentialId}</td>
                        <td>{c.agentHandle}</td>
                        <td className="mono">{c.resource}</td>
                        <td>{c.action}</td>
                        <td>
                          <span className={`badge badge--${statusMeta[c.status].tone}`}>
                            {statusMeta[c.status].label}
                          </span>
                        </td>
                        <td>
                          {c.status === 'active' && (
                            <button className="btn btn--revoke-sm" onClick={() => revoke(c.credentialId)}>
                              Kill Session
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}

      <style jsx>{`
        .shell {
          display: grid;
          grid-template-columns: 220px 1fr;
          min-height: calc(100vh - 56px);
          background: var(--bg);
          color: var(--text);
        }
        @media (max-width: 800px) {
          .shell { grid-template-columns: 1fr; }
        }
        .accent-text { color: var(--accent); }
        .sidebar {
          border-right: 1px solid var(--border);
          padding: 24px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sidebar__brand { font-size: 1.2rem; font-weight: 800; color: var(--accent); padding: 0 10px; }
        .sidebar__role { padding: 0 10px; font-size: 0.8rem; color: var(--text-muted); flex: 1; }
        .sidebar__logout {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          border-radius: 8px;
          padding: 9px 10px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .sidebar__logout:hover { border-color: var(--accent); color: var(--accent); }
        .main { padding: 32px 28px 64px; display: flex; flex-direction: column; gap: 24px; }
        .topbar { display: flex; justify-content: space-between; align-items: flex-end; }
        .topbar__eyebrow { font-size: 0.72rem; letter-spacing: 0.12em; color: var(--accent); font-weight: 700; margin: 0 0 4px; }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 800; }
        .topbar__status { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot--ok { background: #3ddc84; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-card__num { font-size: 1.6rem; font-weight: 800; color: var(--accent); font-family: monospace; }
        .stat-card__label { font-size: 0.78rem; color: var(--text-muted); }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
        .card__title { margin: 0 0 16px; font-size: 1rem; font-weight: 700; }
        .muted-note { color: var(--text-muted); font-size: 0.88rem; }
        .error-note { color: var(--accent); font-size: 0.88rem; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .table th { text-align: left; padding: 10px 12px; font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
        .table td { padding: 12px; border-bottom: 1px solid var(--border); }
        .mono { font-family: monospace; font-size: 0.82rem; }
        .empty-cell { color: var(--text-muted); padding: 28px 12px; text-align: center; }
        .badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
        .badge--ok { background: rgba(61, 220, 132, 0.14); color: #1f9d5c; }
        .badge--err { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
        .badge--muted { background: color-mix(in srgb, var(--text-muted) 14%, transparent); color: var(--text-muted); }
        .btn--revoke-sm { padding: 6px 14px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; border: 1px solid var(--accent); background: transparent; color: var(--accent); cursor: pointer; }
        .btn--revoke-sm:hover { background: var(--accent); color: #fff; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; font-size: 0.85rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4); z-index: 60; }
      `}</style>
    </div>
  )
}
