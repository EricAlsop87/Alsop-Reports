-- 00022_referral_program_schema.sql
-- Schema for Alsop Referral Program monthly tracking and gift fulfillment

CREATE TABLE IF NOT EXISTS referral_program_entries (
  id TEXT PRIMARY KEY,
  month_key TEXT NOT NULL, -- e.g. '2026-09', '2026-10'
  producer TEXT NOT NULL,
  lead_source TEXT,
  policy_type TEXT,
  customer_name TEXT NOT NULL,
  sold_date TEXT,
  carrier TEXT,
  is_referral BOOLEAN NOT NULL DEFAULT true,
  amount NUMERIC(10, 2),
  gift_type TEXT DEFAULT '$10.00 Visa Card',
  gift_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'n/a'
  date_sent TEXT,
  recipient_notes TEXT,
  city TEXT,
  state TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast monthly filtering and searching
CREATE INDEX IF NOT EXISTS idx_referral_month_key ON referral_program_entries(month_key);
CREATE INDEX IF NOT EXISTS idx_referral_status ON referral_program_entries(gift_status);
CREATE INDEX IF NOT EXISTS idx_referral_is_ref ON referral_program_entries(is_referral);
CREATE INDEX IF NOT EXISTS idx_referral_producer ON referral_program_entries(producer);

-- Enable RLS
ALTER TABLE referral_program_entries ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can view; admins and managers can insert/update/delete
DROP POLICY IF EXISTS "Referrals viewable by authenticated users" ON referral_program_entries;
CREATE POLICY "Referrals viewable by authenticated users"
ON referral_program_entries FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Referrals modifiable by service role or admins" ON referral_program_entries;
CREATE POLICY "Referrals modifiable by service role or admins"
ON referral_program_entries FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
