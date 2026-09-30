'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import RigCard from '@/components/RigCard';
import { RIG_CONFIGS, Rig } from '@/lib/rigs';
import { readSession } from '@/lib/session';

export default function RigsPage() {
  const router = useRouter();
  const [rigs, setRigs] = useState<Rig[]>(RIG_CONFIGS);
  const [loading, setLoading] = useState(true);
  
  // Filter and Sort states (Amazon style)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUseCase, setFilterUseCase] = useState<string>('All');
  const [filterGpu, setFilterGpu] = useState<string>('All');
  const [filterRam, setFilterRam] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('featured');

  const [bookingRig, setBookingRig] = useState<{ id: string; hours: number; price: number } | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadRigs() {
      try {
        const res = await fetch('/api/rigs');
        const json = await res.json();
        if (json.rigs && json.rigs.length > 0) {
          setRigs(json.rigs);
        }
      } catch (err) {
        console.error('Failed to load rigs from API, using fallback:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRigs();
  }, []);

  const handleBook = (rigId: string, hours: number, totalPrice: number) => {
    const session = readSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setBookingRig({ id: rigId, hours, price: totalPrice });
  };

  const confirmBooking = async () => {
    if (!bookingRig) return;
    setBookingStatus('Connecting to Algorand TestNet & x402 Facilitator...');

    try {
      const res = await fetch(`/api/sessions/connect?rig=${bookingRig.id}&hours=${bookingRig.hours}`);

      if (res.status === 402) {
        setBookingStatus('Payment Required (x402). Redirecting to session checkout...');
        setTimeout(() => {
          router.push('/sessions');
        }, 1500);
        return;
      }

      setBookingStatus('Session Connected! Credential Issued.');
      setTimeout(() => {
        router.push('/sessions');
      }, 1200);
    } catch (err: any) {
      setBookingStatus(`Error: ${err.message || 'Booking failed'}`);
    }
  };

  // Filter & Sort logic
  const filteredAndSortedRigs = rigs
    .filter((r) => {
      // Use case filter
      if (filterUseCase !== 'All') {
        const uc = Array.isArray(r.useCases) ? r.useCases : String(r.useCases).split(',');
        if (!uc.some((u) => u.toLowerCase().includes(filterUseCase.toLowerCase()))) return false;
      }
      // GPU filter
      if (filterGpu !== 'All') {
        if (!r.gpu.toLowerCase().includes(filterGpu.toLowerCase())) return false;
      }
      // RAM filter
      if (filterRam !== 'All') {
        if (!r.ram.toLowerCase().includes(filterRam.toLowerCase())) return false;
      }
      // Search query filter (matches name, gpu, cpu, useCases)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesGpu = r.gpu.toLowerCase().includes(q);
        const matchesCpu = r.cpu.toLowerCase().includes(q);
        const matchesUse = r.useCases.some((u) => u.toLowerCase().includes(q));
        if (!matchesName && !matchesGpu && !matchesCpu && !matchesUse) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.pricePerHour - b.pricePerHour;
      if (sortBy === 'price-high') return b.pricePerHour - a.pricePerHour;
      if (sortBy === 'rating') return (b.avgRating || 0) - (a.avgRating || 0);
      if (sortBy === 'available') return b.availableSlots - a.availableSlots;
      return 0; // featured / default
    });

  return (
    <div className="hyperdesk-shell">
      <main className="main-content">
        <header className="page-header">
          <div className="header-text">
            <p className="eyebrow">⚡ HYPERDESK FLEET</p>
            <h1>Choose Your Cloud Rig</h1>
            <p className="subtext">
              Select your performance tier, pick a session duration, and launch instantly with x402 crypto payments.
            </p>
          </div>
        </header>

        {/* Amazon-style Search, Filter & Sort Controls */}
        <section className="controls-panel">
          <div className="search-bar-row">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search specs (e.g. RTX 4090, Ryzen 9, 32GB)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
                  ✕
                </button>
              )}
            </div>

            <div className="sort-dropdown-wrap">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="featured">Featured / Default</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated ★</option>
                <option value="available">Most Slots Available</option>
              </select>
            </div>
          </div>

          <div className="filter-chips-row">
            {/* Workload filter */}
            <div className="filter-group">
              <span className="filter-group-label">Workload:</span>
              <div className="chip-buttons">
                {['All', 'Gaming', 'Editing', 'AI', 'Rendering'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-btn ${filterUseCase === cat ? 'active' : ''}`}
                    onClick={() => setFilterUseCase(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* GPU Filter */}
            <div className="filter-group">
              <span className="filter-group-label">GPU Series:</span>
              <select
                className="spec-select"
                value={filterGpu}
                onChange={(e) => setFilterGpu(e.target.value)}
              >
                <option value="All">All GPUs</option>
                <option value="4090">RTX 4090 (Beast)</option>
                <option value="4070">RTX 4070 Ti (Pro)</option>
                <option value="3060">RTX 3060 (Starter)</option>
              </select>
            </div>

            {/* RAM Filter */}
            <div className="filter-group">
              <span className="filter-group-label">RAM:</span>
              <select
                className="spec-select"
                value={filterRam}
                onChange={(e) => setFilterRam(e.target.value)}
              >
                <option value="All">All RAM</option>
                <option value="16 GB">16 GB</option>
                <option value="32 GB">32 GB</option>
                <option value="64 GB">64 GB</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rewards-banner">
          <span className="banner-icon">🎁</span>
          <div className="banner-text">
            <strong>Earn 10 Reward Points for every $1 spent</strong> — Redeem 100 points for free rental session discounts.
          </div>
        </section>

        {loading ? (
          <div className="loading-state">Loading rig fleet...</div>
        ) : filteredAndSortedRigs.length === 0 ? (
          <div className="empty-results">
            <h3>No rigs match your search criteria</h3>
            <p>Try clearing filters or searching for different hardware specs.</p>
            <button
              type="button"
              className="btn-reset-filters"
              onClick={() => {
                setSearchQuery('');
                setFilterUseCase('All');
                setFilterGpu('All');
                setFilterRam('All');
                setSortBy('featured');
              }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="rigs-grid">
            {filteredAndSortedRigs.map((rig) => (
              <RigCard key={rig.id} rig={rig} onBook={handleBook} />
            ))}
          </div>
        )}

        {/* Booking Confirmation Modal */}
        {bookingRig && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>Confirm Rig Rental</h3>
              <p className="modal-rig-name">
                Rig: <strong>{rigs.find((r) => r.id === bookingRig.id)?.name}</strong>
              </p>
              <div className="modal-summary">
                <div className="sum-row">
                  <span>Duration:</span>
                  <strong>{bookingRig.hours} Hour(s)</strong>
                </div>
                <div className="sum-row">
                  <span>Price per hour:</span>
                  <strong>${rigs.find((r) => r.id === bookingRig.id)?.pricePerHour.toFixed(2)} USDC</strong>
                </div>
                <div className="sum-row total">
                  <span>Total Amount:</span>
                  <strong>${bookingRig.price.toFixed(2)} USDC</strong>
                </div>
                <div className="sum-row points">
                  <span>Points Earned:</span>
                  <strong>+{Math.floor(bookingRig.price * 10)} pts</strong>
                </div>
              </div>

              {bookingStatus && <div className="status-msg">{bookingStatus}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  disabled={!!bookingStatus}
                  onClick={() => setBookingRig(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-confirm"
                  disabled={!!bookingStatus}
                  onClick={confirmBooking}
                >
                  Confirm & Pay (x402)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .hyperdesk-shell {
          min-height: 100vh;
          background: var(--bg, #0f0f0f);
          color: var(--text, #f1f1f1);
        }
        .main-content {
          max-width: 1180px;
          margin: 0 auto;
          padding: 40px 24px 80px;
        }
        .page-header {
          margin-bottom: 24px;
        }
        .eyebrow {
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          color: var(--accent, #ff0000);
          font-weight: 700;
          margin: 0 0 6px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 2rem;
          font-weight: 800;
        }
        .subtext {
          color: var(--text-muted);
          margin: 0;
          font-size: 0.95rem;
          max-width: 540px;
        }

        /* Controls Panel (Search, Sort, Specs) */
        .controls-panel {
          background: #121214;
          border: 1px solid var(--border, #303030);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .search-bar-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .search-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #1a1a1e;
          border: 1px solid var(--border, #303030);
          border-radius: 999px;
          padding: 10px 16px;
          flex: 1;
          min-width: 280px;
        }
        .search-icon {
          color: var(--text-muted);
        }
        .search-input-wrap input {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
          width: 100%;
        }
        .clear-btn {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .sort-dropdown-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .sort-dropdown-wrap select, .spec-select {
          background: #1a1a1e;
          border: 1px solid var(--border, #303030);
          color: #fff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }

        .filter-chips-row {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
          border-top: 1px solid #27272a;
          padding-top: 14px;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .filter-group-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .chip-buttons {
          display: flex;
          gap: 6px;
        }
        .filter-btn {
          background: var(--surface, #181818);
          border: 1px solid var(--border, #303030);
          color: var(--text-muted);
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-btn.active {
          background: var(--accent, #ff0000);
          border-color: var(--accent, #ff0000);
          color: #fff;
        }

        .rewards-banner {
          background: linear-gradient(90deg, rgba(255, 0, 0, 0.1), rgba(168, 85, 247, 0.1));
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 36px;
          font-size: 0.9rem;
        }
        .banner-icon {
          font-size: 1.4rem;
        }

        .rigs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 960px) {
          .rigs-grid {
            grid-template-columns: 1fr;
          }
        }

        .loading-state, .empty-results {
          text-align: center;
          padding: 60px;
          color: var(--text-muted);
        }
        .empty-results h3 {
          color: #fff;
          margin: 0 0 8px;
        }
        .btn-reset-filters {
          margin-top: 16px;
          background: var(--accent, #ff0000);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }

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
        }
        .modal-card h3 {
          margin: 0 0 12px;
          font-size: 1.2rem;
        }
        .modal-rig-name {
          margin: 0 0 20px;
          font-size: 0.95rem;
          color: var(--text-muted);
        }
        .modal-summary {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 0.9rem;
        }
        .sum-row {
          display: flex;
          justify-content: space-between;
        }
        .sum-row.total {
          border-top: 1px solid var(--border);
          padding-top: 10px;
          font-size: 1rem;
          color: var(--accent, #ff0000);
        }
        .sum-row.points {
          color: #10b981;
        }
        .status-msg {
          background: rgba(255, 0, 0, 0.15);
          border: 1px solid var(--accent);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 16px;
          text-align: center;
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
          padding: 12px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-confirm {
          flex: 2;
          background: var(--btn-bg);
          border: none;
          color: var(--btn-text);
          padding: 12px;
          border-radius: 10px;
          font-weight: 800;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
