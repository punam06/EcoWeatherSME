-- ClimaLogix AI / EcoWeatherSME
-- Batch verification, inspector workflow, QR certification, public scan logging.
-- Safe additive migration: uses IF NOT EXISTS and keeps existing data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS category TEXT,
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

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS certificate_url TEXT;

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  manufacturer_id UUID,
  inspector_id UUID,
  inspector_certification_id TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_shipment',
  preliminary_trust_score NUMERIC,
  evaluation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  verdict TEXT,
  verdict_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_batch_id
  ON public.verification_requests(batch_id);

CREATE INDEX IF NOT EXISTS idx_verification_requests_inspector_status
  ON public.verification_requests(inspector_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT,
  status_returned TEXT,
  scan_location_optional JSONB
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_batch_id_scanned_at
  ON public.qr_scans(batch_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS public.provenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, seq),
  UNIQUE(batch_id, current_hash)
);

CREATE INDEX IF NOT EXISTS idx_provenance_records_batch_seq
  ON public.provenance_records(batch_id, seq);

CREATE INDEX IF NOT EXISTS idx_batches_status_created_at
  ON public.batches(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batches_category_created_at
  ON public.batches(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batches_batch_number
  ON public.batches(batch_number);

-- Existing notification migrations had a narrow CHECK constraint. Replace it
-- with the expanded event list used by the verification lifecycle.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'notifications'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS destination_zone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check CHECK (
        type IN (
          'trust_pass', 'trust_fail', 'temp_alert',
          'dispatch_approved', 'dispatch_rejected',
          'order_update', 'budget_alert',
          'evaluation_failed', 'evaluation_passed',
          'verification_request', 'product_shipped',
          'product_received', 'batch_rejected', 'qr_ready'
        )
      );
  END IF;
END $$;

-- Database backstop: approved/locked batches cannot have core product or
-- certification fields mutated through any client path.
CREATE OR REPLACE FUNCTION public.prevent_locked_batch_core_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_locked = TRUE OR OLD.status IN ('approved', 'expired', 'revoked') THEN
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.product_type IS DISTINCT FROM OLD.product_type
       OR NEW.feedstock_type IS DISTINCT FROM OLD.feedstock_type
       OR NEW.ingredients IS DISTINCT FROM OLD.ingredients
       OR NEW.certification_claims IS DISTINCT FROM OLD.certification_claims
       OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg
       OR NEW.packaging_type IS DISTINCT FROM OLD.packaging_type
       OR NEW.evaluation_summary IS DISTINCT FROM OLD.evaluation_summary
       OR NEW.evaluation_breakdown IS DISTINCT FROM OLD.evaluation_breakdown THEN
      RAISE EXCEPTION 'Approved or locked batches are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_batch_core_update ON public.batches;
CREATE TRIGGER trg_prevent_locked_batch_core_update
BEFORE UPDATE ON public.batches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_batch_core_update();
