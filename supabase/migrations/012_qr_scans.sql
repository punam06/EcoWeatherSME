-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — QR SCAN LOG
-- File: supabase/migrations/012_qr_scans.sql
--
-- Adds the qr_scans table that records every consumer QR scan.
-- Populated by GET /api/verify/:batch_id in backend/src/api/routes/verify.route.ts.
-- Read by:
--   - GET /api/batches/:id/scans  (operator dashboard "Recent QR Scans" feed)
--   - <TrackingView />  (source-to-consumer journey timeline)
--
-- Design notes:
--   - batch_id is a free-form text (BCH-123, uuid, etc.) so no FK to batches.id
--     to keep this migration independent of the batches schema.
--   - ip_hash stores a one-way hash of the IP (never raw IP) for GDPR compliance.
--   - RLS disabled by default (service role writes; JWT-gated API reads).
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS qr_scans (
  id           BIGSERIAL    PRIMARY KEY,
  batch_id     TEXT         NOT NULL,
  user_agent   TEXT,
  ip_hash      TEXT,
  scanned_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for "most recent scans for a batch" (primary read pattern)
CREATE INDEX IF NOT EXISTS idx_qr_scans_batch_recent
  ON qr_scans (batch_id, scanned_at DESC);

-- Index for "all scans in the last 24h" (dashboard activity feed)
CREATE INDEX IF NOT EXISTS idx_qr_scans_recent
  ON qr_scans (scanned_at DESC);

-- Optional: cap retention to 90 days via a future cron job.
-- (Not added here to keep this migration single-statement.)
