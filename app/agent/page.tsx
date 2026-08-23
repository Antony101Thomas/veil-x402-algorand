'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearSession, dashboardPath, readSession, type Session } from '@/lib/session'

type View = 'dashboard' | 'agent' | 'capabilities' | 'payments' | 'resources' | 'activity'

// --- add near the top, with the other type declarations ---
type ChatSession = {
  id: number
  title: string
  messages: ChatMsg[]
  savedAt: string
}

// --- DELETE this entirely (undefined array, dummy "coming soon" providers) ---
// {DUMMY_RESOURCES.map((r) => (
//   <div className="provider provider--soon" key={r.endpoint}>
//     ...
//   </div>
// ))}

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

const RESOURCE = {
  id: 'premium-data',
  label: 'Premium Market Data',
  price: '$0.05',
  unit: 'USDC',
}

const NAV: { key: View; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { key: 'capabilities', label: 'Capabilities', icon: '⚿' },
  { key: 'payments', label: 'Payments', icon: '◈' },
  { key: 'resources', label: 'Resources', icon: '▤' },
  { key: 'activity', label: 'Activity', icon: '≣' },
]

export default function AgentDashboard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [log, setLog] = useState<LogEntry[]>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const parsed = readSession()
    if (!parsed) {
      router.replace('/login')
      return
    }
    if (parsed.role !== 'agent') {
      router.replace(dashboardPath(parsed.role))
      return
    }
    setSession(parsed)
  }, [router])

  function pushLog(message: string, tone: LogEntry['tone'] = 'muted') {
    setLog((prev) =>
      [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), message, tone }, ...prev].slice(0, 20)
    )
  }

  function pushChat(role: ChatMsg['role'], text: string) {
    setChat((prev) => [...prev, { id: Date.now() + Math.random(), role, text }])
  }

  function startNewChat() {
    if (chat.length > 0) {
      const firstUserMsg = chat.find((m) => m.role === 'user')?.text ?? 'New chat'
      const title = firstUserMsg.length > 42 ? firstUserMsg.slice(0, 42) + '…' : firstUserMsg
      setChatHistory((prev) => [
        { id: Date.now(), title, messages: chat, savedAt: new Date().toLocaleString() },
        ...prev,
      ])
    }
    setChat([])
  }

  function loadChat(sessionToLoad: ChatSession) {
    setChat(sessionToLoad.messages)
    setView('dashboard')
  }

  function handleLogout() {
    clearSession()
    router.push('/login')
  }

  async function handleSend() {
    const message = draft.trim()
    if (!message || busy) return
    setDraft('')
    pushChat('user', message)
    setBusy(true)

    try {
      pushLog('Starting agent orchestrator flow...', 'muted')
      const res = await fetch('/api/agent/run', { method: 'POST' })
      const data = await res.json()
      
      const tone: LogEntry['tone'] =
        res.status === 200 ? 'ok' : res.status === 402 ? 'warn' : 'err'
      
      pushLog(`Orchestrator finished with HTTP ${res.status}`, tone)

      if (res.status === 402) {
        pushChat('agent', 'Payment failed or resource still returned 402 after payment attempt.')
      } else if (res.status === 403) {
        pushChat('agent', 'Access denied. The capability might be revoked or expired.')
      } else if (res.status === 200) {
        pushChat('agent', `Success! ${data.summary || JSON.stringify(data.data)}`)
      } else {
        pushChat('agent', `Agent error: ${data.error || 'Unknown failure'}`)
      }
    } catch (err: any) {
      pushLog(`Orchestrator call failed: ${err.message}`, 'err')
      pushChat('agent', `Could not reach the agent orchestrator.`)
    }

    setBusy(false)
  }

  if (!session) return null

  return (
    <div className="shell">
      {/* ---------- SIDEBAR ---------- */}
      <aside className="sidebar">
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

        {view === 'dashboard' && (
          <div className="sidebar__history">
            <p className="sidebar__history-title">Previous Chats</p>
            {chatHistory.length === 0 ? (
              <p className="sidebar__history-empty">No previous chats yet.</p>
            ) : (
              <ul className="sidebar__history-list">
                {chatHistory.map((s) => (
                  <li key={s.id}>
                    <button className="sidebar__history-item" onClick={() => loadChat(s)}>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="dashboard-layout">
            <section className="card cap-card-top">
              <h2 className="card__title">Active Capabilities</h2>
              <p className="chat__empty">
                No capabilities issued. This list stays empty until x402 payment and
                createCapability run on TestNet — not from this chat.
              </p>
            </section>

            <section className="chat-panel">
              <div className="chat-panel__header">
                <span className="agent-card__icon">🤖</span>
                <div>
                  <h2>Resource Agent</h2>
                  <div className={`badge badge--${busy ? 'warn' : 'muted'}`}>
                    Status: {busy ? 'Working...' : 'Idle'}
                  </div>
                </div>
                <button className="btn btn--ghost chat-panel__newchat" onClick={startNewChat}>
                  + New Chat
                </button>
              </div>

              <div className="chat-panel__messages">
                {chat.length === 0 ? (
                  <p className="chat__empty">Ask your agent to trade — try “Buy 10 ALGO” or “Place a market order”.</p>
                ) : (
                  chat.map((m) => (
                    <div key={m.id} className={`chat__msg chat__msg--${m.role}`}>
                      {m.text}
                    </div>
                  ))
                )}
              </div>

              <div className="chat-panel__input">
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
            </section>
          </div>
        )}

        {view === 'capabilities' && (
          <section className="card">
            <h2 className="card__title">Capabilities</h2>
            <p className="chat__empty">No capabilities issued yet.</p>
          </section>
        )}

        {view === 'payments' && (
          <section className="card">
            <h2 className="card__title">Payments</h2>
            {log.filter((l) => l.message.includes('402') || l.message.includes('200')).length === 0 ? (
              <p className="chat__empty">No payments yet. Settled x402 transfers will show here once the orchestrator is wired.</p>
            ) : (
              <ul className="log">
                {log
                  .filter((l) => l.message.includes('402') || l.message.includes('200'))
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
                  <span className="provider__price-unit">{RESOURCE.unit}</span>
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
                  <span className="provider__stat-label">session duration</span>
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

      <style jsx>{`
        .shell {
          display: grid;
          grid-template-columns: 220px 1fr;
          height: calc(100vh - 56px);
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
          gap: 20px;
          overflow: hidden;
        }
        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-shrink: 0;
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
        .sidebar__history {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--border);
          padding-top: 14px;
        }
        .sidebar__history-title {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0 10px 8px;
        }
        .sidebar__history-empty {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0 10px;
        }
        .sidebar__history-list {
          list-style: none;
          margin: 0;
          padding: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar__history-item {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.82rem;
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar__history-item:hover {
          background: var(--surface);
          color: var(--text);
        }
        .sidebar__logout {
          flex-shrink: 0;
          margin-top: auto;
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
          height: 100%;
          overflow-y: auto;
          padding: 32px 28px 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 500px;
          gap: 20px;
        }
        .cap-card-top {
          flex-shrink: 0;
          max-height: 260px;
          overflow-y: auto;
        }

        /* ---------- Chat panel (ChatGPT-style) ---------- */
        .chat-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-raised, var(--surface));
          overflow: hidden;
        }
        .chat-panel__header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .chat-panel__header h2 {
          margin: 0 0 4px;
          font-size: 1rem;
          font-weight: 600;
        }
        .chat-panel__newchat {
          margin-left: auto;
        }
        .chat-panel__messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chat-panel__input {
          flex-shrink: 0;
          display: flex;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }
        .chat-panel__input input {
          flex: 1;
          font-size: 0.9rem;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .chat-panel__input input:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
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
        .provider + .provider {
          margin-top: 16px;
        }
        .provider--soon {
          opacity: 0.85;
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
        .provider__banner--soon {
          background: color-mix(in srgb, var(--text-muted) 14%, transparent);
          color: var(--text-muted);
        }
        .provider__banner-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #3ddc84;
          box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.25);
        }
        .provider__banner-dot--soon {
          background: var(--text-muted);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-muted) 25%, transparent);
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