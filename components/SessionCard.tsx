'use client';

interface SessionCardProps {
  session: {
    credential_id: string;
    resource_id: string;
    quota: number;
    quota_used?: number;
    expiry_round: number;
    revoked: boolean;
    created_at: string;
  };
  onRevoke?: (sessionId: string) => void;
  onRate?: (sessionId: string, rigId: string) => void;
}

export default function SessionCard({ session, onRevoke, onRate }: SessionCardProps) {
  const isRevoked = session.revoked;
  const createdDate = new Date(session.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getRigName = (id: string) => {
    if (id === 'rig-beast') return 'Beast Rig (RTX 4090)';
    if (id === 'rig-pro') return 'Pro Rig (RTX 4070 Ti)';
    if (id === 'rig-starter') return 'Starter Rig (RTX 3060)';
    return id;
  };

  return (
    <div className="session-card">
      <div className="session-card__left">
        <div className="session-rig">{getRigName(session.resource_id)}</div>
        <div className="session-id mono">{session.credential_id}</div>
        <div className="session-time">Started {createdDate}</div>
      </div>

      <div className="session-card__right">
        <div className="session-status">
          {isRevoked ? (
            <span className="badge badge--revoked">REVOKED</span>
          ) : (
            <span className="badge badge--active">ACTIVE</span>
          )}
        </div>

        <div className="session-actions">
          {!isRevoked && onRevoke && (
            <button className="btn-action btn-revoke" onClick={() => onRevoke(session.credential_id)}>
              Disconnect
            </button>
          )}
          {onRate && (
            <button className="btn-action btn-rate" onClick={() => onRate(session.credential_id, session.resource_id)}>
              Rate Session
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .session-card {
          background: var(--surface, #181818);
          border: 1px solid var(--border, #303030);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .session-rig {
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: 4px;
        }
        .session-id {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .session-time {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .mono {
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .session-card__right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }
        .badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.05em;
        }
        .badge--active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        .badge--revoked {
          background: color-mix(in srgb, var(--accent, #ff0000) 15%, transparent);
          color: var(--accent, #ff0000);
        }
        .session-actions {
          display: flex;
          gap: 8px;
        }
        .btn-action {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-revoke {
          background: transparent;
          border: 1px solid var(--accent, #ff0000);
          color: var(--accent, #ff0000);
        }
        .btn-revoke:hover {
          background: var(--accent, #ff0000);
          color: #fff;
        }
        .btn-rate {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }
        .btn-rate:hover {
          border-color: #f59e0b;
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}
