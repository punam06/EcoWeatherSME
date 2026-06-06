/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — AI COST REPORT ROUTE
 * File: src/api/routes/aiCostReport.route.ts
 *
 *   GET /api/ai/cost-report
 *
 * Returns a real-time snapshot of AI usage across active 15-minute
 * windows. Requires authentication (any role).
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { optionalJWT } from '../../middleware/authenticateJWT';
import { getUsageReport, getAggregateStats } from '../../middleware/aiCostShield';

const router = Router();

/**
 * GET /api/ai/cost-report
 * Returns per-key usage breakdown and aggregate totals.
 * Uses optionalJWT so it works in development without a token.
 */
router.get(
  '/',
  optionalJWT,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = getUsageReport();
      const aggregate = getAggregateStats();

      res.json({
        success: true,
        data: {
          aggregate,
          breakdown: report,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
