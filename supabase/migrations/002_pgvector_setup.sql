-- ═══════════════════════════════════════════════════════════════
-- ECOSORTHA AI — MIGRATION 002: pgvector Setup
-- File: supabase/migrations/002_pgvector_setup.sql
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension for semantic embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── BARI Knowledge Chunks (Vector Store) ────────────────────────────────────
-- Stores embedded BARI knowledge chunks for vector similarity search.
-- Used by the RAG service for semantic context retrieval.

CREATE TABLE IF NOT EXISTS bari_knowledge_chunks (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT            NOT NULL,
  embedding   vector(1536),
  category    VARCHAR(100),
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bari_knowledge_chunks IS
  'pgvector store for BARI agricultural knowledge chunks. ' ||
  'Embeddings are 1536-dim OpenAI/Groq compatible vectors for cosine similarity search.';

COMMENT ON COLUMN bari_knowledge_chunks.content IS
  'Raw text content of the BARI knowledge chunk';

COMMENT ON COLUMN bari_knowledge_chunks.embedding IS
  '1536-dimensional embedding vector for semantic similarity search';

COMMENT ON COLUMN bari_knowledge_chunks.category IS
  'Category tag: pH Standards, EC Thresholds, EM-1 Fermentation, Temperature Safety, Urban Heat Island';

-- ─── IVFFlat Index for cosine similarity search ───────────────────────────────
-- Required for fast approximate nearest-neighbour (ANN) search.
-- ivfflat with vector_cosine_ops is recommended for normalised embeddings.

CREATE INDEX IF NOT EXISTS idx_bari_knowledge_chunks_embedding
  ON bari_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── RPC Function: Match BARI Chunks ─────────────────────────────────────────
-- Stored function for vector similarity search callable from Supabase client.
-- Returns top-k most similar chunks for a given query embedding.

CREATE OR REPLACE FUNCTION match_bari_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  category   VARCHAR(100),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bkc.id,
    bkc.content,
    bkc.category,
    1 - (bkc.embedding <=> query_embedding) AS similarity
  FROM bari_knowledge_chunks bkc
  WHERE 1 - (bkc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_bari_chunks IS
  'Vector similarity search over BARI knowledge chunks. ' ||
  'Returns chunks with cosine similarity above match_threshold, ordered by relevance.';

-- ─── Seed: Initial BARI Knowledge Chunks (text only, embeddings to be computed) ─

INSERT INTO bari_knowledge_chunks (content, category)
VALUES
  (
    'BARI pH Standards for Organic Compost (BARI-OC-2024): ' ||
    'The optimal pH range for certified organic compost and bio-slurry is 6.5 to 7.5. ' ||
    'pH below 6.5 indicates excessive acidity which inhibits microbial activity. ' ||
    'pH above 7.5 leads to ammonia volatilisation and reduced phosphorus solubility. ' ||
    'Each 0.1 unit deviation from the ideal range incurs a −2 point trust penalty.',
    'pH Standards'
  ),
  (
    'BARI Electrical Conductivity Standards for Bio-Fertilizer Viability (BARI-EC-2025): ' ||
    'Ideal EC range for EM-1 bio-fertilizer: 1.5–3.5 dS/m (equivalent to 1500–3500 µS/cm). ' ||
    'EC below 1.5 dS/m indicates insufficient nutrient concentration. ' ||
    'EC above 3.5 dS/m creates osmotic stress that suppresses plant root development. ' ||
    'Critical threshold: EC > 5.0 dS/m renders product non-viable for organic certification. ' ||
    'Each 0.5 dS/m deviation incurs a −3 point trust score penalty.',
    'EC Thresholds'
  ),
  (
    'BARI EM-1 Fermentation Standard (BARI-EM-2025): ' ||
    'Approved EM-1 application ratios: 1:500 (0.002), 1:1000 (0.001), and 1:2000 (0.0005). ' ||
    'Any ratio outside these three approved values is non-compliant and incurs −10 trust penalty. ' ||
    'Minimum fermentation duration: 21 days to ensure complete anaerobic transformation. ' ||
    'Each day below the 21-day minimum incurs −4 points.',
    'EM-1 Fermentation'
  ),
  (
    'BARI Temperature Safety Guidelines for Organic Transit in Bangladesh (BARI-TS-2024): ' ||
    'Safe storage temperature range: 25–35°C for bio-slurry and EM-1 products. ' ||
    'Below 25°C: microbial activity slows, reducing biological effectiveness. ' ||
    'Above 35°C: accelerated protein denaturation and pathogen growth risk. ' ||
    'Each 1°C outside the 25–35°C range incurs −1.5 trust penalty. ' ||
    'Critical threshold: >40°C causes irreversible microbial colony collapse.',
    'Temperature Safety'
  ),
  (
    'Urban Heat Island (UHI) Effect on Perishable Organic Goods in Bangladesh (BARI-UHI-2025): ' ||
    'Dhaka built environment creates UHI offsets: Uttara +2.1°C (MODERATE), Dhanmondi +2.5°C (MODERATE), ' ||
    'Mohammadpur +2.8°C (HIGH), Mirpur +3.2°C (HIGH), Motijheel +3.5°C (CRITICAL). ' ||
    'TST formula: TST = max(0, 480 − (EffectiveTemp − 30) × 18) minutes. ' ||
    'Safe dispatch window: 06:00–08:00 AM before peak solar loading.',
    'Urban Heat Island'
  )
ON CONFLICT DO NOTHING;
