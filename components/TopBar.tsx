'use client'

import { ThemeToggle } from './ThemeToggle'

export function TopBar() {
  return (
    <header className="topbar">
      <span className="topbar__brand">
        <span className="topbar__play" aria-hidden="true" />
        Veil
      </span>
      <ThemeToggle />

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
        }
        .topbar__play {
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 10px solid var(--accent);
        }
      `}</style>
    </header>
  )
}
