-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — MIGRATION 006: Create checkout_orders Table
-- File: supabase/migrations/006_create_checkout_orders.sql
-- ═══════════════════════════════════════════════════════════════

-- Create the checkout_orders table
CREATE TABLE IF NOT EXISTS checkout_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  product_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  transcript TEXT NOT NULL,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE checkout_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert for authenticated users only
CREATE POLICY "Allow insert for authenticated users only"
  ON checkout_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow select for service role only
CREATE POLICY "Allow select for service role only"
  ON checkout_orders
  FOR SELECT
  TO service_role
  USING (true);
