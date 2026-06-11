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
  batch_number: 'BCH-LIFE-001',
  product_name: 'Investor Demo Organic Compost',
  category: 'organic',
  product_type: 'organic',
  weight_kg: 120,
  pH: 7,
  ec: 2.4,
  temperature: 30,
  em1Ratio: 0.001,
  fermentation_days: 21,
};

test('batch verification lifecycle happy path and guards', async () => {
  resetBatchVerificationMemoryForTests();

  const created = await request('POST', '/api/batches', validBatch);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'awaiting_shipment');
  assert.equal(created.body.evaluation.passed, true);
  assert.equal(getBatchVerificationMemoryForTests().verificationRequests.length, 1);

  const invalid = await request('POST', '/api/batches', {
    ...validBatch,
    batch_number: 'BCH-LIFE-BAD',
    pH: 3,
    ec: 8,
    fermentation_days: 1,
  });
  assert.equal(invalid.status, 201);
  assert.equal(invalid.body.data.status, 'evaluation_failed');
  assert.equal(invalid.body.evaluation.passed, false);
  assert.equal(getBatchVerificationMemoryForTests().verificationRequests.length, 1);

  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;

  const shipped = await request('POST', `/api/batches/${batchId}/ship`);
  assert.equal(shipped.status, 200);
  assert.equal(shipped.body.data.batch.status, 'shipped');
  assert.ok(shipped.body.data.shipmentToken);

  const received = await request('POST', `/api/verification-requests/${requestId}/received`);
  assert.equal(received.status, 200);
  assert.equal(received.body.data.batch.status, 'under_review');

  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'approved',
    checklist: {
      physical_condition: true,
      packaging_integrity: true,
      labeling_compliance: true,
      ingredient_match: true,
      certification_authenticity: true,
    },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.batch.status, 'approved');
  assert.equal(approved.body.data.batch.is_locked, true);
  assert.ok(approved.body.data.batch.qr_image_data.startsWith('data:image/png;base64,'));
  assert.ok(approved.body.data.batch.certificate_number);
  assert.ok(approved.body.data.batch.qr_expiry_date);

  const edit = await request('PUT', `/api/batches/${batchId}`, { product_name: 'Tampered Product' });
  assert.equal(edit.status, 403);

  const qr = await request('GET', `/api/qr/${batchId}`);
  assert.equal(qr.status, 200);
  assert.ok(qr.body.data.verificationUrl.includes('/api/verify/'));

  const goodVerify = await request('GET', `/api/verify/${batchId}?hash=${approved.body.data.batch.current_provenance_hash}`);
  assert.equal(goodVerify.status, 200);
  assert.equal(goodVerify.body.data.certificateStatus, 'Valid');

  const tamperedVerify = await request('GET', `/api/verify/${batchId}?hash=bad-hash`);
  assert.equal(tamperedVerify.status, 200);
  assert.equal(tamperedVerify.body.data.certificateStatus, 'Tamper Warning');

  const pdf = await request('GET', `/api/verify/${batchId}/certificate.pdf?hash=${approved.body.data.batch.current_provenance_hash}`);
  assert.equal(pdf.status, 200);
  assert.match(String(pdf.headers['content-type']), /application\/pdf/);
  assert.equal(pdf.raw.subarray(0, 4).toString(), '%PDF');
});

test('inspector rejection requires reasons and blocks QR', async () => {
  resetBatchVerificationMemoryForTests();

  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-LIFE-REJECT' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;

  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);

  const missingReasons = await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'rejected',
    notes: 'No categories selected',
  });
  assert.equal(missingReasons.status, 400);

  const rejected = await request('POST', `/api/verification-requests/${requestId}/verdict`, {
    verdict: 'rejected',
    reasons: ['Packaging Failure'],
    notes: 'Seal was broken',
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.batch.status, 'rejected');

  const qr = await request('GET', `/api/qr/${batchId}`);
  assert.equal(qr.status, 400);
});

test('expired and revoked public states are reported distinctly', async () => {
  resetBatchVerificationMemoryForTests();

  const created = await request('POST', '/api/batches', { ...validBatch, batch_number: 'BCH-LIFE-STATE' });
  const batchId = created.body.data.id;
  const requestId = getBatchVerificationMemoryForTests().verificationRequests[0].id;
  await request('POST', `/api/batches/${batchId}/ship`);
  await request('POST', `/api/verification-requests/${requestId}/received`);
  const approved = await request('POST', `/api/verification-requests/${requestId}/verdict`, { verdict: 'approved' });
  const hash = approved.body.data.batch.current_provenance_hash;

  const batch = getBatchVerificationMemoryForTests().batches[0];
  batch.qr_expiry_date = new Date(Date.now() - 86400000).toISOString();
  const expired = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(expired.body.data.certificateStatus, 'Expired Certification');

  batch.status = 'revoked';
  batch.revoked_at = new Date().toISOString();
  batch.revocation_reason = 'Demo revocation';
  const revoked = await request('GET', `/api/verify/${batchId}?hash=${hash}`);
  assert.equal(revoked.body.data.certificateStatus, 'Revoked');
});
