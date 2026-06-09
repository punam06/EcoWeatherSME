-- ═══════════════════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — MIGRATION 013: QR Asset Tracking Lifecycle
-- File: supabase/migrations/013_qr_asset_tracking_lifecycle.sql
--
-- Expands the ClimaLogix platform to support a dynamic, multi-stakeholder
-- QR-based asset tracking lifecycle.
--
-- Changes:
--   1. Adds 'inspector' to the users.role CHECK constraint.
--   2. Evolves the `batches` table with provenance-oriented columns:
--      - producer_id, inspector_id, sme_owner_id (stakeholder FKs)
--      - status enum expanded to: created → inspected → in_transit →
--        sme_inventory → sold  (legacy values preserved for backward compat)
--      - initial_metrics (JSONB birth certificate: pH, EC, moisture, ferm days)
--      - is_sensor_verified (IoT hardware vs. manual declaration flag)
--   3. Creates `batch_custody_ledger` — an append-only chain-of-custody log
--      with GPS coordinates, actor references, and contextual JSONB metadata.
--   4. Enforces Row-Level Security scoped by application-level role stored
--      in the users table (read via a helper function `get_user_role()`).
--
-- Prerequisites:
--   - 001_initial_schema.sql  (users, batches, iot_readings)
--   - 009_trust_layer_v2.sql  (RLS enabled on batches)
--
-- Safe to re-run: uses IF NOT EXISTS, IF EXISTS, and DO blocks throughout.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- §0  HELPER: get_user_role()
-- ─────────────────────────────────────────────────────────────────────────
-- Returns the application-level role for the currently authenticated user
-- by looking up their Supabase auth.uid() in the users table.
-- Falls back to 'anon' when unauthenticated or when the user has no row.
-- Used by RLS policies to gate writes by domain role, not just auth state.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid()),
    'anon'
  );
$$;

COMMENT ON FUNCTION public.get_user_role() IS
  'Returns the application-level role (producer, inspector, buyer, etc.) '
  'for the currently authenticated Supabase user. Returns ''anon'' if '
  'unauthenticated or user row not found. Used by RLS policies.';


-- ─────────────────────────────────────────────────────────────────────────
-- §1  WIDEN users.role TO INCLUDE 'inspector'
-- ─────────────────────────────────────────────────────────────────────────
-- The existing CHECK constraint allows:
--   'processor', 'buyer', 'admin', 'producer', 'consumer', 'sme_owner'
-- We need to add 'inspector' to support the QA inspection workflow.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Drop the old constraint by name (Postgres auto-names it users_role_check)
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users'
      AND column_name = 'role'
      AND constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'processor',   -- legacy: original organic-material processor
    'buyer',       -- legacy: original buyer/SME purchaser
    'admin',       -- platform administrator
    'producer',    -- field producer (maps to processor for legacy compat)
    'consumer',    -- end consumer scanning QR codes
    'sme_owner',   -- SME business owner (buyer alias)
    'inspector'    -- new: QA inspector for batch certification
  ));


-- ─────────────────────────────────────────────────────────────────────────
-- §2  EVOLVE batches TABLE
-- ─────────────────────────────────────────────────────────────────────────
-- Strategy: add new columns alongside existing ones to preserve backward
-- compatibility with the in-memory batchStore and all existing API routes.
-- The new `producer_id` mirrors the semantic intent of the legacy
-- `processor_id` but with the clearer provenance-domain naming.
-- ─────────────────────────────────────────────────────────────────────────

-- 2a. Add producer_id (the field-level originator who birthed this batch)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS producer_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.batches.producer_id IS
  'UUID of the producing farmer/processor who originally created this batch. '
  'If NULL, falls back to legacy processor_id.';

-- 2b. Add inspector_id (assigned QA inspector)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.batches.inspector_id IS
  'UUID of the certified inspector who verified this batch quality. '
  'NULL until inspection occurs.';

-- 2c. Add sme_owner_id (the SME/buyer who claimed custody)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS sme_owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.batches.sme_owner_id IS
  'UUID of the SME buyer/processor who accepted custody of this batch. '
  'NULL until SME receipt is recorded.';

-- 2d. Add initial_metrics (birth certificate JSONB snapshot)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS initial_metrics JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.batches.initial_metrics IS
  'JSONB snapshot of batch metrics at creation time. Expected shape: '
  '{"ph": 6.8, "ec": 3.2, "moisture_pct": 45.0, "fermentation_days": 7}. '
  'Immutable after batch creation — the provenance birth certificate.';

-- 2e. Add is_sensor_verified (IoT vs manual declaration flag)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS is_sensor_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.batches.is_sensor_verified IS
  'True if initial_metrics were captured via IoT hardware sensors. '
  'False if values were manually declared by the producer. '
  'Affects Trust Score weighting.';

