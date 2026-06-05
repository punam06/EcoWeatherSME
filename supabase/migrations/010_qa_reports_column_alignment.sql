-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — QA REPORTS COLUMN ALIGNMENT
-- File: supabase/migrations/010_qa_reports_column_alignment.sql
--
-- Aligns the qa_reports table with what the TypeScript service
-- (qaIngestion.service.ts) actually writes, and what the public
-- read route (qa.route.ts) actually returns.
--
--   - rename note           -> inspector_notes
--   - rename submitted_by   -> signed_by
--   - add    signed_at      (defaults to now() for legacy rows)
--
-- Safe to re-run: every change is idempotent.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Rename note -> inspector_notes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_reports' AND column_name = 'note'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_reports' AND column_name = 'inspector_notes'
  ) THEN
    ALTER TABLE qa_reports RENAME COLUMN note TO inspector_notes;
  END IF;

  -- Rename submitted_by -> signed_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_reports' AND column_name = 'submitted_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_reports' AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE qa_reports RENAME COLUMN submitted_by TO signed_by;
  END IF;

  -- Add signed_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_reports' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE qa_reports
      ADD COLUMN signed_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- Helpful index for time-range lookups (ESG rollups, batch timelines)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'qa_reports' AND indexname = 'idx_qa_reports_signed_at'
  ) THEN
    CREATE INDEX idx_qa_reports_signed_at ON qa_reports(signed_at DESC);
  END IF;
END $$;
