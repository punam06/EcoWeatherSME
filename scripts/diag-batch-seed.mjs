// Self-contained diagnostic — no tsx, no dotenv, no external imports.
// Usage:  node scripts/diag-batch-seed.mjs
//
// Reads creds from backend/.env, queries live Supabase with REST API
// (service-role key, bypasses RLS), and writes the full result to
// scripts/_diag.out in the workspace.
//
// To run from PowerShell:
//   cd d:\user_jabu\hackathon-ev
//   node scripts/diag-batch-seed.mjs
//
// After it finishes, open scripts/_diag.out and read the result.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT  = resolve(__dirname, '_diag.out');

const lines = [];
const log = (...args) => {
  const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
  lines.push(s);
  console.log(s);
};

// 1. Read .env
let SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY;
try {
  const envText = readFileSync(resolve(ROOT, 'backend', '.env'), 'utf8');
  for (const raw of envText.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'SUPABASE_URL') SUPABASE_URL = v;
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') SUPABASE_SERVICE_ROLE_KEY = v;
  }
} catch (e) {
  log('FAILED to read backend/.env:', e.message);
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  log('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

log('SUPABASE_URL =', SUPABASE_URL);

const H_KEYS = {
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function api(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H_KEYS, ...(init.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

(async () => {
  log('━'.repeat(70));
  log('1. List all users with role = sme_owner');
  log('━'.repeat(70));
  const smeRes = await api('users?role=eq.sme_owner&select=id,email,name,role,created_at&order=created_at.desc');
  if (!smeRes.ok) {
    log('users query failed:', smeRes.status, smeRes.body);
  } else {
    const users = smeRes.body;
    log(`Found ${users.length} sme_owner user(s):`);
    for (const u of users) {
      log(`  - id=${u.id}`);
      log(`      email=${u.email}  name=${u.name}  created=${u.created_at}`);
    }
  }

  log('');
  log('━'.repeat(70));
  log('2. List the 5 demo batches with their ownership columns');
  log('━'.repeat(70));
  // Probe columns one at a time to avoid a single 400 blocking the whole
  // picture (e.g. manufacturer_id doesn't exist on this Supabase).
  const probe = async (col) => {
    const r = await api(
      `batches?select=id,batch_number,${col}&batch_number=in.(BATCH-DEMO-001,BATCH-DEMO-002,BATCH-DEMO-003,BATCH-DEMO-004,BATCH-DEMO-005)&order=batch_number`
    );
    return { ok: r.ok, status: r.status, body: r.body };
  };
  const cols = ['processor_id', 'producer_id', 'sme_owner_id', 'manufacturer_id', 'status', 'trust_score', 'qr_code_url'];
  const colData = {};
  for (const c of cols) {
    const r = await probe(c);
    if (r.ok) {
      colData[c] = r.body;
      log(`  ✓ column '${c}' exists (${r.body.length} rows)`);
    } else {
      colData[c] = null;
      log(`  ✗ column '${c}' missing → ${r.status} ${(r.body && r.body.message) || ''}`);
    }
  }
  // Synthesize a unified view
  const byId = new Map();
  for (const c of cols) {
    const rows = colData[c];
    if (!rows) continue;
    for (const r of rows) {
      if (!byId.has(r.id)) byId.set(r.id, { batch_number: r.batch_number });
      byId.get(r.id)[c] = r[c];
    }
  }
  const batches = Array.from(byId.values()).sort((a, b) => (a.batch_number || '').localeCompare(b.batch_number || ''));
  log('');
  log(`  Unified view of ${batches.length} demo batch(es):`);
  for (const b of batches) {
    log(`    - ${b.batch_number}`);
    log(`        manufacturer_id: ${b.manufacturer_id ?? '∅'}`);
    log(`        processor_id:    ${b.processor_id ?? '∅'}`);
    log(`        producer_id:     ${b.producer_id ?? '∅'}`);
    log(`        sme_owner_id:    ${b.sme_owner_id ?? '∅'}`);
    log(`        status: ${b.status}  trust: ${b.trust_score}`);
    log(`        qr: ${b.qr_code_url ?? '∅'}`);
  }
  // Stash a fake "batRes" so the rest of the script can run.
  const batRes = { ok: batches.length > 0, body: batches };

  log('');
  log('━'.repeat(70));
  log('3. Does the batches table actually have these columns?');
  log('━'.repeat(70));
  // Probe one column at a time — if the column doesn't exist, PostgREST
  // returns 400 "column ... does not exist" instead of 404.
  const allCols = [
    'id', 'batch_number', 'processor_id', 'producer_id', 'sme_owner_id',
    'manufacturer_id', 'status', 'trust_score', 'qr_code_url', 'category',
    'created_at',
  ];
  const present = [];
  const missing = [];
  for (const c of allCols) {
    const r = await api(`batches?select=${c}&limit=1`);
    if (r.ok) present.push(c);
    else missing.push(c);
  }
  log(`  Present: ${present.join(', ')}`);
  log(`  Missing: ${missing.join(', ') || '(none)'}`);

  // 4. Cross-check the OR-filter that listBatches will run
  if (smeRes.ok && batRes.ok && smeRes.body.length > 0 && batRes.body.length > 0) {
    const target = smeRes.body[0];
    const matches = batRes.body.filter(b => b.sme_owner_id === target.id);
    log('');
    log('━'.repeat(70));
    log(`4. Cross-check: how many demo batches have sme_owner_id = ${target.id} (${target.email})?`);
    log('━'.repeat(70));
    log(`  Match: ${matches.length} of ${batRes.body.length}`);
    if (matches.length === 0) {
      log('  ⚠️  The seed did NOT actually set sme_owner_id to this user.');
      log('  → The id mismatch is the most likely cause of the empty list.');
    }

    log('');
    log('━'.repeat(70));
    log(`5. Simulate listBatches() OR filter for this sme_owner user`);
    log('━'.repeat(70));
    // Only include ownership columns that actually exist on the table.
    const orParts = [];
    if (present.includes('manufacturer_id')) orParts.push(`manufacturer_id.eq.${target.id}`);
    if (present.includes('processor_id'))    orParts.push(`processor_id.eq.${target.id}`);
    if (present.includes('producer_id'))     orParts.push(`producer_id.eq.${target.id}`);
    if (present.includes('sme_owner_id'))    orParts.push(`sme_owner_id.eq.${target.id}`);
    log(`  OR parts (using only existing columns): ${orParts.join(' | ')}`);
    const selectCols = ['batch_number', ...orParts.map(s => s.split('.')[0])].join(',');
    const orFilter = `or=(${orParts.join(',')})`;
    const simRes = await api(
      `batches?select=${selectCols}&${orFilter}&limit=20`
    );
    if (!simRes.ok) {
      log('  Simulation failed:', simRes.status, simRes.body);
    } else {
      log(`  OR-filter returned ${simRes.body.length} row(s):`);
      for (const r of simRes.body) {
        log(`  - ${r.batch_number}  sme_owner=${r.sme_owner_id ?? '∅'}  processor=${r.processor_id ?? '∅'}  manufacturer=${r.manufacturer_id ?? '∅'}  producer=${r.producer_id ?? '∅'}`);
      }
    }
  } else {
    log('');
    log('(Skipping section 4/5: need at least 1 sme_owner user and 1 demo batch)');
  }

  log('');
  log('━'.repeat(70));
  log('6. RLS policies on batches');
  log('━'.repeat(70));
  const polRes = await api('pg_policies?tablename=eq.batches&select=policyname,cmd,qual');
  if (!polRes.ok) {
    log('  pg_policies probe failed:', polRes.status, polRes.body);
  } else {
    log(`  Found ${polRes.body.length} polic(y/ies) on batches:`);
    for (const p of polRes.body) {
      log(`  - ${p.policyname} (${p.cmd})`);
      log(`      qual: ${p.qual ?? '∅'}`);
    }
  }

  writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  log('');
  log(`[wrote output to ${OUT}]`);
})().catch(e => {
  log('FATAL:', e.message, e.stack);
  writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  process.exit(1);
});
