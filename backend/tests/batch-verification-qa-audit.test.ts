import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://your-project-id.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key-placeholder';

import app from '../src/app';
import {
  getBatchVerificationMemoryForTests,
  resetBatchVerificationMemoryForTests,
} from '../src/lib/services/batchVerification.service';

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders; raw: Buffer }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const payload = body ? JSON.stringify(body) : '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            server.close();
            const raw = Buffer.concat(chunks);
            const text = raw.toString('utf8');
            let parsed: any = {};
            try {
              parsed = text ? JSON.parse(text) : {};
            } catch {
              parsed = { _raw: text };
            }
            resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers, raw });
          });
        },
      );
      req.on('error', (error) => {
        server.close();
        reject(error);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

const validBatch = {
  batch_number: 'BCH-QA-VALID',
  product_name: 'QA Audit Organic Compost',
  category: 'organic',
  product_type: 'organic',
  weight_kg: 120,
  pH: 7,
  ec: 2.4,
  temperature: 30,
  em1Ratio: 0.001,
  fermentation_days: 21,
};

test('Test 1: full valid lifecycle with provenance and certificate artifacts', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', validBatch);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'awaiting_shipment');
  assert.equal(created.body.evaluation.passed, true);
  assert.equal(getBatchVerificationMemoryForTests().verificationRequests.length, 1);

  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;

  const shipped = await request('POST', `/api/batches/${batchId}/ship`);
  assert.equal(shipped.status, 200);
  assert.ok(shipped.body.data.shipmentToken);

  const received = await request('POST', `/api/verification-requests/${requestId}/received`);
  assert.equal(received.status, 200);
  assert.equal(received.body.data.batch.status, 'under_review');

  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'approved',
    checklist: { physical_condition: true, packaging_integrity: true, labeling_compliance: true, ingredient_match: true, certification_authenticity: true },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.batch.status, 'approved');
  assert.equal(approved.body.data.batch.is_locked, true);
  assert.ok(approved.body.data.batch.qr_code_url);
  assert.ok(approved.body.data.batch.certificate_number);
  assert.ok(approved.body.data.batch.current_provenance_hash);

  const hash = approved.body.data.batch.current_provenance_hash;
  const verify = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(verify.body.data.certificateStatus, 'Valid');

  const pdf = await request('GET', `/api/verify/${batchId}/certificate.pdf?hash=${hash}`);
  assert.equal(pdf.status, 200);
  assert.match(String(pdf.headers['content-type']), /application\/pdf/);
});

test('Test 2: invalid batch fails evaluation with reasons and no verification request', async () => {
  resetBatchVerificationMemoryForTests();
  const before = getBatchVerificationMemoryForTests().verificationRequests.length;
  const invalid = await request('POST', '/api/batches', {
    ...validBatch,
    batch_number: 'BCH-QA-BAD',
    pH: 3,
    ec: 8,
    fermentation_days: 1,
  });
  assert.equal(invalid.status, 201);
  assert.equal(invalid.body.data.status, 'evaluation_failed');
  assert.equal(invalid.body.evaluation.passed, false);
  assert.ok(invalid.body.evaluation.summary.failures.length > 0);
  assert.equal(getBatchVerificationMemoryForTests().verificationRequests.length, before);

  const qr = await request('GET', `/api/qr/${invalid.body.data.id}`);
  assert.equal(qr.status, 400);
});

test('Test 3: rejection stores reasons and blocks QR', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-REJ' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);

  const rejected = await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'rejected',
    reasons: ['Packaging Failure'],
    notes: 'Seal broken',
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.batch.status, 'rejected');
  assert.deepEqual(rejected.body.data.batch.verdict_reasons, ['Packaging Failure']);

  const notifs = getBatchVerificationMemoryForTests().notifications;
  const rejectionNotif = notifs.find((n) => n.type === 'batch_rejected');
  assert.ok(rejectionNotif, 'manufacturer rejection notification should exist');
  assert.match(String(rejectionNotif.body), /Packaging Failure/);

  const qr = await request('GET', `/api/qr/${batchId}`);
  assert.equal(qr.status, 400);
});

test('Test 4: locked batch rejects core field edits', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-LOCK' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const originalName = approved.body.data.batch.product_name;

  for (const field of [
    { product_name: 'Tampered' },
    { product_type: 'pharma' },
    { feedstock_type: 'retail' },
    { ingredients: ['fake'] },
    { certification_claims: ['fake cert'] },
    { weight_kg: 999 },
    { packaging_type: 'Broken' },
  ]) {
    const edit = await request('PUT', `/api/batches/${batchId}`, field);
    assert.equal(edit.status, 403, `expected 403 for ${Object.keys(field)[0]}`);
  }

  const batch = getBatchVerificationMemoryForTests().batches.find((b) => b.id === batchId);
  assert.ok(batch);
  assert.equal(batch!.product_name, originalName);
  const verify = await request('GET', `/api/verify/${batchId}?hash=${batch!.current_provenance_hash}`);
  assert.equal(verify.body.data.chain.verified, true);
});

