'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, readSession, type Session } from '@/lib/session';
import { RIG_CONFIGS, Rig } from '@/lib/rigs';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AgentDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [points, setPoints] = useState<number>(120);
  const [selectedUseCase, setSelectedUseCase] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const parsed = readSession();
    if (!parsed) {
      router.replace('/login');
      return;
    }
    setSession(parsed);

    async function loadUserData() {
      try {
        const [sessRes, rewRes] = await Promise.all([
          fetch('/api/sessions').catch(() => null),
          fetch(`/api/rewards?userId=${parsed?.id || ''}`).catch(() => null),
        ]);
        if (sessRes && sessRes.ok) {
          const json = await sessRes.json();
          if (json.sessions) setActiveSessions(json.sessions.filter((s: any) => !s.revoked));
        }
        if (rewRes && rewRes.ok) {
          const json = await rewRes.json();
          if (json.totalPoints) setPoints(json.totalPoints);
        }
      } catch (err) {
        console.error('Error loading user dashboard:', err);
      }
    }
    loadUserData();
  }, [router]);

  const handleSignOut = () => {
    clearSession();
    router.replace('/login');
  };

  const filteredRecommendedRigs = RIG_CONFIGS.filter((rig) => {
    const matchesUseCase =
      selectedUseCase === 'All' ||
      rig.useCases.some((uc) => uc.toLowerCase().includes(selectedUseCase.toLowerCase()));
    const matchesSearch =
      !searchQuery ||
      rig.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rig.gpu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rig.cpu.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUseCase && matchesSearch;
  });

  return (
    <div className="dash-shell">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <span>HyperDesk</span>
          <div style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
          </div>
        </div>

        <div className="user-profile-badge">
          <div className="avatar-circle">
            {session?.handle?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-meta">
            <span className="handle-name">{session?.handle || 'Agent'}</span>
            <span className="role-tag">{session?.role === 'admin' ? '🛡️ Admin' : '⚡ Agent User'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="/agent" className="nav-item active">
            <span className="icon">⌂</span> Dashboard
          </a>
          <a href="/rigs" className="nav-item">
            <span className="icon">🖥️</span> Browse Fleet
          </a>
          <a href="/sessions" className="nav-item">
            <span className="icon">⏱️</span> Active Sessions
            {activeSessions.length > 0 && <span className="nav-badge">{activeSessions.length}</span>}
          </a>
          <a href="/host" className="nav-item nav-item--host">
            <span className="icon">💻</span> Host PC Mode
          </a>
          <a href="/rewards" className="nav-item">
            <span className="icon">🎁</span> Rewards & Points
          </a>
          <a href="/profile" className="nav-item">
            <span className="icon">👤</span> My Account
          </a>
        </nav>

        <button type="button" onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="dash-main">
        {/* Header Banner */}
        <header className="dash-header">
          <div>
            <p className="eyebrow">⚡ HYPERDESK DASHBOARD</p>
            <h1>Welcome back, <span className="highlight">{session?.handle || 'User'}</span></h1>
            <p className="subtext">
              Your personalized cloud PC rental hub. Manage active streams, explore GPU tiers, and earn reward points on Algorand.
            </p>
          </div>
          <div className="quick-actions">
            <ThemeToggle />
            <a href="/rigs" className="btn-action primary">Rent a Rig Now</a>
            <a href="/host" className="btn-action ghost">Host My PC</a>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Active Streams</span>
              <span className="stat-icon">⚡</span>
            </div>
            <div className="stat-value">{activeSessions.length}</div>
            <p className="stat-sub">
              {activeSessions.length > 0
                ? `${activeSessions.length} live GPU stream(s) connected`
                : 'No active session — Rent a rig to launch'}
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Reward Points</span>
              <span className="stat-icon">🎁</span>
            </div>
            <div className="stat-value">{points} <span className="unit">pts</span></div>
            <p className="stat-sub">
              ${(points / 100).toFixed(2)} USDC in session discounts earned
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Payment Settlement</span>
              <span className="stat-icon">◈</span>
            </div>
            <div className="stat-value">x402 <span className="unit">USDC</span></div>
            <p className="stat-sub">Algorand TestNet • Single-use capabilities</p>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Fleet Availability</span>
              <span className="stat-icon">🖥️</span>
            </div>
            <div className="stat-value">
              {RIG_CONFIGS.reduce((sum, r) => sum + r.availableSlots, 0)} / {RIG_CONFIGS.reduce((sum, r) => sum + r.totalSlots, 0)}
            </div>
            <p className="stat-sub">High-demand GPU rigs online now</p>
          </div>
        </section>

        {/* Tailored Preferences & Recommendations */}
        <section className="recommendations-section">
          <div className="section-head">
            <div>
              <h2>Tailored Rigs For Your Workload</h2>
              <p className="section-sub">Discover rigs filtered by your preferred use-case or performance specs</p>
            </div>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search GPU, CPU, specs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Use Case Tabs */}
          <div className="usecase-tabs">
            {['All', 'Gaming', 'AI / ML', 'Editing', 'Rendering'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`tab-btn ${selectedUseCase === cat ? 'active' : ''}`}
                onClick={() => setSelectedUseCase(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Rig Cards Grid */}
          <div className="rig-cards-grid">
            {filteredRecommendedRigs.map((rig) => (
              <div key={rig.id} className="dash-rig-card">
                <div className="rig-badge-strip">
                  <span className="tier-tag">{rig.name}</span>
                  <span className="rating-tag">★ {rig.avgRating} ({rig.ratingCount})</span>
                </div>
                <h3 className="rig-gpu-title">{rig.gpu}</h3>
                <div className="specs-list">
                  <div className="spec-item"><span className="label">CPU:</span> {rig.cpu}</div>
                  <div className="spec-item"><span className="label">RAM:</span> {rig.ram}</div>
                  <div className="spec-item"><span className="label">Storage:</span> {rig.storage}</div>
                </div>
                <div className="usecase-tags">
                  {rig.useCases.map((uc) => (
                    <span key={uc} className="uc-chip">{uc}</span>
                  ))}
                </div>
                <div className="card-footer">
                  <div className="price-tag">${rig.pricePerHour.toFixed(2)} <span>/ hr</span></div>
                  <a href={`/rigs?select=${rig.id}`} className="btn-launch">
                    Rent Rig
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Active Sessions Quick View */}
        <section className="active-sessions-section">
          <h2>My Active Sessions</h2>
          {activeSessions.length === 0 ? (
            <div className="empty-sessions">
              <p>You have no active PC rentals running right now.</p>
              <a href="/rigs" className="btn-browse-fleet">Browse Available Rigs</a>
            </div>
          ) : (
            <div className="sessions-list">
              {activeSessions.map((sess) => (
                <div key={sess.sessionId} className="session-item-card">
                  <div className="sess-info">
                    <h4>{sess.rigName || sess.rigId}</h4>
                    <span className="sess-time">Rented for {sess.hours} hr(s)</span>
                  </div>
                  <div className="sess-status">
                    <span className="live-dot" /> Live Connected
                  </div>
                  <a href={`/stream/${sess.sessionId}`} className="btn-stream">
                    Stream PC →
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .dash-shell {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, sans-serif;
        }
        @media (max-width: 900px) {
          .dash-shell { grid-template-columns: 1fr; }
          .dash-sidebar { display: none; }
        }

        /* Sidebar */
        .dash-sidebar {
          background: var(--surface);
          border-right: 1px solid var(--border);
          padding: 28px 20px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text);
        }
        .brand-icon {
          color: var(--accent);
        }
        .user-profile-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .avatar-circle {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--btn-bg);
          color: var(--btn-text);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-meta {
          display: flex;
          flex-direction: column;
        }
        .handle-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text);
        }
        .role-tag {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .nav-item:hover, .nav-item.active {
          background: var(--surface-raised);
          color: var(--text);
        }
        .nav-item.active {
          border-left: 3px solid var(--accent);
        }
        .nav-item--host {
          color: #10b981;
        }
        .nav-badge {
          margin-left: auto;
          background: var(--accent);
          color: var(--accent-contrast);
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 999px;
        }
        .btn-signout {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 10px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-signout:hover {
          border-color: var(--accent);
          color: var(--text);
        }

        /* Main Content */
        .dash-main {
          padding: 36px 40px;
          display: flex;
          flex-direction: column;
          gap: 36px;
          max-width: 1200px;
        }
        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          flex-wrap: wrap;
        }
        .eyebrow {
          font-size: 0.75rem;
          letter-spacing: 0.14em;
          color: var(--text-muted);
          font-weight: 700;
          margin: 0 0 6px;
        }
        h1 {
          font-size: 2.1rem;
          font-weight: 800;
          margin: 0 0 8px;
          color: var(--text);
        }
        .highlight {
          color: var(--text);
        }
        .subtext {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin: 0;
          max-width: 580px;
        }
        .quick-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-action {
          padding: 12px 22px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.9rem;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .btn-action.primary {
          background: var(--btn-bg);
          color: var(--btn-text);
        }
        .btn-action.primary:hover {
          opacity: 0.9;
        }
        .btn-action.ghost {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }
        .btn-action.ghost:hover {
          border-color: var(--accent);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        @media (max-width: 1000px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-header {
          display: flex;
          justify-content: space-between;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .stat-value {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text);
        }
        .stat-value .unit {
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .stat-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin: 0;
        }

        /* Recommendations Section */
        .recommendations-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .section-head h2 {
          font-size: 1.3rem;
          font-weight: 800;
          margin: 0 0 4px;
          color: var(--text);
        }
        .section-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin: 0;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg);
          border: 1px solid var(--border);
          padding: 8px 14px;
          border-radius: 999px;
          width: 240px;
        }
        .search-box input {
          background: transparent;
          border: none;
          color: var(--text);
          font-size: 0.85rem;
          outline: none;
          width: 100%;
        }

        /* Use Case Tabs */
        .usecase-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tab-btn {
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          background: var(--btn-bg);
          border-color: var(--btn-bg);
          color: var(--btn-text);
        }

        /* Cards Grid */
        .rig-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 900px) {
          .rig-cards-grid { grid-template-columns: 1fr; }
        }
        .dash-rig-card {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dash-rig-card:hover {
          border-color: var(--text-muted);
        }
        .rig-badge-strip {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tier-tag {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .rating-tag {
          font-size: 0.78rem;
          color: #eab308;
          font-weight: 600;
        }
        .rig-gpu-title {
          font-size: 1.15rem;
          font-weight: 800;
          margin: 0;
          color: var(--text);
        }
        .specs-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .spec-item .label {
          color: var(--text-muted);
        }
        .usecase-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .uc-chip {
          background: var(--border);
          color: var(--text);
          font-size: 0.7rem;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid var(--border);
        }
        .price-tag {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text);
        }
        .price-tag span {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .btn-launch {
          background: var(--btn-bg);
          color: var(--btn-text);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s ease;
        }
        .btn-launch:hover {
          opacity: 0.88;
        }

        /* Active Sessions Section */
        .active-sessions-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }
        .active-sessions-section h2 {
          font-size: 1.15rem;
          margin: 0 0 16px;
          color: var(--text);
        }
        .empty-sessions {
          text-align: center;
          padding: 24px;
          color: var(--text-muted);
          font-size: 0.9rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .btn-browse-fleet {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 18px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .btn-browse-fleet:hover {
          border-color: var(--text);
        }
        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .session-item-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 18px;
        }
        .sess-info h4 {
          margin: 0 0 4px;
          font-size: 0.95rem;
          color: var(--text);
        }
        .sess-time {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .sess-status {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #10b981;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }
        .btn-stream {
          background: var(--btn-bg);
          color: var(--btn-text);
          padding: 8px 14px;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}