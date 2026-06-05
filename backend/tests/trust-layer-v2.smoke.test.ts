/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — TRUST LAYER v2 SMOKE TEST
 * File: scripts/smoke-trust-layer-v2.ts
 *
 * Runs the Express app in-process on an ephemeral port and
 * exercises the 3 new Trust Layer v2 endpoints plus the
 * category-aware trust score route:
 *
 *   GET  /api/qa/categories
 *   POST /api/qa/submit     (organic iot)  → 422 expected (no DB)
 *   GET  /api/qa/categories again
 *   POST /api/batch/trust-score
 *   GET  /api/verify/:batch_id
 *   GET  /api/esg/report?months=3
 *
 * Asserts demo-fallback behavior so the test is hermetic —
 * it does NOT require a Supabase instance.
 *
 * Run with:  npm run test:smoke
 * ═══════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../src/app';

const PORT = 0; // ephemeral — let the OS pick a free port
const HOST = '127.0.0.1';

// Force the offline path: no real Supabase env.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GROQ_API_KEY; // not needed for these routes

const server = http.createServer(app);

function listen(): Promise<{ port: number; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => {
      const addr = server.address() as AddressInfo;
      resolve({ port: addr.port, baseUrl: `http://${HOST}:${addr.port}` });
    });
  });
}

