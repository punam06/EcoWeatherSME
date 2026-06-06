# ClimaLogix AI — BARI Compliance Document Ingestion

## Overview

The `ingest-bari` script reads PDF or plain-text BARI compliance documents and inserts them as text chunks into the `bari_knowledge_chunks` Supabase table, which powers the RAG (Retrieval-Augmented Generation) AI recommendation engine.

---

## Prerequisites

1. **Supabase configured** — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set in `backend/.env`.
2. **`bari_knowledge_chunks` table** — must exist in Supabase. Run the schema migration if not present.
3. **Node.js ≥ 18** and `ts-node` installed (comes with backend dev dependencies).

### Optional: PDF Support

To ingest PDF files, install the `pdf-parse` package:

```bash
cd backend
npm install pdf-parse
```

Plain-text (`.txt`) and Markdown (`.md`) files work out-of-the-box without additional dependencies.

---

## Document Directory

By default, the script looks for documents in the `bari_docs/` directory at the **repository root**:

```
hackathon-ev/
├── bari_docs/              ← Place your BARI PDF/TXT files here
│   ├── BARI-OC-2024.pdf
│   ├── EM1-Inoculant-Guidelines.txt
│   └── Compost-Temperature-BARI-T-2024.md
├── backend/
│   └── src/scripts/ingestBariDocs.ts
└── README_INGEST.md
```

You can override the directory with an environment variable:

```bash
BARI_DOCS_DIR=/path/to/docs npm run ingest-bari
```

---

## Running the Ingestion

```bash
# From the backend directory:
cd backend

# Standard run (reads bari_docs/ at repo root):
npm run ingest-bari

# Custom docs directory:
BARI_DOCS_DIR=../my-bari-documents npm run ingest-bari

# Custom chunk size (default: 800 chars) and overlap (default: 150):
INGEST_CHUNK_SIZE=600 INGEST_OVERLAP=100 npm run ingest-bari
```

---

## What the Script Does

1. **Scans** the target directory for `.pdf`, `.txt`, `.md` files.
2. **Extracts** raw text (using `pdf-parse` for PDFs, or plain UTF-8 for text files).
3. **Splits** text into overlapping chunks of ~800 characters.
4. **Derives** a category from the filename (e.g. `ph` → `pH Standards`).
5. **Upserts** all chunks into `bari_knowledge_chunks` using the chunk ID as the conflict key (safe to re-run).
6. **Falls back** to seeding the 5 built-in BARI compliance chunks if no document directory is found.

---

## Supabase Table Schema

The `bari_knowledge_chunks` table must have the following columns:

```sql
CREATE TABLE IF NOT EXISTS public.bari_knowledge_chunks (
  id             TEXT PRIMARY KEY,
  file_name      TEXT NOT NULL,
  category       TEXT NOT NULL,
  content        TEXT NOT NULL,
  chunk_index    INTEGER NOT NULL DEFAULT 0,
  total_chunks   INTEGER NOT NULL DEFAULT 1,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index (used by RAG service)
CREATE INDEX IF NOT EXISTS bari_knowledge_chunks_fts
  ON public.bari_knowledge_chunks
  USING GIN(to_tsvector('english', content));
```

---

## Naming Convention for Files

To get accurate automatic category assignment, name your files using these keywords:

| Keyword in filename | Assigned category |
|---------------------|-------------------|
| `ph` | pH Standards |
| `ec`, `conductivity` | Electrical Conductivity |
| `temp`, `ferment` | Fermentation Temperature |
| `em1`, `em-1` | EM-1 Microbial Inoculant |
| `days`, `curing` | Stabilization Curing Days |
| `tomato` | Tomato Cultivation |
| `esg`, `sustain` | ESG Sustainability |
| `climate`, `uhi` | Climate & UHI |
| (any other) | General Compliance |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Supabase credentials missing` | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` |
| `pdf-parse MODULE_NOT_FOUND` | Run `npm install pdf-parse` in `backend/` |
| `bari_knowledge_chunks: relation does not exist` | Apply the DB migration in `schema.sql` |
| Empty chunks inserted | Check document encoding — use UTF-8 for `.txt` files |
| Duplicate key errors | Script uses `upsert` with `onConflict: 'id'` — safe to re-run |