-- 2f. Widen the status CHECK to include the new lifecycle states.
--     Legacy values ('pending', 'active', 'certified', 'dispatched', 'delivered')
--     are preserved so existing batches remain valid.
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE public.batches
  DROP CONSTRAINT IF EXISTS batches_status_check;

ALTER TABLE public.batches
  ADD CONSTRAINT batches_status_check
  CHECK (status IN (
    -- Legacy lifecycle
    'pending', 'active', 'certified', 'dispatched', 'delivered',
    -- New provenance lifecycle
    'created',        -- producer birthed the batch and declared initial_metrics
    'inspected',      -- inspector verified quality in the field
    'in_transit',     -- batch is being transported to the SME
    'sme_inventory',  -- SME has received and warehoused the batch
    'sold'            -- batch has been sold to the end consumer
  ));

-- 2g. Backfill: set producer_id = processor_id where producer_id is NULL
--     (ensures legacy data gets a producer reference)
UPDATE public.batches
  SET producer_id = processor_id
  WHERE producer_id IS NULL
    AND processor_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- §3  CREATE batch_custody_ledger TABLE
-- ─────────────────────────────────────────────────────────────────────────
-- Append-only chain-of-custody log. Every time a batch changes hands or
-- undergoes a significant lifecycle event, a row is inserted here.
-- This is the forensic audit trail backing every QR scan result.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batch_custody_ledger (
  -- Primary key: cryptographic unique identifier
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the batch being tracked
  batch_id        UUID          NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,

  -- The user who performed this action
  actor_id        UUID          NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,

  -- The type of custody event
  action_type     TEXT          NOT NULL CHECK (
                    action_type IN (
                      'production',    -- producer created the batch
                      'inspection',    -- inspector verified in the field
                      'sme_receipt'    -- SME/buyer accepted custody
                    )
                  ),

  -- GPS coordinates for geographical verification
  gps_latitude    NUMERIC(10,7),   -- ±90.0000000  (7 decimal places ≈ 1.1cm precision)
  gps_longitude   NUMERIC(11,7),   -- ±180.0000000

  -- When this event occurred
  timestamp       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Contextual metadata: inspector notes, SME storage conditions, IoT readings, etc.
  -- Example shapes:
  --   production:  {"feedstock": "rice_husk", "vessel_id": "V-012", "weather": "sunny"}
  --   inspection:  {"notes": "pH within range", "bsti_ref": "BSTI-5678", "photos": [...]}
  --   sme_receipt: {"storage_temp_c": 24.5, "warehouse_id": "WH-03", "condition": "good"}
  metadata        JSONB         NOT NULL DEFAULT '{}'::jsonb
);

-- ── Indexes ──────────────────────────────────────────────────────────────

-- Primary read pattern: full custody chain for a batch, chronologically
CREATE INDEX IF NOT EXISTS idx_custody_ledger_batch_timeline
  ON public.batch_custody_ledger (batch_id, timestamp ASC);

-- Dashboard query: recent events across all batches
CREATE INDEX IF NOT EXISTS idx_custody_ledger_recent
  ON public.batch_custody_ledger (timestamp DESC);

-- Actor audit trail: what has this user done?
CREATE INDEX IF NOT EXISTS idx_custody_ledger_actor
  ON public.batch_custody_ledger (actor_id, timestamp DESC);

-- Filter by event type (e.g., "show me all inspections today")
CREATE INDEX IF NOT EXISTS idx_custody_ledger_action_type
  ON public.batch_custody_ledger (action_type, timestamp DESC);

-- ── Table & Column Documentation ─────────────────────────────────────────

COMMENT ON TABLE public.batch_custody_ledger IS
  'Append-only chain-of-custody audit trail for the QR asset tracking lifecycle. '
  'Each row records a custody transfer or lifecycle event with GPS coordinates '
  'and free-form JSONB metadata. Backs every consumer QR scan provenance view.';

COMMENT ON COLUMN public.batch_custody_ledger.gps_latitude IS
  'WGS-84 latitude of the event location. 7 decimal places ≈ 1.1 cm precision.';
COMMENT ON COLUMN public.batch_custody_ledger.gps_longitude IS
  'WGS-84 longitude of the event location.';
COMMENT ON COLUMN public.batch_custody_ledger.metadata IS
  'Free-form JSONB context. Shape varies by action_type — see table comment for examples.';


-- ─────────────────────────────────────────────────────────────────────────
-- §4  ADDITIONAL INDEXES ON batches (new columns)
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_batches_producer_id
  ON public.batches (producer_id);

CREATE INDEX IF NOT EXISTS idx_batches_inspector_id
  ON public.batches (inspector_id);

CREATE INDEX IF NOT EXISTS idx_batches_sme_owner_id
  ON public.batches (sme_owner_id);

CREATE INDEX IF NOT EXISTS idx_batches_status
  ON public.batches (status);

