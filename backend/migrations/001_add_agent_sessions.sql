-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 001: Add agent_sessions table for persistent AI memory
-- Run this in Supabase SQL editor or via psql.
-- ═══════════════════════════════════════════════════════════════

-- Persistent session store for hybrid in-memory + DB memory
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    farmer_id VARCHAR(100),
    history JSONB NOT NULL DEFAULT '[]',
    pending_order JSONB,
    last_seen_products JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_expires_at ON agent_sessions(expires_at);

-- Auto-expire sessions (RLS does not auto-delete; this is for cleanup queries)
-- Run this periodically: DELETE FROM agent_sessions WHERE expires_at < NOW();

-- Enable Row-Level Security (RLS) policies
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous access based on application logic 
-- (Note: Backend using Service Role key will bypass RLS anyway)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend service role to manage agent sessions' AND tablename = 'agent_sessions'
    ) THEN
        CREATE POLICY "Allow backend service role to manage agent sessions" 
        ON agent_sessions FOR ALL TO public USING (true);
    END IF;
END
$$;