function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let json: any;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { _raw: text };
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('Trust Layer v2 smoke', async (t) => {
  const { baseUrl } = await listen();
  t.after(() => new Promise<void>((r) => server.close(() => r())));

  await t.test('GET /api/qa/categories returns 5 categories', async () => {
    const res = await request(baseUrl, 'GET', '/api/qa/categories');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(Array.isArray(res.json.data));
    assert.equal(res.json.data.length, 5);

    const names = res.json.data.map((c: any) => c.category);
    assert.deepEqual(
      [...names].sort(),
      ['dairy', 'manufacturing', 'organic', 'pharma', 'retail'],
    );

    // Pharma must declare requiresBSTI = true
    const pharma = res.json.data.find((c: any) => c.category === 'pharma');
    assert.equal(pharma.requiresBSTI, true);
  });

  await t.test('POST /api/qa/submit fails gracefully without Supabase', async () => {
    const res = await request(baseUrl, 'POST', '/api/qa/submit', {
      batch_id: 'TEST-001',
      source: 'iot',
      category: 'organic',
      metrics: { pH: 6.5, ec: 3.5, temp: 28, em1Ratio: 0.002, fermentationDays: 10 },
    });
    // The service refuses persistence when supabase is not configured,
    // returning 422 with a clear error.
    assert.equal(res.status, 422);
    assert.match(res.json.error ?? '', /Supabase is not configured/);
  });

  await t.test('POST /api/qa/submit validates BSTI requirement (pharma)', async () => {
    // Even without persistence, the service-layer validation should
    // produce a 422 because the pure validator runs first.
    const res = await request(baseUrl, 'POST', '/api/qa/submit', {
      batch_id: 'TEST-002',
      source: 'iot',
      category: 'pharma',
      metrics: { pH: 6.0, ec: 2.0, temp: 5, em1Ratio: 0, fermentationDays: 0 },
    });
    assert.equal(res.status, 422);
    assert.match(res.json.error ?? '', /requires a BSTI credential/);
  });

  await t.test('POST /api/qa/submit rejects malformed BSTI', async () => {
    const res = await request(baseUrl, 'POST', '/api/qa/submit', {
      batch_id: 'TEST-003',
      source: 'iot',
      category: 'pharma',
      bstiCredential: 'NOT-A-BSTI-CODE',
      metrics: { pH: 6.0, ec: 2.0, temp: 5, em1Ratio: 0, fermentationDays: 0 },
    });
    assert.equal(res.status, 422);
    assert.match(res.json.error ?? '', /Invalid BSTI credential format/);
  });

  await t.test('POST /api/qa/submit rejects iot reports with inspectorNotes', async () => {
    const res = await request(baseUrl, 'POST', '/api/qa/submit', {
      batch_id: 'TEST-004',
      source: 'iot',
      category: 'retail',
      inspectorNotes: 'should not be allowed for iot',
      metrics: { pH: 7, ec: 1, temp: 22, em1Ratio: 0, fermentationDays: 0 },
    });
    assert.equal(res.status, 422);
    assert.match(res.json.error ?? '', /iot reports cannot include inspector notes/);
  });

  await t.test('POST /api/qa/submit rejects out-of-range pH', async () => {
    const res = await request(baseUrl, 'POST', '/api/qa/submit', {
      batch_id: 'TEST-005',
      source: 'iot',
      category: 'retail',
      metrics: { pH: 99, ec: 1, temp: 22, em1Ratio: 0, fermentationDays: 0 },
    });
    assert.equal(res.status, 422);
    assert.match(res.json.error ?? '', /pH out of physical range/);
  });

  await t.test('POST /api/batch/trust-score returns A-grade for ideal organic', async () => {
    const res = await request(baseUrl, 'POST', '/api/batch/trust-score', {
      pH: 6.0,
      ec: 3.5,
      temperatureCelsius: 28,
      em1Ratio: 0.002,
      fermentationDays: 10,
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.data.score >= 80, `expected A-grade, got ${res.json.data.score}`);
    assert.equal(res.json.data.grade, 'A');
    assert.equal(res.json.data.isViable, true);
    assert.equal(res.json.data.category, 'organic');
  });

  await t.test('POST /api/batch/trust-score gives a lower score for poor readings', async () => {
    const res = await request(baseUrl, 'POST', '/api/batch/trust-score', {
      pH: 9.0,
      ec: 8.0,
      temperatureCelsius: 18,
      em1Ratio: 0.01,
      fermentationDays: 1,
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.data.score < 80, `expected lower grade, got ${res.json.data.score}`);
  });

  await t.test('GET /api/verify/:batch_id falls back to demoChain', async () => {
    const res = await request(baseUrl, 'GET', '/api/verify/DEMO-BATCH-001');
    assert.equal(res.status, 200);
    assert.equal(res.json.source, 'demo');
    assert.ok(Array.isArray(res.json.data.events));
    assert.equal(res.json.data.events.length, 3);
    assert.equal(res.json.data.events[0].type, 'genesis');
    assert.equal(res.json.data.events[1].type, 'dispatched');
    assert.equal(res.json.data.events[2].type, 'delivered');
    assert.equal(res.json.data.verified, true);
    // Head hash should be a 64-char hex
    assert.match(res.json.data.head_hash, /^[a-f0-9]{64}$/);
  });

  await t.test('GET /api/esg/report?months=3 returns 3-month demo aggregate', async () => {
    const res = await request(baseUrl, 'GET', '/api/esg/report?months=3');
    assert.equal(res.status, 200);
    assert.equal(res.json.source, 'demo');
    assert.equal(res.json.data.length, 3);
    // Each row should have the expected fields
    for (const row of res.json.data) {
      for (const k of [
        'e_score', 's_score', 'g_score', 'esg_score',
        'trust_score', 'dvs_score', 'plastic_offset_kg',
        'carbon_sequestered_kg', 'water_saved_l',
        'waste_reduced_kg', 'spoilage_prevented_bdt',
      ]) {
        assert.ok(typeof row[k] === 'number', `row missing ${k}`);
      }
      assert.ok(!('_n' in row), 'private _n counter must be stripped from response');
    }
  });

  await t.test('GET /api/esg/report clamps months to 1..24', async () => {
    const r1 = await request(baseUrl, 'GET', '/api/esg/report?months=999');
    assert.equal(r1.json.data.length, 24);

    const r2 = await request(baseUrl, 'GET', '/api/esg/report?months=0');
    assert.equal(r2.json.data.length, 1);

    const r3 = await request(baseUrl, 'GET', '/api/esg/report');
    assert.equal(r3.json.data.length, 1);
  });
});
