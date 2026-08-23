-- Veil — initial schema
--
-- Mirrors the data model in the hackathon blueprint (section 10).
-- The blockchain (VeilCapability contract) is authoritative for on-chain
-- capability state (existence, revoked, expiry, holder). These tables are
-- for UI, indexing, operational logs, and demo convenience — do NOT treat
-- this database as the source of truth for whether a capability is valid;
-- always check isValid() on-chain (or via the resource server, which does)
-- before granting access.
--
-- Run with: psql "$DATABASE_URL" -f database/schema/001_init.sql
-- (Safe to re-run: every statement is idempotent.)

-- ---------------------------------------------------------------------
-- users
-- Demo login accounts for /login and POST /api/users.
-- Distinct from `agents` (wallet-bearing runtime identities). Handle
-- uniqueness is case-insensitive so "Agent-01" and "agent-01" collide.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle     TEXT NOT NULL,
  role       TEXT NOT NULL
             CHECK (role IN ('agent', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_key
  ON users (lower(handle));

INSERT INTO users (handle, role)
VALUES
  ('agent-01', 'agent'),
  ('provider-demo', 'admin')
ON CONFLICT ((lower(handle))) DO NOTHING;

-- ---------------------------------------------------------------------
-- agents
-- One row per AI agent identity known to Veil.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  agent_id       TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'disabled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- resources
-- The catalog of paid resources Veil can protect. /api/resources reads
-- this table directly.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
  resource_id     TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  price           NUMERIC(18, 6) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USDC',
  allowed_actions TEXT[] NOT NULL DEFAULT ARRAY['READ'],
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- capabilities
-- Off-chain mirror of the on-chain VeilCapability box for each
-- credential_id, kept in sync by the resource server after
-- createCapability / revokeCapability calls. Used for fast dashboard
-- reads; the chain remains authoritative.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capabilities (
  credential_id   TEXT PRIMARY KEY,
  resource_id     TEXT NOT NULL REFERENCES resources(resource_id),
  action          TEXT NOT NULL,
  quota           INTEGER NOT NULL,
  expiry_round    BIGINT NOT NULL,
  holder_address  TEXT NOT NULL,
  revoked         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_resource_id
  ON capabilities(resource_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_holder_address
  ON capabilities(holder_address);

-- ---------------------------------------------------------------------
-- payments
-- One row per x402 payment settled for a resource request.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  payment_id  TEXT PRIMARY KEY,
  agent_id    TEXT REFERENCES agents(agent_id),
  amount      NUMERIC(18, 6) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USDC',
  resource_id TEXT NOT NULL REFERENCES resources(resource_id),
  tx_id       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'settled', 'failed')),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_resource_id
  ON payments(resource_id);
CREATE INDEX IF NOT EXISTS idx_payments_tx_id
  ON payments(tx_id);

-- ---------------------------------------------------------------------
-- requests
-- Activity log of every access attempt against a protected resource.
-- Powers /activity and the capability detail timeline.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  request_id    TEXT PRIMARY KEY,
  agent_id      TEXT REFERENCES agents(agent_id),
  resource_id   TEXT NOT NULL REFERENCES resources(resource_id),
  credential_id TEXT REFERENCES capabilities(credential_id),
  status_code   INTEGER NOT NULL,
  result        TEXT,
  "timestamp"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_credential_id
  ON requests(credential_id);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp
  ON requests("timestamp" DESC);

-- ---------------------------------------------------------------------
-- nonces
-- Fresh nonce per capability-authenticated request, to prevent simple
-- replay of an old signed request (blueprint section 9).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nonces (
  nonce         TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL REFERENCES capabilities(credential_id),
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  used          BOOLEAN NOT NULL DEFAULT false,
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nonces_credential_id
  ON nonces(credential_id);

-- ---------------------------------------------------------------------
-- blockchain_transactions
-- Index of on-chain transactions relevant to Veil (capability issuance,
-- revocation, payment settlement) for the UI to link out to an explorer.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  tx_id         TEXT PRIMARY KEY,
  type          TEXT NOT NULL
                CHECK (type IN ('payment', 'capability_create', 'capability_revoke')),
  credential_id TEXT REFERENCES capabilities(credential_id),
  round         BIGINT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'failed')),
  "timestamp"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_credential_id
  ON blockchain_transactions(credential_id);

-- ---------------------------------------------------------------------
-- audit_logs
-- Generic event log (admin revokes, agent actions, errors) for the demo
-- and for post-mortem debugging.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  event_id   BIGSERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
  ON audit_logs(event_type);