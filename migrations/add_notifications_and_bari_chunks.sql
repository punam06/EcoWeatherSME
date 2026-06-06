-- ═══════════════════════════════════════════════════════════════
-- CLIMALOGIX AI — ADDITIVE MIGRATIONS (retouch branch)
-- File: migrations/add_notifications_and_bari_chunks.sql
--
-- Run this ONCE on your Supabase instance to support:
--   Task 1 - Notifications system
--   Task 6 - BARI RAG ingestion with full-text search
-- ═══════════════════════════════════════════════════════════════

-- ── Task 1: Notifications Table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,           -- references auth.users.id (Supabase Auth)
  type        TEXT NOT NULL CHECK (
    type IN (
      'trust_pass', 'trust_fail', 'temp_alert',
      'dispatch_approved', 'dispatch_rejected',
      'order_update', 'budget_alert'
    )
  ),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id, created_at DESC);

-- Enable Row-Level Security — users can only see their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users see own notifications'
      AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users see own notifications"
      ON public.notifications
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

-- ── Task 6: BARI Knowledge Chunks Table (RAG) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bari_knowledge_chunks (
  id            TEXT PRIMARY KEY,
  file_name     TEXT NOT NULL DEFAULT 'builtin',
  category      TEXT NOT NULL DEFAULT 'General Compliance',
  content       TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  total_chunks  INTEGER NOT NULL DEFAULT 1,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index for RAG retrieval
CREATE INDEX IF NOT EXISTS bari_knowledge_chunks_fts
  ON public.bari_knowledge_chunks
  USING GIN(to_tsvector('english', content));

-- Category lookup index
CREATE INDEX IF NOT EXISTS idx_bari_chunks_category
  ON public.bari_knowledge_chunks(category);

-- ── Task 4: Order Tracking Events Table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL,
  carrier       TEXT NOT NULL DEFAULT 'internal',
  tracking_id   TEXT,
  status        TEXT NOT NULL,
  location      TEXT,
  description   TEXT,
  event_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id
  ON public.order_tracking_events(order_id, event_time DESC);

-- RLS: let authenticated users read tracking events for their own orders
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated read order tracking'
      AND tablename = 'order_tracking_events'
  ) THEN
    CREATE POLICY "Authenticated read order tracking"
      ON public.order_tracking_events
      FOR SELECT
      TO authenticated
      USING (true);  -- order ownership enforced at application layer
  END IF;
END
$$;
