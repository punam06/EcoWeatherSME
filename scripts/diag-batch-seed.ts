/**
 * Diagnostic: query live Supabase to find out why Batch Verification
 * shows no data for the SME Owner user, even though 006_*.sql was run.
 *
 * Prints:
 *   - whether the users table has any sme_owner rows
 *   - the actual id/email of the sme_owner user
 *   - whether the batches table has sme_owner_id populated
 *   - whether the batches RLS policy would let the sme_owner see them
 *   - the exact listBatches() filter result for the sme_owner JWT
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('━'.repeat(70));
  console.log('1. List all users with role = sme_owner');
  console.log('━'.repeat(70));
  const { data: smeUsers, error: smeErr } = await supabase
    .from('users')
    .select('id, email, name, role, created_at')
    .eq('role', 'sme_owner')
    .order('created_at', { ascending: false });
  if (smeErr) {
    console.error('users query failed:', smeErr);
  } else {
    console.log(`Found ${smeUsers?.length ?? 0} sme_owner user(s):`);
    for (const u of smeUsers ?? []) {
      console.log(`  - id=${u.id}  email=${u.email}  name=${u.name}  created=${u.created_at}`);
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('2. List the 5 demo batches and their ownership columns');
  console.log('━'.repeat(70));
  const { data: batches, error: batErr } = await supabase
    .from('batches')
    .select('id, batch_number, manufacturer_id, processor_id, producer_id, sme_owner_id, status, trust_score, qr_code_url')
    .in('batch_number', [
      'BATCH-DEMO-001',
      'BATCH-DEMO-002',
      'BATCH-DEMO-003',
      'BATCH-DEMO-004',
      'BATCH-DEMO-005',
    ])
    .order('batch_number');
  if (batErr) {
    console.error('batches query failed:', batErr);
  } else {
    console.log(`Found ${batches?.length ?? 0} demo batch(es):`);
    for (const b of batches ?? []) {
      console.log(`  - ${b.batch_number}`);
      console.log(`      manufacturer_id: ${b.manufacturer_id ?? '∅'}`);
      console.log(`      processor_id:    ${b.processor_id ?? '∅'}`);
      console.log(`      producer_id:     ${b.producer_id ?? '∅'}`);
      console.log(`      sme_owner_id:    ${b.sme_owner_id ?? '∅'}`);
      console.log(`      status: ${b.status}  trust: ${b.trust_score}`);
      console.log(`      qr: ${b.qr_code_url ?? '∅'}`);
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('3. Does the batches table have the sme_owner_id column?');
  console.log('━'.repeat(70));
  const { data: cols, error: colErr } = await supabase
    .rpc('get_table_columns' as any, { p_table: 'batches' } as any)
    .select('*')
    .limit(0)
    .maybeSingle();
  if (colErr) {
    // Try an alternate probe — query information_schema via raw SQL (PostgREST exposes it on Supabase).
    const { data: infoRows, error: infoErr } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'batches');
    if (infoErr) {
      console.error('Column probe via information_schema failed:', infoErr.message);
    } else {
      const names = (infoRows as any[] | null)?.map(r => r.column_name) ?? [];
      console.log(`  batches has ${names.length} columns`);
      console.log(`  has sme_owner_id: ${names.includes('sme_owner_id')}`);
      console.log(`  has processor_id: ${names.includes('processor_id')}`);
      console.log(`  has manufacturer_id: ${names.includes('manufacturer_id')}`);
    }
  } else {
    console.log('  RPC probe worked:', cols);
  }

  if (smeUsers && smeUsers.length > 0 && batches && batches.length > 0) {
    const target = smeUsers[0];
    const matches = batches.filter(b => b.sme_owner_id === target.id);
    console.log('\n' + '━'.repeat(70));
    console.log(`4. Cross-check: how many demo batches have sme_owner_id = ${target.id}?`);
    console.log('━'.repeat(70));
    console.log(`  Match: ${matches.length} of ${batches.length}`);
    if (matches.length === 0) {
      console.log('  ⚠️  The seed did NOT actually set sme_owner_id to this user.');
      console.log('  The id mismatch is the most likely cause of the empty list.');
    }

    console.log('\n' + '━'.repeat(70));
    console.log(`5. Simulate listBatches() OR filter for this sme_owner user`);
    console.log('━'.repeat(70));
    const or = [
      `manufacturer_id.eq.${target.id}`,
      `processor_id.eq.${target.id}`,
      `producer_id.eq.${target.id}`,
      `sme_owner_id.eq.${target.id}`,
    ].join(',');
    const { data: simRows, error: simErr } = await supabase
      .from('batches')
      .select('batch_number, sme_owner_id, processor_id, manufacturer_id, producer_id')
      .or(or)
      .limit(10);
    if (simErr) {
      console.error('Simulation failed:', simErr);
    } else {
      console.log(`  OR-filter returned ${simRows?.length ?? 0} row(s):`);
      for (const r of simRows ?? []) {
        console.log(`  - ${r.batch_number}  sme_owner=${r.sme_owner_id ?? '∅'}  processor=${r.processor_id ?? '∅'}  manufacturer=${r.manufacturer_id ?? '∅'}  producer=${r.producer_id ?? '∅'}`);
      }
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('6. RLS policies on batches that mention sme_owner or auth.uid');
  console.log('━'.repeat(70));
  const { data: policies, error: polErr } = await supabase
    .from('pg_policies' as any)
    .select('policyname, cmd, qual, with_check')
    .eq('tablename', 'batches');
  if (polErr) {
    console.error('pg_policies probe failed:', polErr.message);
  } else {
    for (const p of (policies as any[]) ?? []) {
      console.log(`  - ${p.policyname} (${p.cmd})`);
      console.log(`      qual: ${p.qual ?? '∅'}`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
