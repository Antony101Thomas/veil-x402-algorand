'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const SESSION_KEY = 'veil-session'

type Session = { handle: string; role: 'agent' | 'admin' }
type View = 'dashboard' | 'agent' | 'capabilities' | 'payments' | 'resources' | 'activity'
type CapStatus = 'idle' | 'requesting' | 'payment_required' | 'paying' | 'active' | 'revoked' | 'expired'

type LogEntry = {
  id: number
  time: string
  message: string
  tone: 'muted' | 'warn' | 'ok' | 'err'
}

type ChatMsg = {
  id: number
  role: 'user' | 'agent'
  text: string
}

const RESOURCE = { id: 'premium-data', label: 'Premium Market Data', price: 0.1 }
const STARTING_BALANCE = 1.0

const NAV: { key: View; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { key: 'agent', label: 'AI Agent', icon: '◎' },
  { key: 'capabilities', label: 'Capabilities', icon: '⚿' },
  { key: 'payments', label: 'Payments', icon: '◈' },
  { key: 'resources', label: 'Resources', icon: '▤' },
  { key: 'activity', label: 'Activity', icon: '≣' },
]

function randHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
}

function shortAddr(full: string) {
  return `${full.slice(0, 3)}...${full.slice(-3)}`
}

export default function AgentDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<View>('dashboard')

  const [status, setStatus] = useState<CapStatus>('idle')
  const [quota, setQuota] = useState(5)
  const [expiresIn, setExpiresIn] = useState(1800)
  const [credentialId, setCredentialId] = useState<string | null>(null)
  const [holder, setHolder] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)
  const [balance, setBalance] = useState(STARTING_BALANCE)

  const [log, setLog] = useState<LogEntry[]>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const [showCapModal, setShowCapModal] = useState(false)
  const [retryResult, setRetryResult] = useState<'idle' | 'pending' | 'forbidden'>('idle')

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      router.replace('/login')
      return
    }
    try {
      const parsed = JSON.parse(raw) as Session
      if (parsed.role !== 'agent') {
        router.replace(parsed.role === 'admin' ? '/admin' : '/login')
        return
      }
      setSession(parsed)
    } catch {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    if (status !== 'active') return
    if (expiresIn <= 0) {
      setStatus('expired')
      pushLog('Capability expired — access lapsed automatically.', 'err')
      return
    }
    const t = setTimeout(() => setExpiresIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [status, expiresIn])

  function pushLog(message: string, tone: LogEntry['tone'] = 'muted') {
    setLog((prev) =>
      [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), message, tone }, ...prev].slice(0, 20)
    )
  }

  function pushChat(role: ChatMsg['role'], text: string) {
    setChat((prev) => [...prev, { id: Date.now() + Math.random(), role, text }])
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    router.push('/login')
  }

  async function handleSend() {
    const message = draft.trim()
    if (!message || busy) return
    setDraft('')
    pushChat('user', message)
    setBusy(true)

    if (status === 'active' && quota > 0) {
      await wait(500)
      pushChat('agent', `Using existing capability — fetching ${RESOURCE.label.toLowerCase()}…`)
      pushLog(`GET /api/${RESOURCE.id} → 200 OK (quota ${quota - 1} remaining)`, 'ok')
      setQuota((q) => Math.max(0, q - 1))
      await wait(500)
      pushChat('agent', `Here's the latest data: ALGO price $0.214, 24h change +4.8%, volume 2.4M.`)
      setBusy(false)
      return
    }

    if (status === 'revoked') {
      await wait(400)
      pushChat('agent', `Requesting ${RESOURCE.id}…`)
      await wait(500)
      pushChat('agent', `Server: 403 FORBIDDEN — reason: CAPABILITY_REVOKED`)
      pushLog(`GET /api/${RESOURCE.id} → 403 Forbidden (CAPABILITY_REVOKED)`, 'err')
      setBusy(false)
      return
    }

    await wait(500)
    pushChat('agent', `Looking that up — this needs the paid resource "${RESOURCE.label}".`)
    setStatus('requesting')
    pushLog(`GET /api/${RESOURCE.id} → requesting…`, 'muted')
    await wait(600)

    setStatus('payment_required')
    pushLog('402 Payment Required — x402 terms received', 'warn')
    pushChat('agent', `Got a 402 — this costs ${RESOURCE.price} ALGO. Paying automatically…`)
    await wait(700)

    setStatus('paying')
    pushLog(`Signing payment: ${RESOURCE.price} ALGO on Algorand TestNet…`, 'muted')
    await wait(900)

    const cred = 'CRED-' + randHex(5)
    const holderFull = randHex(24)
    const tx = randHex(20)
    setCredentialId(cred)
    setHolder(holderFull)
    setTxId(tx)
    setQuota(5)
    setExpiresIn(1800)
    setBalance((b) => Math.max(0, +(b - RESOURCE.price).toFixed(2)))
    setStatus('active')
    setRetryResult('idle')
    pushLog(`Payment settled — capability ${cred} issued (READ, quota 5, expires 30m)`, 'ok')
    pushChat('agent', `Paid and received a capability (5 requests, expires in 30m). Fetching your data…`)
    await wait(500)
    pushChat('agent', `Here's the latest data: ALGO price $0.214, 24h change +4.8%, volume 2.4M.`)
    setQuota((q) => Math.max(0, q - 1))
    pushLog(`GET /api/${RESOURCE.id} → 200 OK (quota 4 remaining)`, 'ok')
    setBusy(false)
  }

  async function revoke() {
    setStatus('revoked')
    pushLog(`Capability ${credentialId ?? ''} revoked by provider.`, 'err')
    setRetryResult('pending')
    await wait(900)
    setRetryResult('forbidden')
    pushChat('agent', `Requesting ${RESOURCE.id}…`)
    pushChat('agent', `Server: 403 FORBIDDEN — reason: CAPABILITY_REVOKED`)
    pushLog(`GET /api/${RESOURCE.id} → 403 Forbidden (CAPABILITY_REVOKED)`, 'err')
  }

  function reissue() {
    setCredentialId(null)
    setHolder(null)
    setTxId(null)
    setStatus('idle')
    setRetryResult('idle')
    setShowCapModal(false)
    pushLog('Capability cleared. Ready for a new request.', 'muted')
  }

  if (!session) return null

  const mins = Math.floor(expiresIn / 60)
  const secs = expiresIn % 60
  const statusMeta: Record<CapStatus, { label: string; tone: LogEntry['tone'] }> = {
    idle: { label: 'No active capability', tone: 'muted' },
    requesting: { label: 'Requesting…', tone: 'muted' },
    payment_required: { label: '402 Payment Required', tone: 'warn' },
    paying: { label: 'Settling payment…', tone: 'warn' },
    active: { label: 'Active', tone: 'ok' },
    revoked: { label: 'Revoked', tone: 'err' },
    expired: { label: 'Expired', tone: 'err' },
  }

  const capExists = credentialId !== null

  return (
    <div className="shell">
      {/* ---------- SIDEBAR ---------- */}
      <aside className="sidebar">
        <div className="sidebar__brand">Veil</div>
        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`sidebar__item ${view === item.key ? 'sidebar__item--active' : ''}`}
              onClick={() => setView(item.key)}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <button className="sidebar__logout" onClick={handleLogout}>
          Sign out
        </button>
      </aside>

      {/* ---------- MAIN ---------- */}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">VEIL · ECONOMIC CAPABILITY LAYER</p>
            <h1>
              Welcome, <span className="accent-text">{session.handle}</span>
            </h1>
          </div>
          <div className="topbar__status">
            <span className="dot dot--ok" />
            Algorand Connected
            <span className="topbar__balance">{balance.toFixed(2)} ALGO</span>
          </div>
        </header>

        {(view === 'dashboard' || view === 'agent') && (
          <>
            <section className="card agent-card">
              <div className="agent-card__head">
                <span className="agent-card__icon">◎</span>
                <div>
                  <h2>Research Agent</h2>
                  <div className={`badge badge--${statusMeta[status].tone}`}>
                    Status: {statusMeta[status].label}
                  </div>
                </div>
              </div>

              <div className="chat">
                {chat.length === 0 ? (
                  <p className="chat__empty">Ask your agent to fetch something paid — try “Get the premium market data for ALGO”.</p>
                ) : (
                  <div className="chat__log">
                    {chat.map((m) => (
                      <div key={m.id} className={`chat__msg chat__msg--${m.role}`}>
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}
                <div className="chat__input">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask your agent…"
                    disabled={busy}
                  />
                  <button className="btn btn--primary" onClick={handleSend} disabled={busy || !draft.trim()}>
                    Send ➤
                  </button>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="card__title">Active Capabilities</h2>
              {!capExists ? (
                <p className="chat__empty">No capabilities yet — ask your agent for premium data to get one.</p>
              ) : (
                <div className="cap-card">
                  <div className="cap-card__head">
                    <span className="cap-card__icon">⚿</span>
                    <span>{RESOURCE.label}</span>
                    <span className={`badge badge--${statusMeta[status].tone}`}>{statusMeta[status].label}</span>
                  </div>
                  <ul className="cap-card__meta">
                    <li>READ only</li>
                    <li>{status === 'active' ? `${quota} requests remaining` : `${quota} / 5 requests`}</li>
                    <li>
                      {status === 'active'
                        ? `Expires in ${mins}:${secs.toString().padStart(2, '0')}`
                        : status === 'expired'
                        ? 'Expired'
                        : status === 'revoked'
                        ? 'Revoked'
                        : '—'}
                    </li>
                  </ul>
                  <div className="cap-card__actions">
                    <button className="link" onClick={() => setShowCapModal(true)}>
                      View Capability
                    </button>
                    {status === 'active' && (
                      <button className="btn btn--ghost" onClick={revoke}>
                        Revoke
                      </button>
                    )}
                    {(status === 'revoked' || status === 'expired') && (
                      <button className="btn btn--ghost" onClick={reissue}>
                        Reissue
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {view === 'capabilities' && (
          <section className="card">
            <h2 className="card__title">Capabilities</h2>
            {!capExists ? (
              <p className="chat__empty">No capabilities issued yet.</p>
            ) : (
              <>
                <dl className="cap-list">
                  <div className="cap-row"><dt>Resource</dt><dd>{RESOURCE.id}</dd></div>
                  <div className="cap-row"><dt>Action</dt><dd>READ</dd></div>
                  <div className="cap-row"><dt>Credential</dt><dd>{credentialId}</dd></div>
                  <div className="cap-row"><dt>Quota</dt><dd>{quota} / 5</dd></div>
                  <div className="cap-row">
                    <dt>Expires in</dt>
                    <dd>{status === 'active' ? `${mins}:${secs.toString().padStart(2, '0')}` : '—'}</dd>
                  </div>
                  <div className="cap-row"><dt>Status</dt><dd>{statusMeta[status].label}</dd></div>
                </dl>
                <button className="btn btn--ghost" onClick={() => setShowCapModal(true)} style={{ marginTop: 14 }}>
                  View Capability
                </button>
              </>
            )}
          </section>
        )}

        {view === 'payments' && (
          <section className="card">
            <h2 className="card__title">Payments</h2>
            {log.filter((l) => l.message.includes('Payment settled')).length === 0 ? (
              <p className="chat__empty">No payments yet.</p>
            ) : (
              <ul className="log">
                {log
                  .filter((l) => l.message.includes('Payment settled'))
                  .map((entry) => (
                    <li key={entry.id} className="log__row log__row--ok">
                      <span className="log__time">{entry.time}</span>
                      <span className="log__msg">{entry.message}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        {view === 'resources' && (
          <section className="card">
            <h2 className="card__title">Resources</h2>
            <div className="cap-card">
              <div className="cap-card__head">
                <span className="cap-card__icon">⚿</span>
                <span>{RESOURCE.label}</span>
              </div>
              <ul className="cap-card__meta">
                <li>GET /api/{RESOURCE.id}</li>
                <li>{RESOURCE.price} ALGO per capability</li>
                <li>READ only</li>
              </ul>
            </div>
          </section>
        )}
        {view === 'resources' && (
          <section className="card">
            <h2 className="card__title">Resources</h2>
            <div className="provider">
              <div className="provider__banner">
                <span className="provider__banner-dot" />
                x402 ENABLED
              </div>

              <div className="provider__head">
                <div className="provider__icon">⚿</div>
                <div>
                  <h3 className="provider__name">{RESOURCE.label}</h3>
                  <code className="provider__endpoint">/api/{RESOURCE.id}</code>
                </div>
                <div className="provider__price">
                  <span className="provider__price-num">{RESOURCE.price}</span>
                  <span className="provider__price-unit">ALGO</span>
                </div>
              </div>

              <div className="provider__actions">
                <span className="pill pill--on">✓ READ</span>
                <span className="pill pill--off">WRITE</span>
              </div>

              <div className="provider__stats">
                <div className="provider__stat">
                  <span className="provider__stat-num">5</span>
                  <span className="provider__stat-label">requests per capability</span>
                </div>
                <div className="provider__stat">
                  <span className="provider__stat-num">30m</span>
                  <span className="provider__stat-label">access duration</span>
                </div>
                <div className="provider__stat">
                  <span className="provider__stat-num">1</span>
                  <span className="provider__stat-label">payment → capability</span>
                </div>
              </div>
            </div>
          </section>
        )}  

        {view === 'activity' && (
          <section className="card">
            <h2 className="card__title">Activity</h2>
            {log.length === 0 ? (
              <p className="chat__empty">No activity yet.</p>
            ) : (
              <ul className="log">
                {log.map((entry) => (
                  <li key={entry.id} className={`log__row log__row--${entry.tone}`}>
                    <span className="log__time">{entry.time}</span>
                    <span className="log__msg">{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* ---------- CAPABILITY DETAILS MODAL ---------- */}
      {showCapModal && capExists && (
        <div className="modal-overlay" onClick={() => setShowCapModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <span>CAPABILITY DETAILS</span>
              <button className="modal__close" onClick={() => setShowCapModal(false)}>
                ✕
              </button>
            </div>

            {status !== 'revoked' ? (
              <div className="modal__body">
                <div className="modal__field">
                  <span className="modal__label">Credential ID</span>
                  <span className="modal__value">{credentialId}</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Resource</span>
                  <span className="modal__value">{RESOURCE.id}</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Action</span>
                  <span className="modal__value">READ</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Payment</span>
                  <span className="modal__value">{RESOURCE.price} ALGO</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Requests</span>
                  <div className="modal__progress">
                    <div className="modal__progress-track">
                      <div
                        className="modal__progress-fill"
                        style={{ width: `${((5 - quota) / 5) * 100}%` }}
                      />
                    </div>
                    <span className="modal__value">{5 - quota} / 5</span>
                  </div>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Expires</span>
                  <span className="modal__value">
                    {status === 'active' ? `${mins} minutes ${secs} seconds` : 'Expired'}
                  </span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Holder</span>
                  <span className="modal__value">{holder && shortAddr(holder)}</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Status</span>
                  <span className="modal__value">
                    <span className={`dot dot--${statusMeta[status].tone === 'ok' ? 'ok' : 'err'}`} />{' '}
                    {statusMeta[status].label.toUpperCase()}
                  </span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Algorand Transaction</span>
                  <span className="modal__value">
                    {txId && shortAddr(txId)}{' '}
                    <a className="link" href="#" onClick={(e) => e.preventDefault()}>
                      View on Explorer
                    </a>
                  </span>
                </div>

                {status === 'active' && (
                  <button className="btn btn--revoke" onClick={revoke}>
                    REVOKE ACCESS
                  </button>
                )}
              </div>
            ) : (
              <div className="modal__body">
                <div className="modal__field">
                  <span className="modal__label">Resource</span>
                  <span className="modal__value">{RESOURCE.id}</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Action</span>
                  <span className="modal__value">READ</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Requests</span>
                  <span className="modal__value">{5 - quota} / 5</span>
                </div>
                <div className="modal__field">
                  <span className="modal__label">Status</span>
                  <span className="modal__value">
                    <span className="dot dot--err" /> REVOKED
                  </span>
                </div>
                <p className="modal__note">Revoked on Algorand</p>
                <p className="modal__note modal__note--ok">✓ Transaction confirmed</p>

                <div className="modal__retry">
                  <p className="modal__retry-label">Then the AI agent tries:</p>
                  <div className="retry-box">
                    <p className="retry-box__line">Agent:</p>
                    <p className="retry-box__line retry-box__line--muted">Requesting {RESOURCE.id}...</p>
                    {retryResult === 'pending' && (
                      <p className="retry-box__line retry-box__line--muted">Server: …</p>
                    )}
                    {retryResult === 'forbidden' && (
                      <>
                        <p className="retry-box__line">Server:</p>
                        <p className="retry-box__line retry-box__line--err">403 FORBIDDEN</p>
                        <p className="retry-box__line">Reason:</p>
                        <p className="retry-box__line retry-box__line--err">CAPABILITY_REVOKED</p>
                      </>
                    )}
                  </div>
                </div>

                <button className="btn btn--ghost" onClick={reissue} style={{ marginTop: 16 }}>
                  Reissue capability
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

        /* ---------- Sidebar ---------- */
        .sidebar {
          border-right: 1px solid var(--border);
          padding: 24px 14px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .sidebar__brand {
          font-size: 1.1rem;
          font-weight: 700;
          padding: 0 10px;
        }
        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .sidebar__item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.88rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .sidebar__item:hover {
          background: var(--surface);
          color: var(--text);
        }
        .sidebar__item--active {
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
          color: var(--accent);
        }
        .sidebar__icon {
          width: 16px;
          text-align: center;
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

        /* ---------- Main ---------- */
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
          margin-bottom: 4px;
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
        .topbar__balance {
          margin-left: 6px;
          padding-left: 10px;
          border-left: 1px solid var(--border);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          color: var(--text);
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
        .dot--err {
          background: var(--accent);
        }

        .card {
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px;
        }
        .card__title {
          margin: 0 0 14px;
          font-size: 1rem;
          font-weight: 600;
        }

        .agent-card__head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .agent-card__icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--surface);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }
        .agent-card__head h2 {
          margin: 0 0 4px;
          font-size: 1rem;
          font-weight: 600;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 600;
        }
        .badge--muted {
          background: color-mix(in srgb, var(--text-muted) 14%, transparent);
          color: var(--text-muted);
        }
        .badge--warn {
          background: rgba(254, 188, 46, 0.14);
          color: #b7860a;
        }
        .badge--ok {
          background: rgba(61, 220, 132, 0.14);
          color: #1f9d5c;
        }
        .badge--err {
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          color: var(--accent);
        }

        .chat__empty {
          color: var(--text-muted);
          font-size: 0.88rem;
          margin: 0 0 16px;
        }
        .chat__log {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          max-height: 220px;
          overflow-y: auto;
        }
        .chat__msg {
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 0.86rem;
          line-height: 1.5;
          max-width: 85%;
        }
        .chat__msg--user {
          align-self: flex-end;
          background: var(--accent);
          color: #fff;
        }
        .chat__msg--agent {
          align-self: flex-start;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .chat__input {
          display: flex;
          gap: 8px;
        }
        .chat__input input {
          flex: 1;
          font-size: 0.9rem;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .chat__input input:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          padding: 10px 18px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
        }
        .btn--primary {
          background: var(--accent);
          color: #fff;
        }
        .btn--primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn--ghost {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
        }
        .btn--ghost:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .btn--revoke {
          width: 100%;
          justify-content: center;
          background: var(--accent);
          color: #fff;
          margin-top: 8px;
        }

        .cap-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          background: var(--surface);
        }
        .cap-card__head {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .cap-card__icon {
          color: var(--accent);
        }
        .cap-card__meta {
          list-style: none;
          margin: 0 0 12px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.84rem;
          color: var(--text-muted);
        }
        .cap-card__actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .provider {
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface);
        }
        .provider__banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: rgba(61, 220, 132, 0.12);
          color: #1f9d5c;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.06em;
        }
        .provider__banner-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #3ddc84;
          box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.25);
        }
        .provider__head {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 22px 20px 18px;
        }
        .provider__icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 12px;
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
        }
        .provider__name {
          margin: 0 0 4px;
          font-size: 1.05rem;
          font-weight: 600;
        }
        .provider__endpoint {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .provider__price {
          margin-left: auto;
          text-align: right;
          flex-shrink: 0;
        }
        .provider__price-num {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .provider__price-unit {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-left: 4px;
        }
        .provider__actions {
          display: flex;
          gap: 8px;
          padding: 0 20px 18px;
        }
        .pill {
          font-size: 0.76rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 999px;
          letter-spacing: 0.02em;
        }
        .pill--on {
          background: rgba(61, 220, 132, 0.14);
          color: #1f9d5c;
        }
        .pill--off {
          background: color-mix(in srgb, var(--text-muted) 12%, transparent);
          color: var(--text-muted);
          text-decoration: line-through;
        }
        .provider__stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid var(--border);
        }
        .provider__stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 18px 12px;
          text-align: center;
        }
        .provider__stat:not(:last-child) {
          border-right: 1px solid var(--border);
        }
        .provider__stat-num {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--accent);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .provider__stat-label {
          font-size: 0.74rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .provider-box__head {
          font-size: 0.78rem;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          padding-bottom: 12px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }
        .provider-box__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .provider-box__field:last-child {
          border-bottom: none;
        }
        .provider-box__label {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .provider-box__value {
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .provider-box__check {
          color: var(--text);
        }
        .provider-box__check--off {
          color: var(--text-muted);
        }
        .link {
          font-size: 0.82rem;
          color: var(--accent);
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .link:hover {
          text-decoration: underline;
        }

        .cap-list {
          margin: 0;
        }
        .cap-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 0.88rem;
        }
        .cap-row:last-child {
          border-bottom: none;
        }
        .cap-row dt {
          color: var(--text-muted);
        }
        .cap-row dd {
          margin: 0;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.83rem;
        }

        .log {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 360px;
          overflow-y: auto;
        }
        .log__row {
          display: flex;
          gap: 10px;
          font-size: 0.82rem;
          line-height: 1.5;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .log__time {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .log__row--muted .log__msg {
          color: var(--text-muted);
        }
        .log__row--warn .log__msg {
          color: #b7860a;
        }
        .log__row--ok .log__msg {
          color: #1f9d5c;
        }
        .log__row--err .log__msg {
          color: var(--accent);
        }

        /* ---------- Modal ---------- */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 50;
        }
        .modal {
          width: 100%;
          max-width: 480px;
          max-height: 86vh;
          overflow-y: auto;
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px 22px 24px;
        }
        .modal__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          padding-bottom: 14px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }
        .modal__close {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 1rem;
          cursor: pointer;
          line-height: 1;
        }
        .modal__close:hover {
          color: var(--accent);
        }
        .modal__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .modal__field:last-of-type {
          border-bottom: none;
        }
        .modal__label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .modal__value {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.88rem;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .modal__progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal__progress-track {
          flex: 1;
          height: 6px;
          border-radius: 999px;
          background: var(--border);
          overflow: hidden;
        }
        .modal__progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }
        .modal__note {
          font-size: 0.86rem;
          color: var(--text-muted);
          margin: 10px 0 0;
        }
        .modal__note--ok {
          color: #1f9d5c;
        }
        .modal__retry {
          margin-top: 18px;
        }
        .modal__retry-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0 0 8px;
        }
        .retry-box {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
          background: var(--surface);
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.83rem;
        }
        .retry-box__line {
          margin: 0 0 6px;
        }
        .retry-box__line:last-child {
          margin-bottom: 0;
        }
        .retry-box__line--muted {
          color: var(--text-muted);
        }
        .retry-box__line--err {
          color: var(--accent);
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}