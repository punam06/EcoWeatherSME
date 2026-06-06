-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — MIGRATION 007: Platform orders table
-- File: supabase/migrations/007_create_orders.sql
--
-- Matches Supabase inserts in:
--   backend/src/lib/services/orderExecution.service.ts
--   backend/src/api/routes/agent.route.ts
-- Columns: buyer_id, product_id, quantity, totalBdt, status; returns id.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id TEXT NOT NULL,
  product_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  "totalBdt" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'canceled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "totalBdt" NUMERIC(12, 2) NOT NULL DEFAULT 0;


COMMENT ON TABLE public.orders IS
  'Checkout orders from agent voice commerce and session confirmation flows.';

COMMENT ON COLUMN public.orders.buyer_id IS
  'Farmer or buyer identifier (UUID string or demo session id).';

COMMENT ON COLUMN public.orders.product_id IS
  'Catalog product UUID; null for custom/demo catalog items.';

COMMENT ON COLUMN public.orders."totalBdt" IS
  'Order total in BDT; camelCase key matches backend Supabase client payloads.';

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orders"
  ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
