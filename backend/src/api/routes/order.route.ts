/**
 * CLIMALOGIX AI — ORDER DISPATCH & RECEIPT ROUTES
 * File: src/api/routes/order.route.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { globalRateLimiter } from '../../lib/middleware/rateLimiter';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  dispatchOrder,
  completeOrderReceipt,
  isMemoryOrderStoreEnabled,
} from '../../lib/services/orderExecution.service';
import { OrderIdParamsSchema, OrderActionBodySchema } from '../schemas/order.schema';
import {
  mapDatabaseNotConfigured,
  mapOrderStatusResult,
  mapZodError,
  sendOrderError,
  sendOrderSuccess,
} from '../../lib/utils/orderApiErrors';

const router = Router();

function isOrderBackendReady(): boolean {
  return isSupabaseConfigured() || isMemoryOrderStoreEnabled();
}

async function handleOrderTransition(
  req: Request,
  res: Response,
  action: 'dispatch' | 'receipt'
): Promise<void> {
  const paramsParsed = OrderIdParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    sendOrderError(res, 400, mapZodError(paramsParsed.error));
    return;
  }

  const bodyParsed = OrderActionBodySchema.safeParse(req.body ?? {});
  if (!bodyParsed.success) {
    sendOrderError(res, 400, mapZodError(bodyParsed.error));
    return;
  }

  if (!isOrderBackendReady()) {
    const mapped = mapDatabaseNotConfigured();
    sendOrderError(res, mapped.status, mapped.body);
    return;
  }

  const audit = {
    sessionId: bodyParsed.data.sessionId,
    buyerId: bodyParsed.data.buyerId,
    note: bodyParsed.data.note,
  };

  const result =
    action === 'dispatch'
      ? await dispatchOrder(paramsParsed.data.id, audit)
      : await completeOrderReceipt(paramsParsed.data.id, audit);

  const mapped = mapOrderStatusResult(result);
  if (mapped.body.success) {
    sendOrderSuccess(res, mapped.status, mapped.body);
    return;
  }
  sendOrderError(res, mapped.status, mapped.body);
}

/**
 * POST /api/orders/:id/dispatch — pending → processing
 */
router.post(
  '/:id/dispatch',
  globalRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handleOrderTransition(req, res, 'dispatch');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/receipt — processing → completed
 */
router.post(
  '/:id/receipt',
  globalRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handleOrderTransition(req, res, 'receipt');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
