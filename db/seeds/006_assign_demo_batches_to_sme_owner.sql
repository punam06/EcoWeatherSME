-- ═══════════════════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — ASSIGN DEMO BATCHES TO AN SME OWNER
-- File: db/seeds/006_assign_demo_batches_to_sme_owner.sql
--
-- PURPOSE
-- The Batch Verification panel on the SME Owner dashboard is wired to
-- GET /api/batches. The listBatches() service-layer filter narrows the
-- listing to batches the calling user owns in any of:
--     manufacturer_id, processor_id, producer_id, sme_owner_id
--
-- The 5 demo batches seeded in 003_demo_batches.sql have only
-- processor_id set (to the demo processor user). An sme_owner user,
-- therefore, sees an empty list and the frontend renders the
-- "No batches available for verification." empty state.
--
-- This seed assigns the 5 demo batches to the first sme_owner user in
-- the users table (or, failing that, the most-recently-created user with
-- the sme_owner role). It is idempotent: re-running it will not duplicate
-- or change the assignment unless the demo batches already have a
-- different sme_owner_id set.
--
-- RUN
--   1. Open the Supabase SQL editor for the target project.
--   2. Paste and run this file.
--   3. Reload localhost:3000 / the deployed URL.
--   4. The SME Owner's "Batch Verification & QR" tab should now list
--      the 5 demo batches with their QR codes.
--
-- If you have multiple sme_owner users and want a specific one, replace
-- the CTE `target_sme` with a literal UUID before running.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Pick the first user with role = 'sme_owner' (most recently created first).
WITH target_sme AS (
  SELECT id
  FROM users
  WHERE role = 'sme_owner'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
)
UPDATE public.batches
SET sme_owner_id = (SELECT id FROM target_sme)
WHERE batch_number IN (
  'BATCH-DEMO-001',
  'BATCH-DEMO-002',
  'BATCH-DEMO-003',
  'BATCH-DEMO-004',
  'BATCH-DEMO-005'
)
  AND (
    sme_owner_id IS NULL
    OR sme_owner_id <> (SELECT id FROM target_sme)
  )
  AND (SELECT id FROM target_sme) IS NOT NULL;

-- If no sme_owner user exists yet, raise a friendly notice so the
-- operator knows to sign up an sme_owner account first.
DO $$
DECLARE
  sme_count INT;
  assigned_count INT;
BEGIN
  SELECT COUNT(*) INTO sme_count FROM users WHERE role = 'sme_owner';
  IF sme_count = 0 THEN
    RAISE NOTICE 'No sme_owner user found. Sign up an sme_owner account first, then re-run this seed.';
  ELSE
    SELECT COUNT(*) INTO assigned_count
    FROM public.batches
    WHERE batch_number LIKE 'BATCH-DEMO-%'
      AND sme_owner_id IS NOT NULL;
    RAISE NOTICE 'Assigned % demo batches to an sme_owner user. Reload the SME dashboard to see them.', assigned_count;
  END IF;
END $$;

COMMIT;
