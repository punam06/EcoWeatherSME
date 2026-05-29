/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — CLIMATE DVS ROUTE
 * File: src/api/routes/climateDVS.route.ts
 *
 * POST /api/climate/dvs
 * Validates input, runs MERM evaluation, calculates DVS, logs to Supabase.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ClimateDVSRequestSchema } from '../schemas';
import { evaluateExposure } from '../../lib/services/merm.service';
import { calculateDVS } from '../../lib/services/dvs.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

/**
 * POST /api/climate/dvs
 *
 * Body: { zone, ambientTemperature, solarHour, trustScore }
 * Response: { success: true, data: MERMResult & DVSResult }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ── 1. Validate request body ───────────────────────────
    const parsed = ClimateDVSRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: (parsed.error as ZodError).issues,
      });
      return;
    }

    const { zone, ambientTemperature, solarHour, trustScore } = parsed.data;

    // ── 2. Run MERM evaluation ─────────────────────────────
    const mermResult = evaluateExposure({ zone, ambientTemperature, solarHour });

    // ── 3. Calculate DVS ───────────────────────────────────
    const dvsResult = calculateDVS(trustScore, mermResult);

    // ── 4. Merge outputs into flat response object ─────────
    const mergedResult = {
      ...mermResult,
      ...dvsResult,
    };

    // ── 5. Async log to Supabase (fire and forget) ─────────
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      supabase
        .from('dvs_logs')
        .insert({
          zone,
          ambient_temperature: ambientTemperature,
          solar_hour: solarHour,
          trust_score: trustScore,
          dvs_score: dvsResult.dvsScore,
          delivery_approved: dvsResult.deliveryApproved,
          tst_minutes: mermResult.tstMinutes,
          hazard_class: mermResult.hazardClass,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[ClimateDVS] Supabase log failed:', error.message);
          }
        });
    }

    // ── 6. Return merged result ────────────────────────────
    res.status(200).json({
      success: true,
      data: mergedResult,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
