-- ── Roleplay Training Tracker ────────────────────────────────────────────────
-- Migration 00020: Add AI Roleplay module catalog and per-agent score tables

-- 1. Global ordered module catalog (managed by admins/managers)
CREATE TABLE IF NOT EXISTS roleplay_modules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Auto',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Per-agent best scores per tier (one row per module/agent/tier)
CREATE TABLE IF NOT EXISTS roleplay_scores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    UUID NOT NULL REFERENCES roleplay_modules(id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL CHECK (tier IN ('Beginner', 'Intermediate', 'Advanced')),
  score        INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  completed_at DATE NOT NULL,
  entered_by   UUID REFERENCES agents(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, agent_id, tier)
);

-- 3. Row Level Security
ALTER TABLE roleplay_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_scores  ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read modules
CREATE POLICY "roleplay_modules_read_all"
  ON roleplay_modules FOR SELECT TO authenticated
  USING (true);

-- Only admins/managers can write modules
CREATE POLICY "roleplay_modules_write_managers"
  ON roleplay_modules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE id = auth.uid()
        AND (role = 'admin' OR team = 'Managers')
    )
  );

-- Agents can read their own scores; managers can read all
CREATE POLICY "roleplay_scores_read"
  ON roleplay_scores FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agents
      WHERE id = auth.uid()
        AND (role = 'admin' OR team = 'Managers')
    )
  );

-- Agents can write their own scores; managers can write all
CREATE POLICY "roleplay_scores_write"
  ON roleplay_scores FOR ALL TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agents
      WHERE id = auth.uid()
        AND (role = 'admin' OR team = 'Managers')
    )
  );
