-- Enable semantic search vector and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users & Multi-Tenant Identities
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('processor', 'buyer', 'admin', 'producer', 'consumer', 'sme_owner')), -- producer = processor, consumer/sme_owner = buyer for legacy compatibility
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Refresh token storage for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address TEXT
);

-- 2. Organic Material Refining Batches
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    feedstock_type VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    weight_kg NUMERIC(10,2) DEFAULT 0,
    packaging_type VARCHAR(50) DEFAULT 'Standard',
    destination_zone VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'certified', 'dispatched', 'delivered')),
    trust_score INT NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
    certificate_url VARCHAR(500),
    qr_code_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Live IoT Sensor Intake Readings
CREATE TABLE IF NOT EXISTS iot_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    pH NUMERIC(4,2) NOT NULL,
    EC NUMERIC(4,2) NOT NULL,
    temperature NUMERIC(5,2) NOT NULL,
    em1_ratio VARCHAR(20) NOT NULL,
    fermentation_days INT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Microclimate Dynamic Calculation & Profile Tracking
CREATE TABLE IF NOT EXISTS zone_microclimate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL UNIQUE,
    uhi_offset NUMERIC(4,2) NOT NULL,
    building_density NUMERIC(4,2) NOT NULL,
    vegetation_fraction NUMERIC(4,2) NOT NULL,
    wind_corridor_factor NUMERIC(4,2) NOT NULL,
    thermal_mass_coefficient NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4b. Live Neighborhood Hazard Profiles (Used in TST)
CREATE TABLE IF NOT EXISTS zone_hazard_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL UNIQUE,
    hazard_class VARCHAR(20) NOT NULL,
    hazard_multiplier NUMERIC(4,2) NOT NULL,
    building_density NUMERIC(4,2) NOT NULL,
    vegetation_fraction NUMERIC(4,2) NOT NULL,
    wind_corridor_factor NUMERIC(4,2) NOT NULL,
    thermal_mass_coefficient NUMERIC(4,2) NOT NULL,
    base_survival_multiplier NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4c. Microclimate Logged Calculation Readings
CREATE TABLE IF NOT EXISTS microclimate_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) REFERENCES zone_microclimate_profiles(zone) ON DELETE CASCADE,
    base_temp NUMERIC(5,2) NOT NULL,            -- Live regional temperature from API
    wind_speed NUMERIC(5,2) NOT NULL,           -- Live regional wind speed from API
    solar_factor NUMERIC(4,2) NOT NULL,          -- Diurnal solar hour factor
    adjusted_temp NUMERIC(5,2) NOT NULL,         -- Calculated microclimate temperature
    thermal_risk NUMERIC(3,2) NOT NULL,          -- Calculated thermal degradation risk
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4d. Community-Sourced Microclimate Observations (Voice Reports)
CREATE TABLE IF NOT EXISTS community_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observer_id UUID REFERENCES users(id),
    zone VARCHAR(50) NOT NULL,
    reported_condition VARCHAR(50) NOT NULL, -- 'extreme_heat', 'moderate', 'cool', 'rain'
    notes TEXT,
    validated BOOLEAN DEFAULT false,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Product Marketplace Directory
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_bdt INT NOT NULL,
    quantity INT NOT NULL,
    trust_score INT NOT NULL,
    dvs INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Dynamic Dispatch Shipping Allocations / Exposure Tracking Logs
CREATE TABLE IF NOT EXISTS dispatch_exposure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    zone VARCHAR(50) NOT NULL,
    packaging_type VARCHAR(30) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    calculated_survival_time_minutes INT NOT NULL,
    exposure_risk_level VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Dynamic Dispatch Shipping Allocations (Scheduler)
CREATE TABLE IF NOT EXISTS dispatch_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    zone VARCHAR(50) NOT NULL,
    dvs_score INT NOT NULL,
    recommended_window_start TIME NOT NULL,
    recommended_window_end TIME NOT NULL,
    risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    ai_advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Platform Orders & Settlement
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    total_bdt INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. ESG & Sustainability Performance Reporting
CREATE TABLE IF NOT EXISTS esg_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    spoilage_prevented_bdt INT NOT NULL,
    plastic_offset_kg INT NOT NULL,
    carbon_sequestered_kg INT NOT NULL,
    report_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Knowledge Base Vector Indexes for BARI Context
CREATE TABLE IF NOT EXISTS compliance_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    standard_name VARCHAR(255) NOT NULL,
    document_chunk TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Trust Score Calculation Logs (For diagnostic tracking)
CREATE TABLE IF NOT EXISTS trust_score_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ph NUMERIC(4,2) NOT NULL,
    ec NUMERIC(4,2) NOT NULL,
    temperature NUMERIC(5,2) NOT NULL,
    em1_ratio NUMERIC(8,6) NOT NULL,
    fermentation_days INT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    grade VARCHAR(2) NOT NULL,
    is_viable BOOLEAN NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Granular ESG Metrics (For green SMEs and audit trails)
CREATE TABLE IF NOT EXISTS esg_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    e_score INT NOT NULL,
    s_score INT NOT NULL,
    g_score INT NOT NULL,
    esg_score INT NOT NULL,
    plastic_offset_kg INT NOT NULL,
    carbon_sequestered_kg INT NOT NULL,
    water_saved_l INT NOT NULL,
    waste_reduced_kg INT NOT NULL,
    spoilage_prevented_bdt INT NOT NULL,
    trust_score INT NOT NULL,
    dvs_score INT NOT NULL,
    month VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Knowledge Base Text Search for BARI Context
