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
import { calculateTrustScoreLegacy } from '../../lib/services/trustScore.service';
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
    // ── 1. Validate & Normalize request body ───────────────────────────
    const body = { ...req.body };
    if (body.pH === undefined && body.ph !== undefined) body.pH = parseFloat(body.ph);
    if (body.ec === undefined && body.EC !== undefined) body.ec = parseFloat(body.EC);
    if (body.temperatureCelsius === undefined && body.temperature !== undefined) body.temperatureCelsius = parseFloat(body.temperature);
    if (body.temperatureCelsius === undefined && body.temp !== undefined) body.temperatureCelsius = parseFloat(body.temp);
    if (body.em1Ratio === undefined && body.em1_ratio !== undefined) {
      const ratioStr = String(body.em1_ratio);
      if (ratioStr === '1:1:20' || ratioStr === '1:500' || ratioStr === '0.002') body.em1Ratio = 0.002;
      else if (ratioStr === '1:1000' || ratioStr === '0.001') body.em1Ratio = 0.001;
      else if (ratioStr === '1:2000' || ratioStr === '0.0005') body.em1Ratio = 0.0005;
      else body.em1Ratio = parseFloat(ratioStr) || 0.001;
    }
    if (body.fermentationDays === undefined && body.fermentation_days !== undefined) body.fermentationDays = parseInt(body.fermentation_days, 10);

    const parsed = TrustScoreRequestSchema.safeParse(body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: (parsed.error as ZodError).issues,
      });
      return;
    }

    const { pH, ec, temperatureCelsius, em1Ratio, fermentationDays } = parsed.data;

    // ── 2. Calculate trust score (category-aware v2 engine,
    //         routed through the legacy shim for backward compat) ─
    const result = calculateTrustScoreLegacy({
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
