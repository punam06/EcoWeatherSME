-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — PROVENANCE EVENT TYPES ALIGNMENT
-- File: supabase/migrations/011_provenance_event_types_alignment.sql
--
-- Aligns the provenance_records.event_type CHECK constraint
-- with the TypeScript service (provenance.service.ts) and the
-- frontend, which use:
--
--   'genesis' | 'qa' | 'dispatched' | 'delivered'
--
-- (The previous migration 009 used 'dispatch' and 'delivery' and
--  omitted 'genesis'. The QR verify flow expects a 3-event chain
--  genesis -> dispatched -> delivered.)
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE provenance_records
  DROP CONSTRAINT IF EXISTS provenance_records_event_type_check;

ALTER TABLE provenance_records
  ADD CONSTRAINT provenance_records_event_type_check
  CHECK (event_type IN ('genesis', 'qa', 'dispatched', 'delivered'));
