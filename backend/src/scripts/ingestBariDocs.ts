#!/usr/bin/env ts-node
/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — BARI COMPLIANCE DOCUMENT INGESTION SCRIPT
 * File: src/scripts/ingestBariDocs.ts
 *
 * Purpose:
 *   Reads PDF or plain-text BARI compliance documents from the
 *   `bari_docs/` directory (relative to repo root), splits them
 *   into overlapping text chunks, and inserts them into the
 *   `bari_knowledge_chunks` Supabase table.
 *
 * Usage:
 *   npm run ingest-bari               # reads bari_docs/ directory
 *   BARI_DOCS_DIR=/path npm run ingest-bari
 *   npx ts-node src/scripts/ingestBariDocs.ts
 *
 * See README_INGEST.md for full instructions.
 * ═══════════════════════════════════════════════════════════════
 */

import path from 'path';
import fs from 'fs';

// ── Load .env before importing anything else ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

// ── Configuration ─────────────────────────────────────────────────────────────

const DOCS_DIR = process.env.BARI_DOCS_DIR
  ?? path.resolve(__dirname, '../../..', 'bari_docs');

const CHUNK_SIZE = parseInt(process.env.INGEST_CHUNK_SIZE ?? '800', 10);    // chars
const CHUNK_OVERLAP = parseInt(process.env.INGEST_OVERLAP ?? '150', 10);   // chars
const BATCH_SIZE = 20; // Supabase upsert batch size

interface ChunkRecord {
  id: string;
  file_name: string;
  category: string;
  content: string;
  chunk_index: number;
  total_chunks: number;
  ingested_at: string;
}

// ── PDF Text Extraction (optional — requires pdf-parse) ────────────────────────

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Dynamic require so the script works even without pdf-parse installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text ?? '';
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(
        `[Ingest] pdf-parse not installed. Run: npm install pdf-parse\n` +
        `         Skipping PDF file: ${filePath}`
      );
    } else {
      console.error(`[Ingest] PDF parse error for ${filePath}:`, err.message);
    }
    return '';
  }
}

// ── Plain-text Extraction ─────────────────────────────────────────────────────

function extractTextFromPlain(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    console.error(`[Ingest] Could not read ${filePath}:`, err.message);
    return '';
  }
}

// ── Text → Overlapping Chunks ─────────────────────────────────────────────────

function splitIntoChunks(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) { // skip near-empty chunks
      chunks.push(chunk);
    }
    start += size - overlap;
  }

  return chunks;
}

// ── Derive category from filename ─────────────────────────────────────────────

function categoryFromFilename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('ph'))        return 'pH Standards';
  if (lower.includes('ec') || lower.includes('conductivity')) return 'Electrical Conductivity';
  if (lower.includes('temp') || lower.includes('ferment')) return 'Fermentation Temperature';
  if (lower.includes('em1') || lower.includes('em-1'))        return 'EM-1 Microbial Inoculant';
  if (lower.includes('days') || lower.includes('curing'))     return 'Stabilization Curing Days';
  if (lower.includes('tomato'))    return 'Tomato Cultivation';
  if (lower.includes('esg') || lower.includes('sustain'))     return 'ESG Sustainability';
  if (lower.includes('climate') || lower.includes('uhi'))     return 'Climate & UHI';
  return 'General Compliance';
}

// ── Main Ingestion Pipeline ───────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ClimaLogix AI — BARI Compliance Document Ingestion     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!isSupabaseConfigured()) {
    console.error('❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
    console.error('    Set them in backend/.env or root .env and retry.');
    process.exit(1);
  }

  if (!fs.existsSync(DOCS_DIR)) {
    console.warn(`⚠️  docs directory not found: ${DOCS_DIR}`);
    console.warn('    Create the directory and add .pdf or .txt BARI documents.\n');
    console.log('📋  Seeding built-in BARI knowledge chunks instead...');
    await seedBuiltinChunks();
    return;
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.pdf' || ext === '.txt' || ext === '.md';
  });

  if (files.length === 0) {
    console.warn(`⚠️  No .pdf / .txt / .md files found in ${DOCS_DIR}`);
    console.log('📋  Seeding built-in BARI knowledge chunks instead...');
    await seedBuiltinChunks();
    return;
  }

  console.log(`📁  Found ${files.length} document(s) in ${DOCS_DIR}\n`);

  const supabase = getSupabaseClient();
  let totalChunks = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const ext = path.extname(file).toLowerCase();

    let rawText = '';
    if (ext === '.pdf') {
      rawText = await extractTextFromPDF(filePath);
    } else {
      rawText = extractTextFromPlain(filePath);
    }

    if (!rawText.trim()) {
      console.warn(`   ⚠️  ${file}: empty or unreadable, skipping.`);
      continue;
    }

    const chunks = splitIntoChunks(rawText, CHUNK_SIZE, CHUNK_OVERLAP);
    const category = categoryFromFilename(file);
    const ingested_at = new Date().toISOString();

    console.log(`   📄  ${file} → ${chunks.length} chunk(s) [${category}]`);

    // Batch upsert
    const records: ChunkRecord[] = chunks.map((chunk, idx) => ({
      id: `${file.replace(/\W/g, '_')}_chunk_${idx}`,
      file_name: file,
      category,
      content: chunk,
      chunk_index: idx,
      total_chunks: chunks.length,
      ingested_at,
    }));

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('bari_knowledge_chunks')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`      ❌  Batch ${i}-${i + BATCH_SIZE}: ${error.message}`);
        totalErrors += batch.length;
      } else {
        totalChunks += batch.length;
      }
    }
  }

  console.log(`\n✅  Ingestion complete.`);
  console.log(`    Chunks inserted/updated : ${totalChunks}`);
  console.log(`    Errors                  : ${totalErrors}`);
}

