-- HyperDesk Host & P2P AnyDesk-style Remote Desktop Extension

-- Host PC Listings
CREATE TABLE IF NOT EXISTS host_rigs (
  id TEXT PRIMARY KEY,
  host_name TEXT NOT NULL,
  host_address TEXT,
  rig_name TEXT NOT NULL,
  gpu TEXT NOT NULL,
  cpu TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  price_per_hour DECIMAL(10,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'online', -- 'online', 'busy', 'offline'
  available_from TEXT DEFAULT '09:00',
  available_to TEXT DEFAULT '23:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remote Connection Requests (AnyDesk-style permission handshake)
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  rig_id TEXT NOT NULL,
  renter_name TEXT NOT NULL,
  host_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'connected'
  ip_address TEXT DEFAULT '192.168.1.105',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed an example Host PC
INSERT INTO host_rigs (id, host_name, rig_name, gpu, cpu, ram, storage, price_per_hour, status)
VALUES (
  'host-rig-01',
  'Alex (Host)',
  'Alex Custom RTX 4080 Rig',
  'RTX 4080 16GB',
  'Intel i9-14900K',
  '32 GB DDR5',
  '1 TB NVMe',
  1.20,
  'online'
) ON CONFLICT (id) DO NOTHING;