CREATE TABLE IF NOT EXISTS bari_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Climate Delivery Viability Score Calculation Logs
CREATE TABLE IF NOT EXISTS dvs_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL,
    ambient_temperature NUMERIC(5,2) NOT NULL,
    solar_hour INT NOT NULL,
    trust_score INT NOT NULL,
    dvs_score NUMERIC(5,2) NOT NULL,
    delivery_approved BOOLEAN NOT NULL,
    tst_minutes NUMERIC(6,2) NOT NULL,
    hazard_class VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. BARI RAG Assistant Query Logs
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    language VARCHAR(5) NOT NULL,
    answer TEXT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Agentic Chatbot Interaction Logs
CREATE TABLE IF NOT EXISTS agent_interaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    farmer_id VARCHAR(100),
    message TEXT NOT NULL,
    intent VARCHAR(50) NOT NULL,
    response_type VARCHAR(50) NOT NULL,
    language VARCHAR(5) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing optimizations for High-Velocity Query performance
CREATE INDEX IF NOT EXISTS idx_batches_number ON batches(batch_number);

CREATE INDEX IF NOT EXISTS idx_iot_readings_batch ON iot_readings(batch_id);

CREATE INDEX IF NOT EXISTS idx_products_scores ON products(trust_score, dvs);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Enable Row-Level Security (RLS) policies
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Base Public RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to active batches' AND tablename = 'batches'
    ) THEN
        CREATE POLICY "Allow public read access to active batches" 
        ON batches FOR SELECT TO public USING (true);

END IF;

END
$$;

-- 17. Consumer QR Scan Analytics Table
CREATE TABLE IF NOT EXISTS qr_scans (
    id BIGSERIAL PRIMARY KEY,
    batch_id TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_batch_recent ON qr_scans (batch_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scans_recent ON qr_scans (scanned_at DESC);

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

-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — MIGRATION 008: Order lifecycle audit log
-- File: supabase/migrations/008_order_lifecycle_logs.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.order_lifecycle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  event VARCHAR(30) NOT NULL
    CHECK (event IN ('created', 'confirmed', 'dispatched', 'received')),
  session_id VARCHAR(100),
  buyer_id TEXT,
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_order_id
  ON public.order_lifecycle_logs (order_id);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_event
  ON public.order_lifecycle_logs (event);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_created_at
  ON public.order_lifecycle_logs (created_at DESC);

ALTER TABLE public.order_lifecycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on order_lifecycle_logs"
  ON public.order_lifecycle_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — MIGRATION 006: Create checkout_orders Table
-- File: supabase/migrations/006_create_checkout_orders.sql
-- ═══════════════════════════════════════════════════════════════

-- Create the checkout_orders table
CREATE TABLE IF NOT EXISTS checkout_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  product_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  transcript TEXT NOT NULL,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE checkout_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert for authenticated users only
CREATE POLICY "Allow insert for authenticated users only"
  ON checkout_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow select for service role only
CREATE POLICY "Allow select for service role only"
  ON checkout_orders
  FOR SELECT
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_session_id ON agent_interaction_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_session_id ON pending_orders(session_id);

-- Index for per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users see own notifications'
      AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users see own notifications"
      ON public.notifications
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid());

END IF;

END
$$;

-- Full-text search index for RAG retrieval
CREATE INDEX IF NOT EXISTS bari_knowledge_chunks_fts
  ON public.bari_knowledge_chunks
  USING GIN(to_tsvector('english', content));

-- Category lookup index
CREATE INDEX IF NOT EXISTS idx_bari_chunks_category
  ON public.bari_knowledge_chunks(category);

-- ── Task 4: Order Tracking Events Table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL,
  carrier       TEXT NOT NULL DEFAULT 'internal',
  tracking_id   TEXT,
  status        TEXT NOT NULL,
  location      TEXT,
  description   TEXT,
  event_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id
  ON public.order_tracking_events(order_id, event_time DESC);

-- RLS: let authenticated users read tracking events for their own orders
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated read order tracking'
      AND tablename = 'order_tracking_events'
  ) THEN
    CREATE POLICY "Authenticated read order tracking"
      ON public.order_tracking_events
      FOR SELECT
      TO authenticated
      USING (true);

-- order ownership enforced at application layer
  END IF;

END
$$;

-- Placeholder table to instantly test database reads/writes
CREATE TABLE IF NOT EXISTS test_logs (
    id SERIAL PRIMARY KEY,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record
INSERT INTO test_logs (message) VALUES ('Initial database connection test successfully created table and inserted data.');

-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 001: Add agent_sessions table for persistent AI memory
-- Run this in Supabase SQL editor or via psql.
-- ═══════════════════════════════════════════════════════════════

-- Persistent session store for hybrid in-memory + DB memory
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    farmer_id VARCHAR(100),
    history JSONB NOT NULL DEFAULT '[]',
    pending_order JSONB,
    last_seen_products JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_expires_at ON agent_sessions(expires_at);

-- Auto-expire sessions (RLS does not auto-delete;

this is for cleanup queries)
-- Run this periodically: DELETE FROM agent_sessions WHERE expires_at < NOW();

-- Enable Row-Level Security (RLS) policies
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous access based on application logic 
-- (Note: Backend using Service Role key will bypass RLS anyway)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend service role to manage agent sessions' AND tablename = 'agent_sessions'
    ) THEN
        CREATE POLICY "Allow backend service role to manage agent sessions" 
        ON agent_sessions FOR ALL TO public USING (true);

END IF;

END
$$;

-- Policy 1: Processors can only read their own batches
CREATE POLICY "SME owner select own batches"
ON batches
FOR SELECT
USING (auth.uid() = processor_id);

-- Policy 2: Buyers can only read their own orders
CREATE POLICY "Buyer purchase isolation"
ON orders
FOR SELECT
USING (auth.uid() = buyer_id);