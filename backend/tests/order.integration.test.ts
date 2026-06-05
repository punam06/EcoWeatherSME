/**
 * Order flow integration tests (in-memory store + HTTP routes).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import {
  OrderIdParamsSchema,
  OrderApiSuccessResponseSchema,
  OrderApiErrorResponseSchema,
} from '../src/api/schemas/order.schema';
import {
  buildOrderError,
  mapOrderStatusResult,
  mapZodError,
  OrderErrorCode,
} from '../src/lib/utils/orderApiErrors';
import {
  enableMemoryOrderStoreForTests,
  resetMemoryOrderStoreForTests,
  seedMemoryOrder,
  dispatchOrder,
  completeOrderReceipt,
  initiateOrder,
  confirmOrder,
} from '../src/lib/services/orderExecution.service';
import { createSession } from '../src/lib/services/chatSession.service';

test('OrderIdParamsSchema rejects invalid uuid', () => {
  const parsed = OrderIdParamsSchema.safeParse({ id: 'not-a-uuid' });
  assert.equal(parsed.success, false);
});

test('mapZodError returns VALIDATION_FAILED code', () => {
  const err = new ZodError([
    { code: 'custom', path: ['id'], message: 'Invalid order id' },
  ]);
  const body = mapZodError(err);
  assert.equal(body.success, false);
  assert.equal(body.code, OrderErrorCode.VALIDATION_FAILED);
});

test('order lifecycle happy path (memory store)', async () => {
  enableMemoryOrderStoreForTests();
  resetMemoryOrderStoreForTests();

  const orderId = randomUUID();
  seedMemoryOrder({
    id: orderId,
    buyer_id: 'demo-farmer-id',
    product_id: 'prod-compost',
    quantity: 2,
    totalBdt: 480,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  const dispatchResult = await dispatchOrder(orderId);
  assert.equal(dispatchResult.success, true);
  assert.equal(dispatchResult.order?.status, 'processing');

  const receiptResult = await completeOrderReceipt(orderId);
  assert.equal(receiptResult.success, true);
  assert.equal(receiptResult.order?.status, 'completed');
});

test('dispatch fails when order is not pending', async () => {
  enableMemoryOrderStoreForTests();
  resetMemoryOrderStoreForTests();

  const orderId = randomUUID();
  seedMemoryOrder({
    id: orderId,
    buyer_id: 'demo-farmer-id',
    product_id: 'prod-compost',
    quantity: 1,
    totalBdt: 240,
    status: 'processing',
    created_at: new Date().toISOString(),
  });

  const result = await dispatchOrder(orderId);
  assert.equal(result.success, false);
  const mapped = mapOrderStatusResult(result);
  assert.equal(mapped.status, 409);
  assert.equal(mapped.body.success, false);
  if (!mapped.body.success) {
    assert.equal(mapped.body.code, OrderErrorCode.INVALID_STATUS_TRANSITION);
  }
});

test('receipt fails when order not found', async () => {
  enableMemoryOrderStoreForTests();
  resetMemoryOrderStoreForTests();

  const result = await completeOrderReceipt(randomUUID());
  assert.equal(result.success, false);
  const mapped = mapOrderStatusResult(result);
  assert.equal(mapped.status, 404);
});

test('confirmOrder creates order in memory store', async () => {
  enableMemoryOrderStoreForTests();
  resetMemoryOrderStoreForTests();

  const session = createSession('demo-farmer-id');
  initiateOrder(
    session.sessionId,
    {
      id: 'prod-fertilizer',
      name: 'Eco-Friendly Fertilizer',
      price_bdt: 180,
      quantity: 100,
      trust_score: 86,
      dvs: 80,
    },
    3,
    'demo-farmer-id'
  );

  const placed = await confirmOrder(session.sessionId, 'demo-farmer-id');
  assert.equal(placed.success, true);
  assert.ok(placed.orderId);

  const dispatchResult = await dispatchOrder(placed.orderId!);
  assert.equal(dispatchResult.success, true);
});

test('HTTP POST /api/orders/:id/dispatch and /receipt', async () => {
  enableMemoryOrderStoreForTests();
  resetMemoryOrderStoreForTests();

  const orderId = randomUUID();
  seedMemoryOrder({
    id: orderId,
    buyer_id: 'demo-farmer-id',
    product_id: 'prod-biochar',
    quantity: 1,
    totalBdt: 150,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const app = require('../src/app').default;

  const dispatchRes = await httpRequest(app, 'POST', `/api/orders/${orderId}/dispatch`, {});
  assert.equal(dispatchRes.status, 200);
  OrderApiSuccessResponseSchema.parse(dispatchRes.body);
  assert.equal(dispatchRes.body.data.order.status, 'processing');

  const receiptRes = await httpRequest(app, 'POST', `/api/orders/${orderId}/receipt`, {});
  assert.equal(receiptRes.status, 200);
  OrderApiSuccessResponseSchema.parse(receiptRes.body);
  assert.equal(receiptRes.body.data.order.status, 'completed');
});

test('HTTP dispatch returns 400 for invalid order id', async () => {
  enableMemoryOrderStoreForTests();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const app = require('../src/app').default;

  const res = await httpRequest(app, 'POST', '/api/orders/bad-id/dispatch', {});
  assert.equal(res.status, 400);
  OrderApiErrorResponseSchema.parse(res.body);
  assert.equal(res.body.code, OrderErrorCode.VALIDATION_FAILED);
});

test('mapDatabaseNotConfigured error shape', () => {
  const err = buildOrderError(OrderErrorCode.DATABASE_NOT_CONFIGURED, 'Database not configured');
  OrderApiErrorResponseSchema.parse(err);
  assert.equal(err.code, OrderErrorCode.DATABASE_NOT_CONFIGURED);
});

function httpRequest(
  app: import('express').Application,
  method: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const payload = JSON.stringify(body);
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
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 500,
                body: data ? JSON.parse(data) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', (e) => {
        server.close();
        reject(e);
      });
      req.write(payload);
      req.end();
    });
  });
}
