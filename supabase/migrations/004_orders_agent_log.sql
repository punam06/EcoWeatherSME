-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — MIGRATION 004: Orders and Agent Logs
-- File: supabase/migrations/004_orders_agent_log.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  farmer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  intent VARCHAR(50) NOT NULL,
  response_type VARCHAR(50) NOT NULL,
  language VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_session_id ON agent_interaction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_session_id ON pending_orders(session_id);
