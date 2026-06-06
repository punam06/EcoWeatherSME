-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — TRUST LAYER v2 MIGRATION
-- File: supabase/migrations/009_trust_layer_v2.sql
--
-- Adds the tables required by the category-aware Trust Layer v2:
--   - product_categories  : rulebook per product type
--   - qa_reports          : multi-source QA submissions (iot/inspector/manufacturer)
--   - provenance_records  : SHA-256 hash chain for the batch lifecycle
--   - notifications       : real-time alerts to clients
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════

-- ── product_categories ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  ph_min FLOAT,
  ph_max FLOAT,
  ec_min FLOAT,
  ec_max FLOAT,
  temp_min FLOAT NOT NULL,
  temp_max FLOAT NOT NULL,
  required_ratio TEXT,
  min_fermentation_days INT NOT NULL DEFAULT 0,
  max_fermentation_days INT NOT NULL DEFAULT 365,
  requires_bsti BOOLEAN NOT NULL DEFAULT false,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO product_categories
  (name, display_name, ph_min, ph_max, ec_min, ec_max, temp_min, temp_max, required_ratio, min_fermentation_days, max_fermentation_days, requires_bsti, weights)
VALUES
  ('organic',        'Organic Biofertilizer (BARI EM-1)',  3.5, 7.5,  2.5,  5.0, 25, 35, '1:1:20', 7,  14,  false, '{"ph":8,"ec":6,"temp":1.2,"ratio":5,"days":4}'::jsonb),
  ('retail',         'Retail FMCG / Packaged Goods',      NULL, NULL, 0,   10,   10, 32, NULL,      0, 365,  false, '{"ph":0,"ec":4,"temp":2.0,"ratio":0,"days":0.5}'::jsonb),
  ('pharma',         'Pharmaceuticals (DGDA regulated)',  4.5, 7.5,  0,    5,    2,  8, NULL,      0, 180,  true,  '{"ph":6,"ec":6,"temp":4.0,"ratio":0,"days":0.2}'::jsonb),
  ('dairy',          'Dairy / Pasteurized Milk',          6.5, 6.8,  0,   10,    2,  6, NULL,      0,   7,  true,  '{"ph":10,"ec":8,"temp":3.5,"ratio":0,"days":1.5}'::jsonb),
  ('manufacturing',  'Manufacturing / Industrial Chem.',  NULL, NULL, 0,  100,   15, 30, NULL,      0, 365,  false, '{"ph":0,"ec":0.2,"temp":1.5,"ratio":0,"days":0.1}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  ph_min = EXCLUDED.ph_min,
  ph_max = EXCLUDED.ph_max,
  ec_min = EXCLUDED.ec_min,
  ec_max = EXCLUDED.ec_max,
  temp_min = EXCLUDED.temp_min,
  temp_max = EXCLUDED.temp_max,
  required_ratio = EXCLUDED.required_ratio,
  min_fermentation_days = EXCLUDED.min_fermentation_days,
  max_fermentation_days = EXCLUDED.max_fermentation_days,
  requires_bsti = EXCLUDED.requires_bsti,
  weights = EXCLUDED.weights;

-- ── qa_reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES product_categories(name),
  source TEXT NOT NULL CHECK (source IN ('iot', 'inspector', 'manufacturer')),
  metrics JSONB NOT NULL,
  signature TEXT NOT NULL,
  bsti_credential TEXT,
  note TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_bsti_format CHECK (
    bsti_credential IS NULL
    OR bsti_credential ~ '^BSTI-[0-9]{4,}$'
  ),
  CONSTRAINT chk_bsti_required_for_sensitive CHECK (
    category NOT IN ('pharma', 'dairy')
    OR (source = 'inspector' AND bsti_credential IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_qa_reports_batch ON qa_reports(batch_id);
CREATE INDEX IF NOT EXISTS idx_qa_reports_submitted_at ON qa_reports(submitted_at DESC);

-- ── provenance_records ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provenance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('qa', 'dispatch', 'delivery')),
  event_data JSONB NOT NULL,
  prev_hash TEXT,
  current_hash TEXT NOT NULL,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provenance_batch ON provenance_records(batch_id, created_at);

-- ── notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'success')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read on the standards rulebook (judges can inspect it).
DROP POLICY IF EXISTS "Public read product_categories" ON product_categories;
CREATE POLICY "Public read product_categories" ON product_categories
  FOR SELECT USING (true);

-- Provenance is public — the whole point of the QR verify flow.
DROP POLICY IF EXISTS "Public read provenance" ON provenance_records;
CREATE POLICY "Public read provenance" ON provenance_records
  FOR SELECT USING (true);

-- Authenticated users (inspectors, manufacturers) can write QA.
DROP POLICY IF EXISTS "Auth insert qa_reports" ON qa_reports;
CREATE POLICY "Auth insert qa_reports" ON qa_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth read qa_reports" ON qa_reports;
CREATE POLICY "Auth read qa_reports" ON qa_reports
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Anyone authenticated can append provenance (server is the actor).
DROP POLICY IF EXISTS "Auth insert provenance" ON provenance_records;
CREATE POLICY "Auth insert provenance" ON provenance_records
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Notifications: server-managed, users see only their own (if user_id added later).
DROP POLICY IF EXISTS "Auth read notifications" ON notifications;
CREATE POLICY "Auth read notifications" ON notifications
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service insert notifications" ON notifications;
CREATE POLICY "Service insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