// ── Seed Built-in BARI Chunks ─────────────────────────────────────────────────

/**
 * Inserts the hardcoded BARI_KNOWLEDGE_CHUNKS from rag.service.ts into the DB.
 * Used when no document directory is configured.
 */
async function seedBuiltinChunks() {
  const BUILTIN_CHUNKS = [
    {
      id: 'builtin-ph-standards',
      file_name: 'builtin',
      category: 'pH Standards',
      content:
        'BARI pH Standards for Organic Compost (BARI-OC-2024): The optimal pH range for certified organic compost and bio-slurry is 6.5 to 7.5. pH below 6.5 indicates excessive acidity which inhibits microbial activity and reduces nutrient availability. pH above 7.5 leads to ammonia volatilisation and reduced phosphorus solubility.',
      chunk_index: 0,
      total_chunks: 1,
      ingested_at: new Date().toISOString(),
    },
    {
      id: 'builtin-ec-standards',
      file_name: 'builtin',
      category: 'Electrical Conductivity',
      content:
        'BARI Electrical Conductivity (EC) Limits for Organic Bio-fertilizer (BARI-EC-2024): The maximum safe EC value for finished organic compost is 4.0 dS/m. Optimal salinity range is between 1.5 and 3.0 dS/m. EC above 4.0 dS/m indicates high soluble salt concentration which causes osmotic stress and inhibits seed germination.',
      chunk_index: 0,
      total_chunks: 1,
      ingested_at: new Date().toISOString(),
    },
    {
      id: 'builtin-temp-standards',
      file_name: 'builtin',
      category: 'Fermentation Temperature',
      content:
        'BARI Fermentation Temperature Guidelines (BARI-T-2024): The aerobic decomposition phase must maintain 55°C to 65°C for at least 7 to 10 consecutive days to destroy weed seeds, plant pathogens (Fusarium oxysporum), and enteric viruses (Salmonella, E. coli). Temperatures exceeding 70°C kill beneficial actinomycetes.',
      chunk_index: 0,
      total_chunks: 1,
      ingested_at: new Date().toISOString(),
    },
    {
      id: 'builtin-em1-ratio',
      file_name: 'builtin',
      category: 'EM-1 Microbial Inoculant',
      content:
        'BARI EM-1 Microbial Inoculant Application Standard (BARI-EM-2024): EM-1 must be applied at a ratio of 1:1:20 (1L EM-1 : 1L Molasses : 20L non-chlorinated water). Activate by fermenting in a sealed anaerobic container for 5 to 7 days until pH drops below 3.7.',
      chunk_index: 0,
      total_chunks: 1,
      ingested_at: new Date().toISOString(),
    },
    {
      id: 'builtin-fermentation-days',
      file_name: 'builtin',
      category: 'Stabilization Curing Days',
      content:
        'BARI Compost Stabilization and Curing Duration Guidelines (BARI-D-2024): Certified organic compost must undergo a minimum 45 to 60 days of stabilization. This includes 15-20 days of active thermophilic fermentation followed by 30-40 days of mesophilic curing.',
      chunk_index: 0,
      total_chunks: 1,
      ingested_at: new Date().toISOString(),
    },
  ];

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('bari_knowledge_chunks')
    .upsert(BUILTIN_CHUNKS, { onConflict: 'id' });

  if (error) {
    console.error('❌  Built-in seed failed:', error.message);
  } else {
    console.log(`✅  ${BUILTIN_CHUNKS.length} built-in BARI chunks seeded successfully.`);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌  Unhandled error:', err.message ?? err);
  process.exit(1);
});
