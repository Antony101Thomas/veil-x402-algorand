'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Veil — Wallet Connect & Delegation
 * Implements the 9 flow states from the UX handoff doc:
 * 1 not connected · 2 choosing wallet · 3 connecting · 4 connected/unauthorized
 * 5 authorization explanation · 6 authorizing · 7 authorized (steady state)
 * 8 revoking · 9 errors/edge cases
 *
 * Wallet-SDK integration (Pera/Defly/Lute/Exodus, real signing) is intentionally
 * stubbed — see TODOs. This file owns the states, transitions, and copy.
 */

const STORAGE_KEY = 'veil-wallet-session'

type Step =
  | 'idle'
  | 'picking'
  | 'connecting'
  | 'connect-error'
  | 'connected'
  | 'explain'
  | 'authorizing'
  | 'authorize-error'
  | 'authorized'
  | 'revoke-confirm'
  | 'revoking'
  | 'revoked'

type ConnectMethod = 'qr' | 'deeplink' | 'popup'

type WalletOption = {
  id: string
  name: string
  hint: string
  glyph: string
  tint: string
}

const WALLETS: WalletOption[] = [
  { id: 'pera', name: 'Pera Wallet', hint: 'Mobile & browser extension', glyph: 'P', tint: '#FFC947' },
  { id: 'defly', name: 'Defly', hint: 'Mobile & browser extension', glyph: 'D', tint: '#2F6BFF' },
  { id: 'lute', name: 'Lute', hint: 'Browser extension', glyph: 'L', tint: '#8C6BFF' },
  { id: 'exodus', name: 'Exodus', hint: 'Desktop & mobile', glyph: 'E', tint: '#12C7A0' },
]

// Two sequential signatures for authorize, by default. Backend may collapse
// this to one — flip AUTH_STEPS to 1 if a single signature ends up sufficient.
const AUTH_STEPS = 2

type Persisted = { address: string; authorized: boolean }

function readPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

