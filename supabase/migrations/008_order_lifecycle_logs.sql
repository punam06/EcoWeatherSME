-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — MIGRATION 008: Order lifecycle audit log
-- File: supabase/migrations/008_order_lifecycle_logs.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.order_lifecycle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  event VARCHAR(30) NOT NULL
    CHECK (event IN ('created', 'confirmed', 'dispatched', 'received')),
  session_id VARCHAR(100),
  buyer_id TEXT,
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_order_id
  ON public.order_lifecycle_logs (order_id);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_event
  ON public.order_lifecycle_logs (event);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_logs_created_at
  ON public.order_lifecycle_logs (created_at DESC);

ALTER TABLE public.order_lifecycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on order_lifecycle_logs"
  ON public.order_lifecycle_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
