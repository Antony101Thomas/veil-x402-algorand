'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { readSession, clearSession } from '@/lib/session';

export default function RewardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number>(120);
  const [lifetime, setLifetime] = useState<number>(250);
  const [txs, setTxs] = useState<any[]>([]);
  const [redeemPoints, setRedeemPoints] = useState<number>(100);
  const [msg, setMsg] = useState<string | null>(null);

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
        setPoints(json.totalPoints || 120);
        setLifetime(json.lifetimePoints || 250);
        setTxs(json.transactions || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadRewards();
  }, [router]);

  const handleRedeem = async () => {
    if (points < 100) {
      setMsg('Minimum 100 points required to redeem.');
      return;
    }
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, points: redeemPoints }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`Redeemed ${redeemPoints} pts for $${json.dollarValue} rental discount!`);
        setPoints((prev) => Math.max(0, prev - redeemPoints));
      } else {
        setMsg(json.error || 'Redemption failed');
      }
    } catch (err) {
      setMsg('Redemption failed');
    }
  };

  return (
    <div className="hyperdesk-shell">
      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar__brand">HyperDesk</div>
          <nav className="nav-menu">
            <a href="/rigs" className="nav-item">🖥️ Browse Rigs</a>
            <a href="/sessions" className="nav-item">⏱️ My Sessions</a>
            <a href="/rewards" className="nav-item active">🎁 Rewards & Points</a>
            <a href="/profile" className="nav-item">👤 Profile</a>
          </nav>
          <button className="sidebar__logout" onClick={() => { clearSession(); router.push('/login'); }}>
            Sign Out
          </button>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <p className="eyebrow">REWARDS & POINTS</p>
            <h1>Earn Points with Every Session</h1>
          </header>

          <div className="reward-hero-card">
            <div className="points-display">
              <span className="pts-num">{points}</span>
              <span className="pts-label">Available Points</span>
            </div>
            <div className="pts-lifetime">Lifetime Earned: {lifetime} pts</div>
          </div>

          <div className="grid-2">
            <div className="section-card">
              <h3>💡 How to Earn Points</h3>
              <ul className="earn-list">
                <li>⚡ <strong>10 Points per $1</strong> spent on rig rentals</li>
                <li>🎉 <strong>+50 Bonus Points</strong> on your first session</li>
                <li>⭐ <strong>+20 Bonus Points</strong> for leaving 5-star reviews</li>
              </ul>
            </div>

            <div className="section-card">
              <h3>🎁 Redeem for Discounts</h3>
              <p className="redeem-sub">100 Points = $1.00 off your next session</p>
              
              <div className="redeem-controls">
                <input
                  type="number"
                  step="100"
                  min="100"
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(parseInt(e.target.value, 10) || 100)}
                  className="pts-input"
                />
                <button type="button" className="btn-redeem" onClick={handleRedeem}>
                  Redeem ${ (redeemPoints / 100).toFixed(2) } Off
                </button>
              </div>

              {msg && <div className="msg-box">{msg}</div>}
            </div>
          </div>

          <div className="section-card">
            <h3>📜 Point Transaction Log</h3>
            <div className="tx-list">
              {txs.length === 0 ? (
                <p className="muted">No transactions recorded yet.</p>
              ) : (
                txs.map((t, i) => (
                  <div key={i} className="tx-item">
                    <span>{t.reason || 'Session Reward'}</span>
                    <strong className={t.delta > 0 ? 'pos' : 'neg'}>
                      {t.delta > 0 ? `+${t.delta}` : t.delta} pts
                    </strong>
                  </div>
                ))
              )}
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
        .sidebar__brand { font-size: 1.2rem; font-weight: 800; color: var(--accent, #ff0000); }
        .nav-menu { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .nav-item { padding: 10px 14px; border-radius: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
        .nav-item:hover, .nav-item.active { background: var(--surface, #181818); color: var(--text); }
        .sidebar__logout { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .main-content { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .eyebrow { font-size: 0.75rem; color: var(--accent, #ff0000); font-weight: 700; margin: 0 0 4px; }
        h1 { margin: 0; font-size: 1.6rem; font-weight: 800; }
        
        .reward-hero-card {
          background: linear-gradient(135deg, rgba(255, 0, 0, 0.15), rgba(168, 85, 247, 0.15));
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pts-num { font-size: 3.5rem; font-weight: 900; color: var(--accent); }
        .pts-label { display: block; font-size: 0.9rem; color: var(--text-muted); }
        .pts-lifetime { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
        .section-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
        .section-card h3 { margin: 0 0 12px; font-size: 1.1rem; }
        .earn-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; }
        .redeem-sub { color: var(--text-muted); font-size: 0.88rem; margin: 0 0 16px; }
        .redeem-controls { display: flex; gap: 10px; }
        .pts-input { width: 90px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); color: var(--text); padding: 8px; border-radius: 8px; font-weight: 700; text-align: center; }
        .btn-redeem { flex: 1; background: var(--accent); color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .msg-box { margin-top: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; font-size: 0.82rem; }
        .tx-list { display: flex; flex-direction: column; gap: 8px; }
        .tx-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
        .pos { color: #10b981; }
        .neg { color: var(--accent); }
      `}</style>
    </div>
  );
}
