'use client'

import { useTheme } from '../context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className="yt-toggle"
    >
      <span className="yt-toggle__track">
        {/* faint "watch progress" tick marks — nods to a video scrubber, not decoration for its own sake */}
        <span className="yt-toggle__ticks" aria-hidden="true">
          <i /><i /><i />
        </span>
      </span>
      <span className="yt-toggle__thumb">
        {isDark ? (
          // moon glyph
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
            <path
              d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
              fill="currentColor"
            />
          </svg>
        ) : (
          // sun glyph
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5" />
              <path d="M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
            </g>
          </svg>
        )}
      </span>

      <style jsx>{`
        .yt-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: 52px;
          height: 28px;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .yt-toggle:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
          border-radius: 999px;
        }
        .yt-toggle__track {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: var(--toggle-track);
          border: 1px solid var(--toggle-border);
          transition: background 180ms ease, border-color 180ms ease;
          overflow: hidden;
        }
        .yt-toggle__ticks {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          gap: 4px;
          opacity: 0.35;
        }
        .yt-toggle__ticks i {
          width: 2px;
          height: 8px;
          border-radius: 1px;
          background: var(--toggle-tick);
          display: block;
        }
        .yt-toggle__thumb {
          position: relative;
          width: 22px;
          height: 22px;
          margin-left: 3px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          transform: translateX(${isDark ? '24px' : '0px'});
          transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </button>
  )
}