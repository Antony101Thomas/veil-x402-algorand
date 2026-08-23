'use client'

import { useEffect, useState } from 'react'
import {
  peraWallet,
  connectWallet,
  reconnectWalletSession,
  onWalletDisconnect,
  disconnectWallet,
} from '@/lib/pera-wallet'
import { signAuthorization, signRevocation } from '@/lib/wallet-authorization'

type FlowState =
  | 'not_connected' // State 1
  | 'connecting' // State 3
  | 'connected_unauthorized' // State 4
  | 'explaining' // State 5
  | 'authorizing' // State 6
  | 'authorized' // State 7
  | 'revoking' // State 8

type ErrorInfo = { message: string; retryable: boolean } | null

const AUTH_SCOPE = { resourceId: 'place-order', maxPerPayment: 0.1 }

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`
}

export function WalletConnectPanel({ handle }: { handle: string }) {
  const [flow, setFlow] = useState<FlowState>('not_connected')
  const [address, setAddress] = useState<string | null>(null)
  const [authTxId, setAuthTxId] = useState<string | null>(null)
  const [error, setError] = useState<ErrorInfo>(null)
  const [understood, setUnderstood] = useState(false)

  // On mount: try to recognize a returning connected/authorized user
  // (State 9 — "should recognize prior connection rather than restarting").
  useEffect(() => {
    let cancelled = false

    async function restore() {
      // 1. Does our backend know this handle already connected/authorized?
      try {
        const res = await fetch(`/api/wallet-auth?handle=${encodeURIComponent(handle)}`)
        const json = await res.json()
        const record = json.record as
          | { wallet_address: string; authorized: boolean; auth_tx_id: string | null }
          | null

        // 2. Does Pera itself still have a live session for this browser?
        const reconnected = await reconnectWalletSession()

        if (cancelled) return

        if (reconnected && record) {
          setAddress(reconnected)
          if (record.authorized) {
            setAuthTxId(record.auth_tx_id)
            setFlow('authorized')
          } else {
            setFlow('connected_unauthorized')
          }
        } else if (reconnected) {
          setAddress(reconnected)
          setFlow('connected_unauthorized')
        }
        // If neither exists, stay in not_connected — nothing to restore.
      } catch {
        // Silent — restoring prior state is a nicety, not required for the
        // flow to function; user can just connect fresh.
      }
    }

    restore()
    onWalletDisconnect(() => {
      if (cancelled) return
      setAddress(null)
      setAuthTxId(null)
      setFlow('not_connected')
    })

    return () => {
      cancelled = true
    }
  }, [handle])

  async function handleConnect() {
    setError(null)
    setFlow('connecting')
    try {
      const acct = await connectWallet()
      setAddress(acct)
      await fetch('/api/wallet-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', handle, walletAddress: acct }),
      })
      setFlow('connected_unauthorized')
    } catch (err) {
      setFlow('not_connected')
      setError({
        message:
          err instanceof Error && err.message.includes('Session currently connected')
            ? 'A wallet session is already open. Try again.'
            : 'Connection was cancelled or timed out.',
        retryable: true,
      })
    }
  }

  function proceedToExplanation() {
    setError(null)
    setUnderstood(false)
    setFlow('explaining')
  }

  async function handleAuthorize() {
    if (!address) return
    setError(null)
    setFlow('authorizing')
    try {
      const txId = await signAuthorization(address, AUTH_SCOPE)
      setAuthTxId(txId)
      await fetch('/api/wallet-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authorize', handle, walletAddress: address, txId }),
      })
      setFlow('authorized')
    } catch (err) {
      setFlow('connected_unauthorized')
      setError({ message: 'Authorization was rejected or timed out in your wallet.', retryable: true })
    }
  }

  async function handleRevoke() {
    if (!address) return
    setError(null)
    setFlow('revoking')
    try {
      const txId = await signRevocation(address)
      await fetch('/api/wallet-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', handle, txId }),
      })
      setAuthTxId(null)
      setFlow('connected_unauthorized')
    } catch (err) {
      setFlow('authorized')
      setError({ message: 'Revocation was rejected or timed out in your wallet.', retryable: true })
    }
  }

  function handleDisconnect() {
    disconnectWallet()
    setAddress(null)
    setAuthTxId(null)
    setFlow('not_connected')
  }

  return (
    <section className="wc-card">
      {/* ---------- State 1: not connected ---------- */}
      {flow === 'not_connected' && (
        <div className="wc-body">
          <h3 className="wc-title">Connect your wallet</h3>
          <p className="wc-desc">
            Connect an Algorand wallet so this agent can act on your behalf.
          </p>
          {error && <p className="wc-error">{error.message}</p>}
          <button className="wc-btn wc-btn--primary" onClick={handleConnect}>
            Connect Wallet
          </button>
        </div>
      )}

      {/* ---------- State 3: connecting ---------- */}
      {flow === 'connecting' && (
        <div className="wc-body wc-body--center">
          <div className="wc-spinner" />
          <p className="wc-desc">Waiting for approval in your wallet…</p>
          <p className="wc-note">
            A QR code, popup, or your wallet app should have opened. Approve the connection
            there to continue.
          </p>
          <button className="wc-btn wc-btn--ghost" onClick={() => setFlow('not_connected')}>
            Cancel
          </button>
        </div>
      )}

      {/* ---------- State 4: connected, not authorized ---------- */}
      {flow === 'connected_unauthorized' && address && (
        <div className="wc-body">
          <h3 className="wc-title">Wallet connected</h3>
          <p className="wc-addr mono">{shortAddr(address)}</p>
          {error && <p className="wc-error">{error.message}</p>}
          <p className="wc-desc">This wallet isn't authorized to let the agent pay yet.</p>
          <div className="wc-actions">
            <button className="wc-btn wc-btn--primary" onClick={proceedToExplanation}>
              Authorize agent to pay on your behalf
            </button>
            <button className="wc-btn wc-btn--ghost" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* ---------- State 5: authorization explanation ---------- */}
      {flow === 'explaining' && address && (
        <div className="wc-body">
          <h3 className="wc-title">What you're authorizing</h3>
          <ul className="wc-list">
            <li>The agent will be able to pay for resources from this account automatically, without asking you each time.</li>
            <li>
              Scope: small payments for <strong>{AUTH_SCOPE.resourceId}</strong>, up to{' '}
              <strong>{AUTH_SCOPE.maxPerPayment} ALGO</strong> per payment.
            </li>
            <li>You can revoke this at any time from this same panel — revoking requires a wallet signature and takes effect immediately.</li>
          </ul>
          <label className="wc-checkbox">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            I understand and want to proceed
          </label>
          <div className="wc-actions">
            <button
              className="wc-btn wc-btn--primary"
              disabled={!understood}
              onClick={handleAuthorize}
            >
              Authorize
            </button>
            <button className="wc-btn wc-btn--ghost" onClick={() => setFlow('connected_unauthorized')}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ---------- State 6: authorizing ---------- */}
      {flow === 'authorizing' && (
        <div className="wc-body wc-body--center">
          <div className="wc-spinner" />
          <p className="wc-desc">Waiting for your signature…</p>
          <p className="wc-note">Approve the request in your wallet app to finish authorizing the agent.</p>
        </div>
      )}

      {/* ---------- State 7: authorized (steady state) ---------- */}
      {flow === 'authorized' && address && (
        <div className="wc-body">
          <div className="wc-success-badge">✓ Agent authorized — you're set up.</div>
          <p className="wc-addr mono">{shortAddr(address)}</p>
          {authTxId && (
            <p className="wc-note">
              Authorization tx: <span className="mono">{shortAddr(authTxId)}</span>
            </p>
          )}
          {error && <p className="wc-error">{error.message}</p>}
          <p className="wc-desc">
            You won't see wallet prompts for individual payments from here on.
          </p>
          <button className="wc-btn wc-btn--danger" onClick={handleRevoke}>
            Revoke access
          </button>
        </div>
      )}

      {/* ---------- State 8: revoking ---------- */}
      {flow === 'revoking' && (
        <div className="wc-body wc-body--center">
          <div className="wc-spinner" />
          <p className="wc-desc">Revoking access…</p>
          <p className="wc-note">Approve the revocation in your wallet to complete this.</p>
        </div>
      )}

      <style jsx>{`
        .wc-card {
          background: var(--surface-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px;
        }
        .wc-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wc-body--center {
          align-items: center;
          text-align: center;
          padding: 12px 0;
        }
        .wc-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .wc-desc {
          margin: 0;
          font-size: 0.88rem;
          color: var(--text-muted);
        }
        .wc-note {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .wc-error {
          margin: 0;
          font-size: 0.85rem;
          color: var(--accent);
        }
        .wc-addr {
          font-size: 0.85rem;
          color: var(--text);
        }
        .mono {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .wc-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wc-btn {
          padding: 9px 16px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
        }
        .wc-btn--primary {
          border-color: var(--accent);
          background: var(--accent);
          color: #fff;
        }
        .wc-btn--primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wc-btn--ghost {
          color: var(--text-muted);
        }
        .wc-btn--ghost:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .wc-btn--danger {
          align-self: flex-start;
          border-color: var(--accent);
          color: var(--accent);
        }
        .wc-btn--danger:hover {
          background: var(--accent);
          color: #fff;
        }
        .wc-list {
          margin: 0;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.86rem;
          color: var(--text);
        }
        .wc-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .wc-success-badge {
          display: inline-flex;
          align-self: flex-start;
          background: rgba(61, 220, 132, 0.14);
          color: #1f9d5c;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .wc-spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: wc-spin 0.8s linear infinite;
        }
        @keyframes wc-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  )
}
