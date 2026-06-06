/**
 * CLIMALOGIX AI — ORDER DISPATCH & RECEIPT ROUTES
 * File: src/api/routes/order.route.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { globalRateLimiter } from '../../lib/middleware/rateLimiter';
import { isSupabaseConfigured, getSupabaseClient } from '../../lib/supabase';
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
import { getRedxTracking } from '../../adapters/carriers/redx.adapter';
import { getPathaoTracking } from '../../adapters/carriers/pathao.adapter';

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

// ── Task 4: Order Tracking ────────────────────────────────────────────────────

const TrackingQuerySchema = z.object({
  carrier: z.enum(['redx', 'pathao', 'internal']).default('internal'),
  trackingId: z.string().min(1).max(200).optional(),
});

/**
 * GET /api/orders/:id/tracking?carrier=redx|pathao|internal&trackingId=xxx
 * Returns carrier tracking events for the order.
 */
router.get(
  '/:id/tracking',
  globalRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || id.length > 100) {
        res.status(400).json({ success: false, error: 'Invalid order ID' });
        return;
      }

      const queryParsed = TrackingQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        res.status(400).json({ success: false, error: 'Invalid query parameters', details: queryParsed.error.issues });
        return;
      }

      const { carrier, trackingId } = queryParsed.data;
      const resolvedTrackingId = trackingId ?? id;

      let trackingData;
      if (carrier === 'redx') {
        trackingData = await getRedxTracking(resolvedTrackingId);
      } else if (carrier === 'pathao') {
        trackingData = await getPathaoTracking(resolvedTrackingId);
      } else {
        // Internal tracking: read from order_tracking_events table
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseClient();
          const { data: events, error } = await supabase
            .from('order_tracking_events')
            .select('*')
            .eq('order_id', id)
            .order('event_time', { ascending: false })
            .limit(20);

          if (!error && events) {
            res.json({
              success: true,
              data: {
                trackingId: id,
                carrier: 'internal',
                currentStatus: events[0]?.status ?? 'Pending',
                estimatedDelivery: null,
                events: events.map((e: any) => ({
                  timestamp: e.event_time,
                  status: e.status,
                  location: e.location ?? 'Dhaka',
                  description: e.description ?? '',
                })),
                source: 'live',
              },
            });
            return;
          }
        }

        // Demo fallback for internal
        trackingData = {
          trackingId: id,
          carrier: 'internal',
          currentStatus: 'Processing',
          estimatedDelivery: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          events: [
            {
              timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              status: 'Order Placed',
              location: 'ClimaLogix Platform',
              description: 'Order confirmed and being prepared.',
            },
          ],
          source: 'demo',
        };
      }

      res.json({ success: true, data: trackingData });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/orders/:id/transition
 * Manually insert a tracking event into the order_tracking_events table.
 * Body: { status, location?, description?, carrier? }
 */
const TransitionBodySchema = z.object({
  status: z.string().min(1).max(100),
  location: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  carrier: z.string().max(50).optional(),
}).strict();

router.post(
  '/:id/transition',
  globalRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || id.length > 100) {
        res.status(400).json({ success: false, error: 'Invalid order ID' });
        return;
      }

      const bodyParsed = TransitionBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: bodyParsed.error.issues });
        return;
      }

      const { status, location, description, carrier } = bodyParsed.data;

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('order_tracking_events')
          .insert({
            order_id: id,
            status,
            location: location ?? 'Dhaka',
            description: description ?? '',
            carrier: carrier ?? 'internal',
            event_time: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) {
          res.status(500).json({ success: false, error: error.message });
          return;
        }

        res.status(201).json({ success: true, data });
        return;
      }

      // Demo fallback
      res.status(201).json({
        success: true,
        data: {
          id: `trk-${Date.now()}`,
          order_id: id,
          status,
          location: location ?? 'Dhaka',
          description: description ?? '',
          carrier: carrier ?? 'internal',
          event_time: new Date().toISOString(),
          source: 'demo',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
