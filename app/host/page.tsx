'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { readSession, clearSession } from '@/lib/session';

export default function HostDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [hostRigs, setHostRigs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state for listing a new PC
  const [rigName, setRigName] = useState("Anton's RTX 4080 Rig");
  const [gpu, setGpu] = useState("NVIDIA RTX 4080 16GB");
  const [cpu, setCpu] = useState("Intel Core i9-14900K");
  const [ram, setRam] = useState("32 GB DDR5");
  const [storage, setStorage] = useState("1 TB NVMe SSD");
  const [price, setPrice] = useState("1.50");

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSession(s);
    loadHostData();

    const interval = setInterval(loadHostData, 4000); // Live poll connection requests every 4s
    return () => clearInterval(interval);
  }, [router]);

  async function loadHostData() {
    try {
      const [rigsRes, reqsRes] = await Promise.all([
        fetch('/api/host/rigs'),
        fetch('/api/host/requests'),
      ]);
      const rigsJson = await rigsRes.json();
      const reqsJson = await reqsRes.json();

      if (rigsJson.hostRigs) setHostRigs(rigsJson.hostRigs);
      if (reqsJson.requests) setRequests(reqsJson.requests);
    } catch (err) {
      console.error('Failed to load host telemetry:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddRig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/host/rigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: session?.handle || 'Host',
          rigName,
          gpu,
          cpu,
          ram,
          storage,
          pricePerHour: price,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        loadHostData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (requestId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/host/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status: approve ? 'approved' : 'rejected',
        }),
      });
      if (res.ok) {
        loadHostData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const activeStreams = requests.filter((r) => r.status === 'approved' || r.status === 'connected');

  return (
    <div className="hyperdesk-shell">
      <TopBar />

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar__brand">HyperDesk Host</div>
          <nav className="nav-menu">
            <a href="/host" className="nav-item active">🖥️ Host Console</a>
            <a href="/rigs" className="nav-item">🛒 Browse Rigs</a>
            <a href="/sessions" className="nav-item">⏱️ My Sessions</a>
            <a href="/rewards" className="nav-item">🎁 Rewards</a>
          </nav>
          <button className="sidebar__logout" onClick={() => { clearSession(); router.push('/login'); }}>
            Sign Out
          </button>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <div>
              <p className="eyebrow">P2P PC SHARING</p>
              <h1>Host Dashboard & Remote Desk Control</h1>
              <p className="subtext">Share your gaming rig when idle, earn ALGO/USDC, and grant remote access on demand.</p>
            </div>
            <button className="btn-add-pc" onClick={() => setShowAddModal(true)}>
              + List My PC For Rent
            </button>
          </header>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-num">{hostRigs.length}</span>
              <span className="stat-label">Listed Rigs</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{pendingRequests.length}</span>
              <span className="stat-label">Pending Requests</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{activeStreams.length}</span>
              <span className="stat-label">Active Remote Streams</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">$3.60</span>
              <span className="stat-label">USDC Earned</span>
            </div>
          </div>

          {/* Incoming AnyDesk Permission Requests */}
          <section className="section-card request-section">
            <div className="section-header">
              <h2>🔔 Live Access Requests (AnyDesk-style Handshake)</h2>
              <span className="live-pulse">● LIVE LISTENING</span>
            </div>
            <p className="section-sub">
              When another user pays via x402 on Algorand to rent your PC, their access request appears here for your authorization.
            </p>

            {requests.length === 0 ? (
              <div className="empty-box">No connection requests yet. Keep your PC online!</div>
            ) : (
              <div className="requests-list">
                {requests.map((req) => (
                  <div key={req.id} className={`request-card req-${req.status}`}>
                    <div className="req-main">
                      <div className="req-user-icon">👤</div>
                      <div className="req-info">
                        <strong>{req.renter_name}</strong> is requesting remote desktop access
                        <div className="req-meta">
                          IP: <code className="mono">{req.ip_address}</code> · Session: <code className="mono">{req.session_id}</code>
                        </div>
                      </div>
                    </div>

                    <div className="req-action">
                      {req.status === 'pending' ? (
                        <>
                          <button className="btn-deny" onClick={() => handleApprove(req.id, false)}>
                            Deny
                          </button>
                          <button className="btn-approve" onClick={() => handleApprove(req.id, true)}>
                            ✓ Grant Permission
                          </button>
                        </>
                      ) : (
                        <span className={`status-tag status-${req.status}`}>
                          {req.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* My Listed PCs */}
          <section className="section-card">
            <h2>🖥️ My Shared PCs</h2>
            <div className="rigs-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>PC Name</th>
                    <th>GPU Spec</th>
                    <th>CPU Spec</th>
                    <th>Price / hr</th>
                    <th>Status</th>
                    <th>Remote Desktop Stream</th>
                  </tr>
                </thead>
                <tbody>
                  {hostRigs.map((rig) => (
                    <tr key={rig.id}>
                      <td><strong>{rig.rig_name}</strong></td>
                      <td>{rig.gpu}</td>
                      <td>{rig.cpu}</td>
                      <td>${Number(rig.price_per_hour).toFixed(2)} USDC</td>
                      <td>
                        <span className="badge badge-online">● ONLINE</span>
                      </td>
                      <td>
                        <a href={`/stream/${rig.id}`} className="btn-view-stream">
                          🖥️ Open Stream View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Modal to list a new PC */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>List Your PC for Rent</h3>
            <p className="modal-sub">Earn passive crypto by letting users stream your PC specs when you are not using it.</p>

            <form onSubmit={handleAddRig} className="add-form">
              <label>
                PC / Rig Name:
                <input type="text" value={rigName} onChange={(e) => setRigName(e.target.value)} required />
              </label>

              <div className="form-row">
                <label>
                  GPU Specification:
                  <input type="text" value={gpu} onChange={(e) => setGpu(e.target.value)} required />
                </label>
                <label>
                  CPU Specification:
                  <input type="text" value={cpu} onChange={(e) => setCpu(e.target.value)} required />
                </label>
              </div>

              <div className="form-row">
                <label>
                  RAM:
                  <input type="text" value={ram} onChange={(e) => setRam(e.target.value)} required />
                </label>
                <label>
                  Storage:
                  <input type="text" value={storage} onChange={(e) => setStorage(e.target.value)} required />
                </label>
              </div>

              <label>
                Price Per Hour (USDC):
                <input type="number" step="0.10" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Publish PC to Network
                </button>
              </div>
            </form>
          </div>
        </div>
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
        .sidebar__brand { font-size: 1.2rem; font-weight: 800; color: var(--accent, #ff0000); }
        .nav-menu { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .nav-item { padding: 10px 14px; border-radius: 8px; color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
        .nav-item:hover, .nav-item.active { background: var(--surface, #181818); color: var(--text); }
        .sidebar__logout { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .main-content { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
        .eyebrow { font-size: 0.75rem; color: var(--accent, #ff0000); font-weight: 700; margin: 0 0 4px; letter-spacing: 0.1em; }
        h1 { margin: 0 0 4px; font-size: 1.6rem; font-weight: 800; }
        .subtext { color: var(--text-muted); font-size: 0.9rem; margin: 0; }
        .btn-add-pc {
          background: var(--btn-bg);
          color: var(--btn-text);
          border: none;
          padding: 12px 22px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 0.9rem;
          cursor: pointer;
        }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-num { font-size: 1.8rem; font-weight: 800; color: var(--text); }
        .stat-label { font-size: 0.8rem; color: var(--text-muted); }
        .section-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 24px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .section-header h2 { margin: 0; font-size: 1.15rem; }
        .live-pulse { font-size: 0.75rem; font-weight: 700; color: #10b981; letter-spacing: 0.1em; }
        .section-sub { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 16px; }
        .empty-box { background: rgba(0,0,0,0.2); border: 1px dashed var(--border); padding: 24px; border-radius: 10px; text-align: center; color: var(--text-muted); font-size: 0.9rem; }
        .requests-list { display: flex; flex-direction: column; gap: 10px; }
        .request-card {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .req-pending { border-color: #f59e0b; }
        .req-approved { border-color: #10b981; }
        .req-main { display: flex; align-items: center; gap: 14px; }
        .req-user-icon { font-size: 1.5rem; }
        .req-meta { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .mono { font-family: monospace; }
        .req-action { display: flex; gap: 8px; }
        .btn-deny { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .btn-approve { background: #10b981; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .status-tag { font-size: 0.78rem; font-weight: 800; padding: 6px 12px; border-radius: 6px; }
        .status-approved { background: rgba(16,185,129,0.2); color: #10b981; }
        .status-rejected { background: rgba(239,68,68,0.2); color: #ef4444; }
        .table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .table th { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); }
        .table td { padding: 12px 10px; border-bottom: 1px solid var(--border); }
        .badge-online { background: rgba(16,185,129,0.15); color: #10b981; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; }
        .btn-view-stream { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 600; }
        .btn-view-stream:hover { border-color: var(--accent); }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px; max-width: 500px; width: 100%; }
        .modal-card h3 { margin: 0 0 6px; font-size: 1.3rem; }
        .modal-sub { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 20px; }
        .add-form { display: flex; flex-direction: column; gap: 14px; font-size: 0.88rem; }
        .add-form label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
        .add-form input { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px; outline: none; }
        .add-form input:focus { border-color: var(--accent); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-actions { display: flex; gap: 12px; margin-top: 10px; }
        .btn-cancel { flex: 1; background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .btn-submit { flex: 2; background: var(--btn-bg); color: var(--btn-text); border: none; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; }
      `}</style>
    </div>
  );
}