function writePersisted(p: Persisted | null) {
  if (typeof window === 'undefined') return
  if (!p) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

function shorten(address: string) {
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

// TODO(backend): replace with a real Algorand address from the connected wallet.
function mockAddress(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let out = ''
  for (let i = 0; i < 58; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

// Deterministic pseudo-random grid standing in for a real WalletConnect QR
// payload. TODO(backend): swap for an actual WalletConnect URI + QR renderer.
function qrCells(seed: string, size = 12): boolean[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const cells: boolean[] = []
  for (let i = 0; i < size * size; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    cells.push(((h >> 16) & 1) === 1)
  }
  return cells
}

function SharedPanelStyles() {
  return (
    <style jsx global>{`
      .panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 4px;
        padding: 8px 4px 4px;
      }
      .panel--center {
        padding-top: 12px;
      }
      .panel h1 {
        font-size: 18px;
        font-weight: 650;
        color: var(--text);
        margin: 16px 0 0;
        letter-spacing: -0.01em;
      }
      .panel .muted {
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--text);
        opacity: 0.6;
        margin: 8px 0 0;
        max-width: 340px;
      }
      .panel .address {
        margin-top: 16px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
        color: var(--text);
        background: color-mix(in srgb, var(--text) 8%, transparent);
        padding: 6px 10px;
        border-radius: 8px;
      }
      .panel .row {
        margin-top: 20px;
        width: 100%;
      }
      .panel .row--split {
        display: flex;
        gap: 10px;
        width: 100%;
      }
      .panel .row--split .btn {
        flex: 1;
        margin-top: 0;
      }
      .panel .btn {
        font-size: 14px;
        font-weight: 600;
        border-radius: 10px;
        padding: 11px 18px;
        cursor: pointer;
        border: 1px solid transparent;
        width: 100%;
        margin-top: 20px;
        transition: opacity 0.15s ease, transform 0.1s ease, background 0.15s ease;
        font-family: inherit;
      }
      .panel .btn:active {
        transform: scale(0.98);
      }
      .panel .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .panel .btn--primary {
        background: var(--accent);
        color: #fff;
      }
      .panel .btn--primary:hover:not(:disabled) {
        opacity: 0.9;
      }
      .panel .btn--ghost {
        background: none;
        border-color: var(--border);
        color: var(--text);
        margin-top: 0;
      }
      .panel .btn--ghost:hover {
        border-color: var(--accent);
      }
      .panel .btn--danger {
        background: none;
        border-color: var(--accent);
        color: var(--accent);
        margin-top: 0;
      }
      .panel .btn--danger:hover {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      .panel .linkbtn {
        margin-top: 14px;
        background: none;
        border: none;
        color: var(--text);
        opacity: 0.55;
        font-size: 13px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        font-family: inherit;
      }
      .panel .linkbtn:hover {
        opacity: 0.9;
      }
      .panel .linkbtn--danger {
        color: var(--accent);
        opacity: 0.85;
      }
      .panel .devlink {
        margin-top: 28px;
        background: none;
        border: none;
        color: var(--text);
        opacity: 0.3;
        font-size: 11px;
        cursor: pointer;
        text-decoration: underline dashed;
        text-underline-offset: 3px;
        font-family: inherit;
      }
      .panel .devlink:hover {
        opacity: 0.6;
      }
    `}</style>
  )
}

export default function WalletPage() {
  const [step, setStep] = useState<Step>('idle')
  const [address, setAddress] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletOption | null>(null)
  const [method, setMethod] = useState<ConnectMethod>('qr')
  const [authStepIndex, setAuthStepIndex] = useState(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const cancelRef = useRef(false)

  // Recognize a returning user instead of restarting the flow (State 9).
  useEffect(() => {
    const persisted = readPersisted()
    if (persisted?.authorized) {
      setAddress(persisted.address)
      setStep('authorized')
    } else if (persisted?.address) {
      setAddress(persisted.address)
      setStep('connected')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setMethod(window.innerWidth < 768 ? 'deeplink' : 'qr')
  }, [])

  function openPicker() {
    cancelRef.current = false
    setStep('picking')
  }

  async function selectWallet(w: WalletOption) {
    setWallet(w)
    setStep('connecting')
    cancelRef.current = false
    // TODO(backend): replace with real wallet-connect handshake (WalletConnect
    // session, deep link, or extension popup depending on `method`).
    await delay(1800)
    if (cancelRef.current) return
    const addr = mockAddress()
    setAddress(addr)
    writePersisted({ address: addr, authorized: false })
    setStep('connected')
  }

  function cancelConnecting() {
    cancelRef.current = true
    setStep('idle')
    setWallet(null)
  }

  function simulateConnectReject() {
    cancelRef.current = true
    setStep('connect-error')
  }

  function useDifferentWallet() {
    writePersisted(null)
    setAddress(null)
    setWallet(null)
    setAcknowledged(false)
    setStep('idle')
  }

  function startAuthorize() {
    setAcknowledged(false)
    setStep('explain')
  }

  async function confirmAuthorize() {
    setStep('authorizing')
    cancelRef.current = false
    for (let i = 1; i <= AUTH_STEPS; i++) {
      setAuthStepIndex(i)
      // TODO(backend): request an actual signature per approval step here.
      await delay(1500)
      if (cancelRef.current) return
    }
    if (!address) return
    writePersisted({ address, authorized: true })
    setStep('authorized')
  }

  function cancelAuthorizing() {
    cancelRef.current = true
    setStep('connected')
  }

  function simulateAuthorizeReject() {
    cancelRef.current = true
    setStep('authorize-error')
  }

  function startRevoke() {
    setStep('revoke-confirm')
  }

  async function confirmRevoke() {
    setStep('revoking')
    // TODO(backend): submit the on-chain revoke transaction and await confirmation.
    await delay(1600)
    if (!address) return
    writePersisted({ address, authorized: false })
    setStep('revoked')
  }

  function finishRevoke() {
    setStep('connected')
  }

  return (
    <main className="page">
      <SharedPanelStyles />
      <div className="card">
        <div className="card__head">
          <Link href="/" className="back">
            ← Back
          </Link>
          <ProgressTrail step={step} />
        </div>

        {step === 'idle' && (
          <IdlePanel onConnect={openPicker} />
        )}

        {step === 'picking' && (
          <PickerPanel onSelect={selectWallet} onClose={() => setStep('idle')} />
        )}

        {step === 'connecting' && wallet && (
          <ConnectingPanel
            wallet={wallet}
            method={method}
            onCancel={cancelConnecting}
            onSimulateReject={simulateConnectReject}
          />
        )}

        {step === 'connect-error' && (
          <ErrorPanel
            context="connect"
            onRetry={openPicker}
            onCancel={() => setStep('idle')}
          />
        )}

        {step === 'connected' && address && (
          <ConnectedPanel
            address={address}
            onAuthorize={startAuthorize}
            onUseDifferentWallet={useDifferentWallet}
          />
        )}

        {step === 'explain' && address && (
          <ExplainPanel
            address={address}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            onConfirm={confirmAuthorize}
            onBack={() => setStep('connected')}
          />
        )}

        {step === 'authorizing' && (
          <AuthorizingPanel
            current={authStepIndex}
            total={AUTH_STEPS}
            onCancel={cancelAuthorizing}
            onSimulateReject={simulateAuthorizeReject}
          />
        )}

        {step === 'authorize-error' && (
          <ErrorPanel
            context="authorize"
            onRetry={startAuthorize}
            onCancel={() => setStep('connected')}
          />
        )}

        {step === 'authorized' && address && (
          <AuthorizedPanel address={address} onRevoke={startRevoke} />
        )}

        {step === 'revoke-confirm' && (
          <RevokeConfirmPanel onConfirm={confirmRevoke} onCancel={() => setStep('authorized')} />
        )}

        {step === 'revoking' && <RevokingPanel />}

        {step === 'revoked' && <RevokedPanel onContinue={finishRevoke} />}
      </div>

      <style jsx>{`
        .page {
          min-height: calc(100vh - 56px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background:
            radial-gradient(560px 320px at 50% -10%, color-mix(in srgb, var(--accent) 10%, transparent), transparent),
            var(--bg);
        }
        .card {
          width: 100%;
          max-width: 460px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: color-mix(in srgb, var(--bg) 94%, var(--text) 6%);
          padding: 24px;
          box-shadow: 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent);
        }
        .card__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .back {
          font-size: 13px;
          color: var(--text);
          opacity: 0.6;
          text-decoration: none;
        }
        .back:hover {
          opacity: 1;
        }
      `}</style>
    </main>
  )
}

/* ---------------------------------------------------------------------- */
/* Progress trail — three real stages the user needs to track, not decoration */

function ProgressTrail({ step }: { step: Step }) {
  const stage =
    step === 'authorized' || step === 'revoke-confirm' || step === 'revoking' || step === 'revoked'
      ? 2
      : step === 'connected' || step === 'explain' || step === 'authorizing' || step === 'authorize-error'
      ? 1
      : 0

  const labels = ['Connect', 'Authorize', 'Active']

  return (
    <div className="trail" aria-label="Setup progress">
      {labels.map((label, i) => (
        <div key={label} className="trail__item">
          <span className={`trail__dot ${i <= stage ? 'trail__dot--on' : ''}`} />
          <span className={`trail__label ${i === stage ? 'trail__label--on' : ''}`}>{label}</span>
        </div>
      ))}
      <style jsx>{`
        .trail {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .trail__item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .trail__item:not(:last-child)::after {
          content: '';
          width: 12px;
          height: 1px;
          background: var(--border);
          margin: 0 2px;
        }
        .trail__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--border);
          display: inline-block;
        }
        .trail__dot--on {
          background: var(--accent);
        }
        .trail__label {
          font-size: 11px;
          color: var(--text);
          opacity: 0.45;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .trail__label--on {
          opacity: 0.9;
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* Seal — the signature element: an unsealed ring that becomes a solid
   authorized mark, echoing the red circular badge used across the app */

function Seal({ state }: { state: 'empty' | 'pending' | 'sealed' | 'broken' | 'error' }) {
  return (
    <div className={`seal seal--${state}`} aria-hidden="true">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r="30"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeDasharray={state === 'empty' || state === 'broken' ? '5 5' : undefined}
          opacity={state === 'sealed' ? 0 : 1}
        />
        <circle cx="36" cy="36" r="30" fill="var(--accent)" className="seal__fill" />
        {state === 'sealed' && (
          <path
            d="M24 37 L32 45 L49 27"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {state === 'error' && (
          <path
            d="M28 28 L44 44 M44 28 L28 44"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
      </svg>
      <style jsx>{`
        .seal {
          display: inline-flex;
          position: relative;
        }
        .seal__fill {
          opacity: 0;
          transform-origin: center;
          transform: scale(0.6);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .seal--sealed .seal__fill {
          opacity: 1;
          transform: scale(1);
        }
        .seal--sealed {
          filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent) 45%, transparent));
        }
        .seal--pending svg {
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 1 — Not connected */

function IdlePanel({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="panel">
      <Seal state="empty" />
      <h1>Connect your wallet</h1>
      <p className="muted">
        Connect an Algorand wallet to let Veil's agent pay for resources on your behalf.
      </p>
      <button className="btn btn--primary" onClick={onConnect}>
        Connect wallet
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 2 — Choosing a wallet */

function PickerPanel({
  onSelect,
  onClose,
}: {
  onSelect: (w: WalletOption) => void
  onClose: () => void
}) {
  return (
    <div className="panel">
      <div className="panel__row">
        <h1>Choose a wallet</h1>
        <button className="iconbtn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <ul className="walletlist">
        {WALLETS.map((w) => (
          <li key={w.id}>
            <button className="walletrow" onClick={() => onSelect(w)}>
              <span className="walletrow__glyph" style={{ background: w.tint }}>
                {w.glyph}
              </span>
              <span className="walletrow__text">
                <span className="walletrow__name">{w.name}</span>
                <span className="walletrow__hint">{w.hint}</span>
              </span>
              <span className="walletrow__chev">›</span>
            </button>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .panel__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .iconbtn {
          border: none;
          background: none;
          color: var(--text);
          opacity: 0.5;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
        }
        .iconbtn:hover {
          opacity: 1;
        }
        .walletlist {
          list-style: none;
          margin: 16px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .walletrow {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: none;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .walletrow:hover {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 6%, transparent);
        }
        .walletrow__glyph {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #1a1a1a;
          flex-shrink: 0;
        }
        .walletrow__text {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .walletrow__name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
        }
        .walletrow__hint {
          font-size: 12px;
          color: var(--text);
          opacity: 0.55;
        }
        .walletrow__chev {
          color: var(--text);
          opacity: 0.3;
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 3 — Connecting (QR / deep-link / popup) */

function ConnectingPanel({
  wallet,
  method,
  onCancel,
  onSimulateReject,
}: {
  wallet: WalletOption
  method: ConnectMethod
  onCancel: () => void
  onSimulateReject: () => void
}) {
  const cells = method === 'qr' ? qrCells(wallet.id, 12) : []

  return (
    <div className="panel panel--center">
      {method === 'qr' && (
        <div className="qr">
          <svg viewBox="0 0 12 12" width="176" height="176">
            {cells.map((on, i) =>
              on ? (
                <rect key={i} x={i % 12} y={Math.floor(i / 12)} width="1" height="1" fill="var(--text)" />
              ) : null
            )}
          </svg>
        </div>
      )}
      {method === 'deeplink' && <Seal state="pending" />}
      {method === 'popup' && <Seal state="pending" />}

      <h1>
        {method === 'qr' && `Scan with ${wallet.name}`}
        {method === 'deeplink' && `Opening ${wallet.name}…`}
        {method === 'popup' && `Waiting on ${wallet.name}`}
      </h1>
      <p className="muted">
        {method === 'qr' && `Open ${wallet.name} on your phone and scan this code to connect.`}
        {method === 'deeplink' && `Approve the connection in the ${wallet.name} app, then return here.`}
        {method === 'popup' && `Approve the connection in the ${wallet.name} popup.`}
      </p>
      <div className="row">
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <button className="devlink" onClick={onSimulateReject}>
        Simulate: wallet rejected
      </button>
      <style jsx>{`
        .qr {
          padding: 12px;
          background: #fff;
          border-radius: 12px;
          line-height: 0;
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 4 — Connected, not yet authorized */

function ConnectedPanel({
  address,
  onAuthorize,
  onUseDifferentWallet,
}: {
  address: string
  onAuthorize: () => void
  onUseDifferentWallet: () => void
}) {
  return (
    <div className="panel">
      <Seal state="empty" />
      <h1>Wallet connected</h1>
      <p className="muted">This is the account Veil will pay from once you authorize it.</p>
      <code className="address">{shorten(address)}</code>
      <button className="btn btn--primary" onClick={onAuthorize}>
        Authorize agent to pay on your behalf
      </button>
      <button className="linkbtn" onClick={onUseDifferentWallet}>
        Use a different wallet
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 5 — Authorization explanation */

function ExplainPanel({
  address,
  acknowledged,
  onAcknowledgedChange,
  onConfirm,
  onBack,
}: {
  address: string
  acknowledged: boolean
  onAcknowledgedChange: (v: boolean) => void
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <div className="panel">
      <h1>Veil's agent wants to:</h1>
      <ul className="scope">
        <li>
          <span className="scope__mark">→</span>
          Make payments from <code>{shorten(address)}</code> automatically, without asking each time.
        </li>
        <li>
          <span className="scope__mark">→</span>
          Spend small amounts only — typically under <strong>$0.05</strong> per data request.
          <span className="scope__note">Final limit pending — confirm before ship</span>
        </li>
        <li>
          <span className="scope__mark">→</span>
          Stay scoped to Veil's capability contract. It can't spend outside what's approved here.
        </li>
      </ul>
      <p className="muted muted--tight">
        You can revoke this at any time from the wallet page — it takes effect on-chain immediately.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)}
        />
        I understand this lets Veil's agent sign payments for me until I revoke access.
      </label>
      <div className="row row--split">
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn--primary" disabled={!acknowledged} onClick={onConfirm}>
          Authorize agent
        </button>
      </div>
      <style jsx>{`
        .scope {
          list-style: none;
          margin: 14px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
          width: 100%;
        }
        .scope li {
          display: flex;
          gap: 8px;
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--text);
        }
        .scope code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
          background: color-mix(in srgb, var(--text) 8%, transparent);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .scope__mark {
          color: var(--accent);
          flex-shrink: 0;
        }
        .scope__note {
          display: block;
          font-size: 11px;
          opacity: 0.5;
          font-style: italic;
          margin-top: 2px;
        }
        .muted--tight {
          text-align: left;
          width: 100%;
          margin-top: 14px;
        }
        .check {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          text-align: left;
          font-size: 12.5px;
          color: var(--text);
          opacity: 0.85;
          margin-top: 16px;
          width: 100%;
          cursor: pointer;
        }
        .check input {
          margin-top: 2px;
          accent-color: var(--accent);
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 6 — Authorizing */

function AuthorizingPanel({
  current,
  total,
  onCancel,
  onSimulateReject,
}: {
  current: number
  total: number
  onCancel: () => void
  onSimulateReject: () => void
}) {
  return (
    <div className="panel panel--center">
      <Seal state="pending" />
      <h1>Approval {current} of {total}</h1>
      <p className="muted">Confirm the signature request in your wallet.</p>
      <div className="row">
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <button className="devlink" onClick={onSimulateReject}>
        Simulate: wallet rejected
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 7 — Authorized (steady state) */

function AuthorizedPanel({ address, onRevoke }: { address: string; onRevoke: () => void }) {
  return (
    <div className="panel">
      <Seal state="sealed" />
      <h1>Agent authorized</h1>
      <p className="muted">You're set up. Veil pays for resources on your behalf — no further approvals needed.</p>
      <code className="address">{shorten(address)}</code>
      <div className="divider" />
      <button className="linkbtn linkbtn--danger" onClick={onRevoke}>
        Revoke access
      </button>
      <style jsx>{`
        .divider {
          width: 100%;
          height: 1px;
          background: var(--border);
          margin: 20px 0 12px;
        }
      `}</style>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 8 — Revoking */

function RevokeConfirmPanel({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="panel">
      <Seal state="broken" />
      <h1>Revoke agent access?</h1>
      <p className="muted">
        Veil's agent will no longer be able to pay from this account. You'll need to authorize again
        before it can resume.
      </p>
      <div className="row row--split">
        <button className="btn btn--ghost" onClick={onCancel}>
          Keep authorized
        </button>
        <button className="btn btn--danger" onClick={onConfirm}>
          Revoke access
        </button>
      </div>
    </div>
  )
}

function RevokingPanel() {
  return (
    <div className="panel panel--center">
      <Seal state="pending" />
      <h1>Revoking access…</h1>
      <p className="muted">Confirm the revoke transaction in your wallet.</p>
    </div>
  )
}

function RevokedPanel({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="panel">
      <Seal state="broken" />
      <h1>Access revoked</h1>
      <p className="muted">Veil's agent can no longer pay from this account.</p>
      <button className="btn btn--primary" onClick={onContinue}>
        Done
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* State 9 — Errors */

function ErrorPanel({
  context,
  onRetry,
  onCancel,
}: {
  context: 'connect' | 'authorize'
  onRetry: () => void
  onCancel: () => void
}) {
  return (
    <div className="panel">
      <Seal state="error" />
      <h1>{context === 'connect' ? 'Connection rejected' : 'Authorization rejected'}</h1>
      <p className="muted">
        {context === 'connect'
          ? 'The request was declined in your wallet, or the session timed out. No changes were made.'
          : 'The signature request was declined, or the session timed out. Nothing was authorized.'}
      </p>
      <div className="row row--split">
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}
