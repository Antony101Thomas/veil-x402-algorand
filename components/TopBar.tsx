'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'

const SESSION_KEY = 'veil-session'

type Session = { handle: string; role: 'agent' | 'admin' }

function readCookieSession(): Session | null {
  const match = document.cookie.match(new RegExp('(^| )' + SESSION_KEY + '=([^;]+)'))
  const raw = match ? decodeURIComponent(match[2]) : null
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

function readLocalStorageSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function TopBar() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    function readSession() {
      setSession(readLocalStorageSession() ?? readCookieSession())
    }
    readSession()
    window.addEventListener('storage', readSession)
    const poll = setInterval(readSession, 1000)
    return () => {
      window.removeEventListener('storage', readSession)
      clearInterval(poll)
    }
  }, [])

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        onClick={() => window.location.reload()}
      >
        <span className="topbar__play" aria-hidden="true" />
        Veil
      </button>
      <div className="topbar__right">
        {session?.role === 'agent' && (
          <Link href="/wallet" className="topbar__wallet-badge" aria-label="Wallet">
            <img src="/wallet-icon.png" alt="Wallet" width={35} height={35} />
          </Link>
        )}
        <ThemeToggle />
      </div>
      <style jsx>{`
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }
        .topbar__brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.01em;
          color: var(--text);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .topbar__brand:hover {
          opacity: 0.8;
        }
        .topbar__play {
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 10px solid var(--accent);
        }
        .topbar__right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .topbar__wallet-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 35px;
          height: 35px;
          text-decoration: none;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .topbar__wallet-badge img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .topbar__wallet-badge:hover {
          opacity: 0.88;
        }
        .topbar__wallet-badge:active {
          transform: scale(0.94);
        }
      `}</style>
    </header>
  )
}