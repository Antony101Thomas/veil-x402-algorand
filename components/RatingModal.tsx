'use client';

import { useState } from 'react';

interface RatingModalProps {
  sessionId: string;
  rigId: string;
  rigName: string;
  onClose: () => void;
  onSubmit: (stars: number, review: string) => Promise<void>;
}

export default function RatingModal({ sessionId, rigName, onClose, onSubmit }: RatingModalProps) {
  const [stars, setStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(stars, review);
      setDone(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const activeStarCount = hoverStars || stars;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {done ? (
          <div className="success-state">
            <span className="success-icon">🎉</span>
            <h3>Rating Submitted!</h3>
            <p>Thanks for rating your session on <strong>{rigName}</strong>.</p>
            {stars === 5 && <div className="bonus-tag">+20 Reward Points Earned!</div>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <h3 className="modal-title">Rate Your Session</h3>
            <p className="modal-sub">How was your experience on <strong>{rigName}</strong>?</p>

            <div className="star-picker">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`star-btn ${s <= activeStarCount ? 'active' : ''}`}
                  onMouseEnter={() => setHoverStars(s)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setStars(s)}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="review-input"
              rows={3}
              placeholder="Add an optional review (e.g. FPS performance, latency, rendering speed)..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .modal-card {
          background: var(--surface, #181818);
          border: 1px solid var(--border, #303030);
          border-radius: 16px;
          padding: 28px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        .modal-title {
          margin: 0 0 6px;
          font-size: 1.3rem;
        }
        .modal-sub {
          color: var(--text-muted);
          font-size: 0.88rem;
          margin: 0 0 20px;
        }
        .star-picker {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
        }
        .star-btn {
          background: none;
          border: none;
          font-size: 2.2rem;
          color: #444;
          cursor: pointer;
          transition: transform 0.15s ease, color 0.15s ease;
        }
        .star-btn.active {
          color: #f59e0b;
        }
        .star-btn:hover {
          transform: scale(1.15);
        }
        .review-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text);
          padding: 12px;
          font-family: inherit;
          font-size: 0.88rem;
          resize: none;
          margin-bottom: 20px;
          outline: none;
        }
        .review-input:focus {
          border-color: var(--accent, #ff0000);
        }
        .modal-actions {
          display: flex;
          gap: 12px;
        }
        .btn-cancel {
          flex: 1;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 10px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit {
          flex: 2;
          background: var(--accent, #ff0000);
          border: none;
          color: #fff;
          padding: 10px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .success-state {
          text-align: center;
          padding: 10px 0;
        }
        .success-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 12px;
        }
        .bonus-tag {
          display: inline-block;
          margin-top: 14px;
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
}
