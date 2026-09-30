'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { readSession, clearSession } from '@/lib/session';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rewardStats, setRewardStats] = useState({ totalPoints: 0, lifetimePoints: 0 });

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setUser(s);

    async function loadRewards() {
      try {
        const res = await fetch(`/api/rewards?userId=${s?.id || ''}`);
        const json = await res.json();
        setRewardStats({
          totalPoints: json.totalPoints || 0,
          lifetimePoints: json.lifetimePoints || 0,
        });
      } catch (err) {
        console.error(err);
      }
    }
    loadRewards();
  }, [router]);

  return (
    <div className="hyperdesk-shell">
      <TopBar />

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar__brand">HyperDesk</div>
          <nav className="nav-menu">
            <a href="/rigs" className="nav-item">🖥️ Browse Rigs</a>
            <a href="/sessions" className="nav-item">⏱️ My Sessions</a>
            <a href="/rewards" className="nav-item">🎁 Rewards & Points</a>
            <a href="/profile" className="nav-item active">👤 Profile</a>
          </nav>
          <button className="sidebar__logout" onClick={() => { clearSession(); router.push('/login'); }}>
            Sign Out
          </button>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <p className="eyebrow">USER PROFILE</p>
            <h1>Account & Wallet Overview</h1>
          </header>

          <div className="profile-card">
            <div className="profile-avatar">
              {user?.handle?.substring(0, 2).toUpperCase() || 'HD'}
            </div>
            <div className="profile-details">
              <h2>{user?.handle || 'HyperDesk User'}</h2>
              <span className="role-badge">{user?.role?.toUpperCase() || 'USER'}</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="section-card">
              <h3>🎁 Reward Balance</h3>
              <div className="big-stat">{rewardStats.totalPoints} <span className="stat-unit">pts</span></div>
              <p className="stat-sub">Lifetime earned: {rewardStats.lifetimePoints} pts</p>
              <a href="/rewards" className="btn-link">Go to Rewards & Redeem →</a>
            </div>

            <div className="section-card">
              <h3>💳 Algorand Wallet Connection</h3>
              <p className="wallet-addr mono">
                {process.env.NEXT_PUBLIC_PAY_TO || 'ALGO-TESTNET-CONNECTED'}
              </p>
              <p className="stat-sub">Connected via x402 Protocol for session minting.</p>
            </div>
          </div>
        </main>
      </div>

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
        .main-content {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .eyebrow {
          font-size: 0.75rem;
          color: var(--accent, #ff0000);
          font-weight: 700;
          margin: 0 0 4px;
        }
        h1 { margin: 0; font-size: 1.6rem; font-weight: 800; }
        .profile-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          font-size: 1.5rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .profile-details h2 { margin: 0 0 6px; font-size: 1.3rem; }
        .role-badge {
          background: rgba(255, 255, 255, 0.1);
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
        .section-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px;
        }
        .section-card h3 { margin: 0 0 12px; font-size: 1rem; }
        .big-stat { font-size: 2.2rem; font-weight: 800; color: var(--accent); }
        .stat-unit { font-size: 1rem; color: var(--text-muted); }
        .stat-sub { color: var(--text-muted); font-size: 0.85rem; margin: 6px 0 16px; }
        .btn-link { color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.88rem; }
        .wallet-addr { font-size: 0.82rem; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; overflow-x: auto; }
        .mono { font-family: monospace; }
      `}</style>
    </div>
  );
}
