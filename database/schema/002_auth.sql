-- Veil — auth migration
-- Adds email/password authentication columns to the users table.
-- Run with: psql "$DATABASE_URL" -f database/schema/002_auth.sql
-- (Safe to re-run: every statement is idempotent.)

-- Add email column (nullable first so we can backfill existing rows)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- Backfill existing demo rows with placeholder emails so the NOT NULL
-- constraint can be added. These accounts won't be usable for login
-- until someone sets a real password via the app.
UPDATE users SET email = lower(handle) || '@demo.local'
WHERE email IS NULL;

UPDATE users SET password_hash = 'PLACEHOLDER_NO_LOGIN'
WHERE password_hash IS NULL;

-- Now enforce NOT NULL
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- Unique index on email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON users (lower(email));