test('Test 5: QR hash tamper detection', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-HASH' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const hash = approved.body.data.batch.current_provenance_hash;

  const good = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(good.body.data.certificateStatus, 'Valid');

  const bad = await request('GET', `/api/verify/${batchId}?hash=deadbeef`);
  assert.equal(bad.body.data.certificateStatus, 'Tamper Warning');
});

test('Test 6 and 7: expired and revoked certificate states', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-EXP' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const hash = approved.body.data.batch.current_provenance_hash;
  const batch = getBatchVerificationMemoryForTests().batches.find((b) => b.id === batchId)!;

  batch.qr_expiry_date = new Date(Date.now() - 86400000).toISOString();
  const expired = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(expired.body.data.certificateStatus, 'Expired Certification');

  batch.status = 'revoked';
  batch.revoked_at = new Date().toISOString();
  batch.revocation_reason = 'QA revocation';
  const revoked = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(revoked.body.data.certificateStatus, 'Revoked');
});

test('Test 8: batch registry pagination and filters', async () => {
  resetBatchVerificationMemoryForTests();
  for (let i = 0; i < 60; i++) {
    await request('POST', '/api/batches', {
      ...validBatch,
      batch_number: `BCH-QA-PAGE-${String(i).padStart(3, '0')}`,
      pH: i % 2 === 0 ? 7 : 3,
      fermentation_days: i % 2 === 0 ? 21 : 1,
    });
  }

  const page1 = await request('GET', '/api/batches?page=1&pageSize=25');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 25);
  assert.equal(page1.body.pagination.pageSize, 25);
  assert.ok(page1.body.pagination.total >= 60);

  const filtered = await request('GET', '/api/batches?status=evaluation_failed&page=1&pageSize=100');
  assert.ok(filtered.body.data.every((b: any) => b.status === 'evaluation_failed'));

  const search = await request('GET', '/api/batches?search=BCH-QA-PAGE-001');
  assert.ok(search.body.data.some((b: any) => b.batch_number === 'BCH-QA-PAGE-001'));
});

test('Test 9: PDF contains required certificate fields (text PDF)', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-PDF' });
  assert.ok(created.body.data?.id, `batch create failed: ${JSON.stringify(created.body)}`);
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const hash = approved.body.data.batch.current_provenance_hash;
  const pdf = await request('GET', `/api/verify/${batchId}/certificate.pdf?hash=${hash}`);
  const text = pdf.raw.toString('utf8');

  const required = [
    'CLIMALOGIX AI DEMO CERTIFICATE',
    approved.body.data.batch.certificate_number,
    approved.body.data.batch.product_name,
    'BCH-QA-PDF',
    'Inspector certification ID',
    'Trust score',
    'Provenance hash',
  ];
  for (const token of required) {
    assert.match(text, new RegExp(String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Test 10: lifecycle notifications are written to batch verification memory', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-NOTIF' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;

  const typesAfterCreate = getBatchVerificationMemoryForTests().notifications.map((n) => n.type);
  assert.ok(typesAfterCreate.includes('evaluation_passed'));
  assert.ok(typesAfterCreate.includes('verification_request'));

  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'rejected',
    reasons: ['Safety Issue'],
    notes: 'Failed QA',
  });

  const failed = await request('POST', '/api/batches', {
    ...validBatch,
    batch_number: 'BCH-QA-NOTIF-FAIL',
    pH: 2,
    fermentation_days: 1,
  });
  assert.equal(failed.body.data.status, 'evaluation_failed');

  const allTypes = getBatchVerificationMemoryForTests().notifications.map((n) => n.type);
  for (const expected of [
    'evaluation_passed',
    'verification_request',
    'product_shipped',
    'product_received',
    'batch_rejected',
    'evaluation_failed',
  ]) {
    assert.ok(allTypes.includes(expected), `missing notification type ${expected}`);
  }
});

test('Security: public verify JSON does not expose emails/passwords/inspector names', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-SEC' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const hash = approved.body.data.batch.current_provenance_hash;
  const verify = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  const serialized = JSON.stringify(verify.body.data).toLowerCase();
  assert.doesNotMatch(serialized, /password|@.*\.com|inspector_name|phone/);
  assert.ok(verify.body.data.inspectorCertificationId);
});

test('Security: invalid status transitions return 400', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-TRANS' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;

  const shipTwice = await request('POST', `/api/batches/${batchId}/ship`);
  assert.equal(shipTwice.status, 200);
  const shipAgain = await request('POST', `/api/batches/${batchId}/ship`);
  assert.equal(shipAgain.status, 400);

  const earlyVerdict = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  assert.equal(earlyVerdict.status, 400);
});

test('Security: public verify endpoint is read-only', async () => {
  resetBatchVerificationMemoryForTests();
  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-QA-RO' });
  const batchId = created.body.data.id;
  const put = await request('PUT', `/api/verify/${batchId}`, { status: 'approved' });
  assert.notEqual(put.status, 200);
});
