-- ─────────────────────────────────────────────────────────────
-- SYNORA Database Schema
-- Run this entire file once in your Supabase SQL Editor.
-- Dashboard → SQL Editor → New Query → paste → Run
-- ─────────────────────────────────────────────────────────────

-- ── 1. USER DATA TABLE ─────────────────────────────────────
-- Stores each user's entire SYNORA state as a single JSONB blob.
-- This mirrors the localStorage structure exactly, making the
-- sync logic trivial — one read, one write per user.
CREATE TABLE IF NOT EXISTS user_data (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  data        JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user_id lookups
CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON user_data(user_id);

-- Auto-update the updated_at timestamp on every write
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 2. ROW LEVEL SECURITY ──────────────────────────────────
-- Users can only read and write their own row.
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = user_id);


-- ── 3. USAGE TRACKING TABLE ────────────────────────────────
-- Tracks AI calls per user per day so you can rate-limit fairly.
CREATE TABLE IF NOT EXISTS ai_usage (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  call_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (for showing "X / 50 calls used today")
CREATE POLICY "Users can read own usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only the server (service role) can write to ai_usage — no policy needed
-- because service role bypasses RLS entirely.


-- ── 4. VERIFY SETUP ────────────────────────────────────────
-- Run this query to confirm tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public';
