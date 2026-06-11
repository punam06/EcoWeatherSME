-- Migration 014: Fix Batch RLS Select/Insert policies for Producer/SME owners
-- File: supabase/migrations/014_batch_rls_select_policies.sql

BEGIN;

-- Drop exist select policies on batches if any to avoid conflicts
DROP POLICY IF EXISTS "SME owner select own batches" ON public.batches;
DROP POLICY IF EXISTS "Producer select own batches" ON public.batches;
DROP POLICY IF EXISTS "SME owner insert own batches" ON public.batches;

-- RLS SELECT Policy: SME Owners and Producers should be able to select their own batches
-- Since roles can be 'producer', 'processor', 'sme', 'sme_owner', 'buyer', we check appropriate IDs.
CREATE POLICY "SME owner select own batches"
  ON public.batches
  FOR SELECT
  TO authenticated
  USING (
    processor_id = auth.uid()
    OR producer_id = auth.uid()
    OR sme_owner_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'inspector')
  );

-- RLS INSERT Policy: SME owners and producers can insert their own batches
CREATE POLICY "SME owner insert own batches"
  ON public.batches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    processor_id = auth.uid()
    OR producer_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'inspector')
  );

COMMIT;
