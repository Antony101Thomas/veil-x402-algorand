'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import SessionCard from '@/components/SessionCard';
import RatingModal from '@/components/RatingModal';
import { readSession, clearSession } from '@/lib/session';

export default function SessionsPage() {
  const router = useRouter();
  const [userSession, setUserSession] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingTarget, setRatingTarget] = useState<{ sessionId: string; rigId: string } | null>(null);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUserSession(session);
    fetchSessions();
  }, [router]);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      const json = await res.json();
      if (json.sessions) {
        setSessions(json.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleRevoke = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/revoke`, { method: 'POST' });
      if (res.ok) {
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  };

  const handleRatingSubmit = async (stars: number, review: string) => {
    if (!ratingTarget) return;
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: ratingTarget.sessionId,
        rigId: ratingTarget.rigId,
        stars,
        review,
        userId: userSession?.id,
      }),
    });
  };

  const activeCount = sessions.filter((s) => !s.revoked).length;
  const revokedCount = sessions.filter((s) => s.revoked).length;

  return (
    <div className="hyperdesk-shell">
      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar__brand">HyperDesk</div>
          <nav className="nav-menu">
            <a href="/rigs" className="nav-item">🖥️ Browse Rigs</a>
            <a href="/sessions" className="nav-item active">⏱️ My Sessions</a>
            <a href="/rewards" className="nav-item">🎁 Rewards & Points</a>
            <a href="/profile" className="nav-item">👤 Profile</a>
          </nav>
          <button className="sidebar__logout" onClick={() => { clearSession(); router.push('/login'); }}>
            Sign Out
          </button>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <div>
              <p className="eyebrow">MY SESSIONS</p>
              <h1>Active & Past Cloud Rig Sessions</h1>
            </div>
            <a href="/rigs" className="btn-launch">+ Launch New Session</a>
          </header>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-num">{activeCount}</span>
              <span className="stat-label">Active Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{sessions.length}</span>
              <span className="stat-label">Total Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{revokedCount}</span>
              <span className="stat-label">Ended Sessions</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading your sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-card">
              <h3>No Sessions Found</h3>
              <p>You haven't launched any cloud rig sessions yet.</p>
              <a href="/rigs" className="btn-launch-sm">Browse Rig Fleet</a>
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map((s) => (
                <SessionCard
                  key={s.credential_id}
                  session={s}
                  onRevoke={handleRevoke}
                  onRate={(sessionId, rigId) => setRatingTarget({ sessionId, rigId })}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {ratingTarget && (
        <RatingModal
          sessionId={ratingTarget.sessionId}
          rigId={ratingTarget.rigId}
          rigName={ratingTarget.rigId.replace('rig-', '').toUpperCase() + ' RIG'}
          onClose={() => setRatingTarget(null)}
          onSubmit={handleRatingSubmit}
        />
      )}

      <style jsx>{`
        .hyperdesk-shell {
          min-height: 100vh;
          background: var(--bg, #0f0f0f);
          color: var(--text, #f1f1f1);
        }
        .shell-body {
          display: grid;
          grid-template-columns: 240px 1fr;
          min-height: calc(100vh - 64px);
        }
        @media (max-width: 800px) {
          .shell-body { grid-template-columns: 1fr; }
          .sidebar { display: none; }
        }
        .sidebar {
          border-right: 1px solid var(--border);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .sidebar__brand {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--accent, #ff0000);
        }
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .nav-item {
          padding: 10px 14px;
          border-radius: 8px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .nav-item:hover, .nav-item.active {
          background: var(--surface, #181818);
          color: var(--text);
        }
        .sidebar__logout {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 10px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .sidebar__logout:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .main-content {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .eyebrow {
          font-size: 0.75rem;
          color: var(--accent, #ff0000);
          font-weight: 700;
          letter-spacing: 0.12em;
          margin: 0 0 4px;
        }
        h1 { margin: 0; font-size: 1.6rem; font-weight: 800; }
        .btn-launch {
          background: var(--accent, #ff0000);
          color: #fff;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-num { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
        .stat-label { font-size: 0.8rem; color: var(--text-muted); }

        .loading-state, .empty-card {
          text-align: center;
          padding: 60px 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          color: var(--text-muted);
        }
        .empty-card h3 { color: var(--text); margin: 0 0 8px; }
        .btn-launch-sm {
          display: inline-block;
          margin-top: 16px;
          background: var(--accent);
          color: #fff;
          padding: 8px 18px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 700;
        }

        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
