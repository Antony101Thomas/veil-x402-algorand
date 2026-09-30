'use client';

import { useState } from 'react';
import { DURATION_OPTIONS, calcSessionPrice } from '@/lib/rigs';

interface RigCardProps {
  rig: {
    id: string;
    name: string;
    gpu: string;
    cpu: string;
    ram: string;
    storage: string;
    useCases: string[] | string;
    pricePerHour: number;
    totalSlots: number;
    availableSlots: number;
    avgRating: number;
    ratingCount: number;
  };
  onBook?: (rigId: string, hours: number, totalPrice: number) => void;
  compact?: boolean;
}

export default function RigCard({ rig, onBook, compact = false }: RigCardProps) {
  const [selectedHours, setSelectedHours] = useState<number>(2);

  const useCasesList = Array.isArray(rig.useCases)
    ? rig.useCases
    : typeof rig.useCases === 'string'
    ? (rig.useCases as string).split(',')
    : [];

  const totalPrice = calcSessionPrice(rig.pricePerHour, selectedHours);

  const getTierClass = () => {
    if (rig.id === 'rig-starter') return 'tier-starter';
    if (rig.id === 'rig-pro') return 'tier-pro';
    return 'tier-beast';
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <span className="stars">
        {'★'.repeat(full)}
        {half ? '½' : ''}
        {'☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}
      </span>
    );
  };

  return (
    <div className={`rig-card ${getTierClass()}`}>
      <div className="rig-card__header">
        <div className="rig-card__title-wrap">
          <h3 className="rig-card__name">{rig.name}</h3>
          <span className="rig-card__badge">{rig.id.replace('rig-', '').toUpperCase()}</span>
        </div>
        <div className="rig-card__rating">
          {renderStars(rig.avgRating)}
          <span className="rating-num">{rig.avgRating.toFixed(1)}</span>
          <span className="rating-count">({rig.ratingCount})</span>
        </div>
      </div>

      <div className="rig-card__specs">
        <div className="spec-item">
          <span className="spec-label">🖥️ GPU</span>
          <span className="spec-val">{rig.gpu}</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">⚡ CPU</span>
          <span className="spec-val">{rig.cpu}</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">💾 RAM</span>
          <span className="spec-val">{rig.ram}</span>
        </div>
        <div className="spec-item">
          <span className="spec-label">💿 SSD</span>
          <span className="spec-val">{rig.storage}</span>
        </div>
      </div>

      <div className="rig-card__tags">
        {useCasesList.map((uc, i) => (
          <span key={i} className="use-case-tag">{uc.trim()}</span>
        ))}
      </div>

      <div className="rig-card__pricing">
        <div className="price-main">
          <span className="price-num">${rig.pricePerHour.toFixed(2)}</span>
          <span className="price-unit">/ hr</span>
        </div>
        <div className="availability-badge">
          <span className={`dot ${rig.availableSlots > 0 ? 'dot--green' : 'dot--red'}`} />
          {rig.availableSlots} / {rig.totalSlots} slots free
        </div>
      </div>

      {!compact && (
        <div className="rig-card__duration">
          <span className="duration-label">Select Session Length:</span>
          <div className="duration-picker">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                className={`duration-btn ${selectedHours === opt.hours ? 'active' : ''}`}
                onClick={() => setSelectedHours(opt.hours)}
              >
                {opt.hours}h
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rig-card__action">
        {!compact && (
          <div className="total-preview">
            Total: <span className="total-num">${totalPrice.toFixed(2)}</span> USDC
          </div>
        )}
        <button
          type="button"
          className="btn-book"
          disabled={rig.availableSlots <= 0}
          onClick={() => onBook?.(rig.id, selectedHours, totalPrice)}
        >
          {rig.availableSlots > 0 ? (compact ? 'Book Rig' : 'Launch Session') : 'Sold Out'}
        </button>
      </div>

      <style jsx>{`
        .rig-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rig-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent);
        }

        .rig-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .rig-card__name {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
        }
        .rig-card__badge {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--border);
          color: var(--text);
          margin-top: 4px;
        }

        .rig-card__rating {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.82rem;
        }
        .stars {
          color: #f59e0b;
        }
        .rating-num {
          font-weight: 700;
        }
        .rating-count {
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .rig-card__specs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          font-size: 0.82rem;
        }
        .spec-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .spec-label {
          color: var(--text-muted);
          font-size: 0.72rem;
        }
        .spec-val {
          font-weight: 600;
        }

        .rig-card__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .use-case-tag {
          font-size: 0.75rem;
          background: var(--bg);
          border: 1px solid var(--border);
          padding: 3px 10px;
          border-radius: 999px;
          color: var(--text-muted);
        }

        .rig-card__pricing {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .price-num {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text);
        }
        .price-unit {
          color: var(--text-muted);
          font-size: 0.82rem;
          margin-left: 4px;
        }

        .availability-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot--green { background: #10b981; }
        .dot--red { background: #ef4444; }

        .rig-card__duration {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .duration-label {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .duration-picker {
          display: flex;
          gap: 6px;
        }
        .duration-btn {
          flex: 1;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 6px 0;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .duration-btn.active {
          background: var(--btn-bg);
          border-color: var(--btn-bg);
          color: var(--btn-text);
        }

        .rig-card__action {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }
        .total-preview {
          font-size: 0.82rem;
          color: var(--text-muted);
          text-align: center;
        }
        .total-num {
          font-weight: 700;
          color: var(--text);
        }
        .btn-book {
          width: 100%;
          background: var(--btn-bg);
          color: var(--btn-text);
          border: none;
          padding: 12px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .btn-book:hover:not(:disabled) {
          opacity: 0.88;
        }
        .btn-book:disabled {
          background: var(--border);
          color: var(--text-muted);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
