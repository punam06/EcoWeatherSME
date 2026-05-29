-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — MIGRATION 001: Initial Schema
-- File: supabase/migrations/001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Bio-Asset Certifications Log ────────────────────────────────────────────
-- Stores every trust score calculation with its inputs and result.

CREATE TABLE IF NOT EXISTS trust_score_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ph              DECIMAL(5,3)  NOT NULL,
  ec              DECIMAL(5,3)  NOT NULL,
  temperature     DECIMAL(6,3)  NOT NULL,
  em1_ratio       DECIMAL(10,6) NOT NULL,
  fermentation_days INTEGER     NOT NULL CHECK (fermentation_days >= 0),
  score           DECIMAL(6,3)  NOT NULL CHECK (score >= 0 AND score <= 100),
  grade           VARCHAR(2)    NOT NULL CHECK (grade IN ('A', 'B', 'C', 'F')),
  is_viable       BOOLEAN       NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trust_score_logs IS
  'Audit log of every BARI trust score calculation. Immutable insert-only log.';

COMMENT ON COLUMN trust_score_logs.ph IS 'pH reading of the biological material (0–14)';
COMMENT ON COLUMN trust_score_logs.ec IS 'Electrical Conductivity in dS/m';
COMMENT ON COLUMN trust_score_logs.temperature IS 'Storage temperature in °C at time of reading';
COMMENT ON COLUMN trust_score_logs.em1_ratio IS 'EM-1 dilution ratio as decimal (0.002 = 1:500)';
COMMENT ON COLUMN trust_score_logs.score IS 'Computed trust score (0–100)';
COMMENT ON COLUMN trust_score_logs.grade IS 'Quality grade: A≥85, B≥70, C≥55, F<55';
COMMENT ON COLUMN trust_score_logs.is_viable IS 'true if score ≥ 55 (BARI certification minimum)';

-- Index for time-series queries and analytics
CREATE INDEX IF NOT EXISTS idx_trust_score_logs_created_at
  ON trust_score_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_score_logs_grade
  ON trust_score_logs (grade);

-- ─── Delivery Viability Assessments Log ──────────────────────────────────────
-- Stores every DVS calculation with MERM inputs and results.

CREATE TABLE IF NOT EXISTS dvs_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zone                VARCHAR(50) NOT NULL,
  ambient_temperature DECIMAL(6,3) NOT NULL,
  solar_hour          INTEGER     NOT NULL CHECK (solar_hour >= 0 AND solar_hour <= 23),
  trust_score         DECIMAL(6,3) NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
  dvs_score           DECIMAL(6,3) NOT NULL CHECK (dvs_score >= 0 AND dvs_score <= 100),
  delivery_approved   BOOLEAN     NOT NULL,
  tst_minutes         DECIMAL(8,3) NOT NULL CHECK (tst_minutes >= 0),
  hazard_class        VARCHAR(20) NOT NULL CHECK (hazard_class IN ('MODERATE', 'HIGH', 'CRITICAL')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dvs_logs IS
  'Audit log of every Delivery Viability Score (DVS) calculation with MERM inputs.';

COMMENT ON COLUMN dvs_logs.zone IS 'Dhaka delivery zone name';
COMMENT ON COLUMN dvs_logs.ambient_temperature IS 'Regional ambient temperature in °C';
COMMENT ON COLUMN dvs_logs.solar_hour IS '24-hour clock hour when calculation was made';
COMMENT ON COLUMN dvs_logs.tst_minutes IS 'Computed Thermal Survival Time in minutes';
COMMENT ON COLUMN dvs_logs.dvs_score IS 'Combined Delivery Viability Score (0–100)';
COMMENT ON COLUMN dvs_logs.hazard_class IS 'MODERATE | HIGH | CRITICAL';

CREATE INDEX IF NOT EXISTS idx_dvs_logs_zone
  ON dvs_logs (zone);

CREATE INDEX IF NOT EXISTS idx_dvs_logs_created_at
  ON dvs_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dvs_logs_delivery_approved
  ON dvs_logs (delivery_approved);

-- ─── AI RAG Query Logs ────────────────────────────────────────────────────────
-- Stores every AI question and response for analytics and improvement.

CREATE TABLE IF NOT EXISTS rag_query_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query       TEXT        NOT NULL,
  language    VARCHAR(5)  NOT NULL CHECK (language IN ('bn', 'en')),
  answer      TEXT        NOT NULL,
  tokens_used INTEGER     NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rag_query_logs IS
  'Audit log of every Groq RAG query with language, response, and token usage.';

COMMENT ON COLUMN rag_query_logs.language IS 'Response language: bn = Bangla, en = English';
COMMENT ON COLUMN rag_query_logs.tokens_used IS 'Total tokens consumed (prompt + completion)';

CREATE INDEX IF NOT EXISTS idx_rag_query_logs_created_at
  ON rag_query_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_query_logs_language
  ON rag_query_logs (language);
