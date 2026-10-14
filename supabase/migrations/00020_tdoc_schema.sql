-- Migration 00020: TDOC Report Schema (NB & Add Car Documentation Audit)

CREATE TABLE IF NOT EXISTS tdoc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    effective_date DATE,
    issue_date DATE,
    producer_name TEXT,
    office TEXT CHECK (office IN ('CH', 'MB', 'MCM', 'RC')),
    transaction_type TEXT NOT NULL DEFAULT 'NB' CHECK (transaction_type IN ('NB', 'Add Car')),
    written_premium NUMERIC(10, 2) DEFAULT 0.0,
    item_count INTEGER DEFAULT 1,
    
    -- Manager remarks & tagging
    tagged_manager TEXT DEFAULT 'JP', -- JP, RB, JM, PH, CA, etc.
    
    -- Documentation deficit status columns
    missing_admin TEXT DEFAULT 'Good',
    missing_legal TEXT DEFAULT 'Good',
    missing_brp TEXT DEFAULT 'Good',
    
    -- Category for comments
    comment_category TEXT DEFAULT 'General',
    comments TEXT DEFAULT '',
    
    -- Overall calculated status
    status TEXT DEFAULT 'Good', -- Good, Action Needed, Under Review
    
    month_period TEXT NOT NULL, -- e.g. '2026-09', '2026-10', '2026-11', '2026-12'
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quick filtering
CREATE INDEX IF NOT EXISTS idx_tdoc_month ON tdoc_records(month_period);
CREATE INDEX IF NOT EXISTS idx_tdoc_office ON tdoc_records(office);
CREATE INDEX IF NOT EXISTS idx_tdoc_manager ON tdoc_records(tagged_manager);
CREATE INDEX IF NOT EXISTS idx_tdoc_status ON tdoc_records(status);

-- Enable RLS
ALTER TABLE tdoc_records ENABLE ROW LEVEL SECURITY;

-- Permissive policy (matches existing app pattern, restricted in App UI to Managers)
CREATE POLICY "Enable all access on tdoc_records" ON tdoc_records FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tdoc_records;
