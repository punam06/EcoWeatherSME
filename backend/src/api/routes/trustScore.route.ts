/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — TRUST SCORE ROUTE
 * File: src/api/routes/trustScore.route.ts
 *
 * POST /api/batch/trust-score
 * Validates input via Zod, calculates trust score, logs to Supabase.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { TrustScoreRequestSchema } from '../schemas';
import { calculateTrustScore } from '../../lib/services/trustScore.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

/**
 * POST /api/batch/trust-score
 *
 * Body: { pH, ec, temperatureCelsius, em1Ratio, fermentationDays }
 * Response: { success: true, data: TrustScoreResult }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ── 1. Validate request body ───────────────────────────
    const parsed = TrustScoreRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: (parsed.error as ZodError).issues,
      });
      return;
    }

    const { pH, ec, temperatureCelsius, em1Ratio, fermentationDays } = parsed.data;

    // ── 2. Calculate trust score ───────────────────────────
    const result = calculateTrustScore({
      pH,
      ec,
      temperatureCelsius,
      em1Ratio,
      fermentationDays,
    });

    // ── 3. Async log to Supabase (fire and forget) ─────────
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      supabase
        .from('trust_score_logs')
        .insert({
          ph: pH,
          ec,
          temperature: temperatureCelsius,
          em1_ratio: em1Ratio,
          fermentation_days: fermentationDays,
          score: result.score,
          grade: result.grade,
          is_viable: result.isViable,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[TrustScore] Supabase log failed:', error.message);
          }
        });
    }

    // ── 4. Return result ───────────────────────────────────
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
