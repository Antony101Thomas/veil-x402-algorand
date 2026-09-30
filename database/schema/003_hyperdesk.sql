-- HyperDesk Schema Extension

CREATE TABLE IF NOT EXISTS rigs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gpu TEXT NOT NULL,
  cpu TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  use_cases TEXT[] NOT NULL,
  price_per_hour DECIMAL(10,4) NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 10,
  available_slots INTEGER NOT NULL DEFAULT 10,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  rig_id TEXT NOT NULL REFERENCES rigs(id),
  user_id UUID,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_points (
  user_id UUID PRIMARY KEY,
  total_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data
INSERT INTO rigs (id, name, gpu, cpu, ram, storage, use_cases, price_per_hour, total_slots, available_slots, avg_rating, rating_count)
VALUES 
  ('rig-starter', 'Starter Rig', 'RTX 3060 12GB', 'AMD Ryzen 5 5600X', '16 GB DDR4', '256 GB SSD', ARRAY['Gaming','Light Editing','Streaming'], 0.50, 10, 8, 4.2, 45),
  ('rig-pro', 'Pro Rig', 'RTX 4070 Ti 12GB', 'Intel Core i9-13900K', '32 GB DDR5', '512 GB NVMe', ARRAY['4K Editing','AI / ML','Heavy Gaming'], 1.50, 5, 3, 4.7, 128),
  ('rig-beast', 'Beast Rig', 'RTX 4090 24GB', 'AMD Ryzen 9 7950X', '64 GB DDR5', '1 TB NVMe', ARRAY['8K Rendering','AAA Gaming','AI Training','VFX'], 3.00, 3, 1, 4.9, 67)
ON CONFLICT (id) DO UPDATE SET
  available_slots = EXCLUDED.available_slots,
  avg_rating = EXCLUDED.avg_rating,
  rating_count = EXCLUDED.rating_count;
