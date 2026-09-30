-- ============================================================
-- 003_novadeck.sql  –  NovaDeck / CloudRig tables
-- ============================================================

-- ─── rigs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rigs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  gpu             TEXT NOT NULL,
  cpu             TEXT NOT NULL,
  ram             TEXT NOT NULL,
  storage         TEXT NOT NULL,
  use_cases       TEXT[] NOT NULL DEFAULT '{}',
  price_per_hour  DECIMAL(10,4) NOT NULL,
  total_slots     INTEGER NOT NULL DEFAULT 10,
  available_slots INTEGER NOT NULL DEFAULT 10,
  avg_rating      DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ratings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,
  rig_id      TEXT NOT NULL REFERENCES rigs(id),
  user_id     UUID,
  stars       INTEGER CHECK (stars BETWEEN 1 AND 5),
  review      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── user_points ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_points (
  user_id         UUID PRIMARY KEY,
  total_points    INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── point_transactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  ref_id     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Seed rigs ───────────────────────────────────────────────
INSERT INTO rigs (id, name, gpu, cpu, ram, storage, use_cases, price_per_hour, total_slots, available_slots, avg_rating, rating_count)
VALUES
  (
    'rig-starter',
    'Starter',
    'RTX 3060',
    'AMD Ryzen 5 5600X',
    '16 GB',
    '256 GB SSD',
    ARRAY['Gaming','Light Editing','Streaming'],
    0.50,
    10,
    8,
    4.2,
    45
  ),
  (
    'rig-pro',
    'Pro',
    'RTX 4070 Ti',
    'Intel Core i9-13900K',
    '32 GB',
    '512 GB NVMe',
    ARRAY['4K Editing','AI/ML','Heavy Gaming'],
    1.50,
    5,
    3,
    4.7,
    128
  ),
  (
    'rig-beast',
    'Beast',
    'RTX 4090',
    'AMD Ryzen 9 7950X',
    '64 GB',
    '1 TB NVMe',
    ARRAY['8K Rendering','AAA Gaming','AI Training','VFX'],
    3.00,
    3,
    1,
    4.9,
    67
  )
ON CONFLICT (id) DO NOTHING;
