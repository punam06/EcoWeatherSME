-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — MIGRATION: Add base_price to batches Table
-- File: supabase/migrations/20260602194600_add_base_price_to_batches.sql
-- ═══════════════════════════════════════════════════════════════

-- Default 1000 BDT placeholder. Update with real pricing data before production.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 1000;