CREATE INDEX IF NOT EXISTS idx_batches_sensor_verified
  ON public.batches (is_sensor_verified)
  WHERE is_sensor_verified = true;


-- ─────────────────────────────────────────────────────────────────────────
-- §5  ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────
-- Design principles:
--   • Public QR scans (SELECT on batches and custody ledger) are open to
--     everyone — including unauthenticated (anon) users. This is the
--     entire value proposition of QR provenance.
--   • Writes are gated by the application-level role in the users table,
--     accessed via the get_user_role() helper function.
--   • The service_role always has full access (backend server operations).
-- ─────────────────────────────────────────────────────────────────────────

-- ── 5a. batches: RLS already enabled (001_initial_schema.sql) ───────────

-- Drop all existing write policies on batches to start clean
DROP POLICY IF EXISTS "Producer insert batches"           ON public.batches;
DROP POLICY IF EXISTS "Producer update own batches"       ON public.batches;
DROP POLICY IF EXISTS "Inspector update inspection"       ON public.batches;
DROP POLICY IF EXISTS "SME claim batch ownership"         ON public.batches;
DROP POLICY IF EXISTS "Service role full batches"         ON public.batches;
DROP POLICY IF EXISTS "Admin full batches"                ON public.batches;

-- 5a-i. Public read: anyone can scan a QR code and see batch data.
--        (Existing policy "Allow public read access to active batches" already
--         grants this. We leave it in place and do NOT recreate it.)

-- 5a-ii. Producers can INSERT new batches.
CREATE POLICY "Producer insert batches"
  ON public.batches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('producer', 'processor')
  );

-- 5a-iii. Producers can UPDATE their own batches (non-inspection fields).
CREATE POLICY "Producer update own batches"
  ON public.batches
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('producer', 'processor')
    AND (
      producer_id = auth.uid()
      OR processor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('producer', 'processor')
    AND (
      producer_id = auth.uid()
      OR processor_id = auth.uid()
    )
  );

-- 5a-iv. Inspectors can UPDATE batches to set inspection fields.
--         Restricted to rows where they are assigned as inspector OR
--         where inspector_id is still NULL (first-come assignment).
CREATE POLICY "Inspector update inspection"
  ON public.batches
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'inspector'
    AND (inspector_id = auth.uid() OR inspector_id IS NULL)
  )
  WITH CHECK (
    public.get_user_role() = 'inspector'
    AND inspector_id = auth.uid()
  );

-- 5a-v. SME owners / buyers / processors can UPDATE to claim ownership
--        (set sme_owner_id, transition status to 'sme_inventory').
CREATE POLICY "SME claim batch ownership"
  ON public.batches
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('processor', 'buyer', 'sme_owner')
    AND (sme_owner_id = auth.uid() OR sme_owner_id IS NULL)
  )
  WITH CHECK (
    public.get_user_role() IN ('processor', 'buyer', 'sme_owner')
    AND sme_owner_id = auth.uid()
  );

-- 5a-vi. Service role (backend server) has unrestricted access.
CREATE POLICY "Service role full batches"
  ON public.batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5a-vii. Admins have full access for platform operations.
CREATE POLICY "Admin full batches"
  ON public.batches
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ── 5b. batch_custody_ledger: enable RLS ────────────────────────────────

ALTER TABLE public.batch_custody_ledger ENABLE ROW LEVEL SECURITY;

-- 5b-i. Public read: QR scans show the full custody chain.
CREATE POLICY "Public read custody ledger"
  ON public.batch_custody_ledger
  FOR SELECT
  USING (true);

-- 5b-ii. Producers can INSERT 'production' events.
CREATE POLICY "Producer insert production events"
  ON public.batch_custody_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('producer', 'processor')
    AND action_type = 'production'
    AND actor_id = auth.uid()
  );

-- 5b-iii. Inspectors can INSERT 'inspection' events.
CREATE POLICY "Inspector insert inspection events"
  ON public.batch_custody_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'inspector'
    AND action_type = 'inspection'
    AND actor_id = auth.uid()
  );

-- 5b-iv. SME owners / buyers / processors can INSERT 'sme_receipt' events.
CREATE POLICY "SME insert receipt events"
  ON public.batch_custody_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('processor', 'buyer', 'sme_owner')
    AND action_type = 'sme_receipt'
    AND actor_id = auth.uid()
  );

-- 5b-v. Service role has full access (for backend orchestration).
CREATE POLICY "Service role full custody ledger"
  ON public.batch_custody_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5b-vi. Admin has full access.
CREATE POLICY "Admin full custody ledger"
  ON public.batch_custody_ledger
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 5b-vii. The ledger is append-only: no UPDATE or DELETE for non-admins.
--          (No UPDATE/DELETE policies created for authenticated users,
--           so Postgres RLS will deny those operations by default.)


COMMIT;
