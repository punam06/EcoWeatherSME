-- Investor-scale indexes for batch registry, notifications, and provenance lookups.

CREATE INDEX IF NOT EXISTS idx_batches_status
  ON public.batches(status);

CREATE INDEX IF NOT EXISTS idx_batches_manufacturer_id
  ON public.batches(manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_batches_category
  ON public.batches(category);

CREATE INDEX IF NOT EXISTS idx_batches_created_at_desc
  ON public.batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provenance_records_batch_created
  ON public.provenance_records(batch_id, timestamp);

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
