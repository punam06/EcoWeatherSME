-- ClimaLogix AI / ClimateShield investor demo seed companion.
--
-- The high-volume deterministic data generator lives at:
--   scripts/seed-investor-demo-data.ts
--
-- Recommended run:
--   DATABASE_URL="postgresql://..." npm run seed:investor-demo
--
-- This SQL file is useful in the Supabase SQL editor before running the
-- TypeScript seed, or as a quick verification/cleanup companion.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'batches', 'iot_readings', 'verification_requests', 'qr_scans',
    'qa_reports', 'provenance_records', 'notifications', 'products', 'orders',
    'order_lifecycle_logs', 'esg_metrics', 'esg_reports', 'dispatch_exposure_logs',
    'dispatch_schedules'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE',
        table_name
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.batches
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_id UUID,
  ADD COLUMN IF NOT EXISTS evaluation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS shipment_token TEXT,
  ADD COLUMN IF NOT EXISTS shipment_dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspector_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspector_verdict TEXT,
  ADD COLUMN IF NOT EXISTS verdict_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inspector_certification_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qr_image_data TEXT,
  ADD COLUMN IF NOT EXISTS qr_expiry_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_number TEXT,
  ADD COLUMN IF NOT EXISTS current_provenance_hash TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
  ADD COLUMN IF NOT EXISTS ingredients JSONB,
  ADD COLUMN IF NOT EXISTS certification_claims JSONB;

ALTER TABLE IF EXISTS public.batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE IF EXISTS public.batches ADD CONSTRAINT batches_status_check
  CHECK (status IN (
    'pending', 'active', 'certified', 'dispatched', 'delivered',
    'created', 'inspected', 'in_transit', 'sme_inventory', 'sold',
    'registered', 'evaluation_failed', 'evaluation_passed', 'awaiting_shipment',
    'shipped', 'under_review', 'rejected', 'approved', 'expired', 'revoked'
  ));

ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE IF EXISTS public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('processor', 'buyer', 'admin', 'producer', 'consumer', 'sme_owner', 'inspector'));

ALTER TABLE IF EXISTS public.qa_reports DROP CONSTRAINT IF EXISTS chk_bsti_format;
ALTER TABLE IF EXISTS public.qa_reports ADD CONSTRAINT chk_bsti_format
  CHECK (
    bsti_credential IS NULL
    OR bsti_credential ~ '^BSTI-[0-9]{4,}$'
    OR bsti_credential ~ '^DEMO-BSTI-[0-9]{4}-[0-9]{4,}$'
  );

CREATE INDEX IF NOT EXISTS idx_batches_demo_status_created_at
  ON public.batches(is_demo, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batches_demo_category_created_at
  ON public.batches(is_demo, category, created_at DESC);

-- Demo-only cleanup. Uncomment deliberately in a demo database only.
-- DELETE FROM public.order_lifecycle_logs WHERE is_demo = true;
-- DELETE FROM public.orders WHERE is_demo = true;
-- DELETE FROM public.products WHERE is_demo = true;
-- DELETE FROM public.qr_scans WHERE is_demo = true;
-- DELETE FROM public.provenance_records WHERE is_demo = true;
-- DELETE FROM public.qa_reports WHERE is_demo = true;
-- DELETE FROM public.iot_readings WHERE is_demo = true;
-- DELETE FROM public.verification_requests WHERE is_demo = true;
-- DELETE FROM public.notifications WHERE is_demo = true;
-- DELETE FROM public.esg_metrics WHERE is_demo = true;
-- DELETE FROM public.esg_reports WHERE is_demo = true;
-- DELETE FROM public.batches WHERE is_demo = true;
-- DELETE FROM public.users WHERE is_demo = true AND email LIKE '%@climalogix.test';

-- Post-seed acceptance checks:
SELECT 'demo_batches' AS metric, COUNT(*) AS value FROM public.batches WHERE is_demo = true
UNION ALL
SELECT 'approved_demo_batches', COUNT(*) FROM public.batches WHERE is_demo = true AND status = 'approved'
UNION ALL
SELECT 'approved_demo_qr_urls', COUNT(*) FROM public.batches WHERE is_demo = true AND status = 'approved' AND qr_code_url IS NOT NULL
UNION ALL
SELECT 'demo_qr_scans', COUNT(*) FROM public.qr_scans WHERE is_demo = true
UNION ALL
SELECT 'demo_provenance_records', COUNT(*) FROM public.provenance_records WHERE is_demo = true;
