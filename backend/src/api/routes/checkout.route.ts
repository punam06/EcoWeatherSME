/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — VOICE CHECKOUT ROUTE
 * File: src/api/routes/checkout.route.ts
 *
 * POST /api/checkout/voice
 * Validates request body, parses checkout intent, rate-limits, and inserts into Supabase.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { parseCheckoutIntent } from '../../lib/services/intentParser.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

// Zod Validation Schema for voice checkout request
const VoiceCheckoutRequestSchema = z.object({
  transcript: z
    .string({ required_error: 'transcript is required' })
    .max(500, 'transcript must be 500 characters or fewer'),
  sessionId: z
    .string({ required_error: 'sessionId is required' })
    .max(100, 'sessionId must be 100 characters or fewer'),
  availableProducts: z
    .array(z.string(), { required_error: 'availableProducts is required' })
    .max(50, 'availableProducts must contain 50 items or fewer'),
}).strict();

// Rate limiting: max 10 requests per minute per IP
const checkoutRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many checkout requests. Please try again after a minute.',
  },
});

/**
 * POST /api/checkout/voice
 *
 * Request Body: { transcript, sessionId, availableProducts }
 */
router.post(
  '/voice',
  checkoutRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Input Validation
      const parsed = VoiceCheckoutRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { transcript, sessionId, availableProducts } = parsed.data;

      // 2. Parse Intent
      const result = parseCheckoutIntent(transcript, availableProducts);

      // 3. Intent checks
      if (!result.isCheckout) {
        res.status(200).json({
          success: false,
          message: 'No checkout intent detected',
          parsed: result,
        });
        return;
      }

      if (result.confidence === 'low') {
        res.status(200).json({
          success: false,
          message: 'Please specify product and quantity',
          parsed: result,
        });
        return;
      }

      // 4. Insert into database
      let orderId = `mock-ord-${uuidv4().slice(-6)}`;

      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('checkout_orders')
          .insert({
            session_id: sessionId,
            product_name: result.productName,
            quantity: result.quantity,
            unit: result.unit,
            transcript: transcript,
            confidence: result.confidence,
            status: 'pending',
          })
          .select('id')
          .single();

        if (error) {
          console.error('[CheckoutAPI] Supabase insert failed:', error.stack ?? error.message);
          res.status(500).json({
            success: false,
            error: 'Failed to process voice order',
          });
          return;
        }

        if (data) {
          orderId = data.id;
        }
      } else {
        console.warn('[CheckoutAPI] Supabase is not configured, running in local fallback mode.');
      }

      // 5. Return success result
      res.status(200).json({
        success: true,
        message: 'Order received',
        orderId,
        parsed: result,
      });
    } catch (error) {
      console.error('[CheckoutAPI Error]', error);
      res.status(500).json({
        success: false,
        error: 'An internal server error occurred',
      });
    }
  }
);

export default router;
