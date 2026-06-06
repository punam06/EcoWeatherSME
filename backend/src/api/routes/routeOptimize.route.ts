/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — ROUTE OPTIMIZE ROUTE
 * File: src/api/routes/routeOptimize.route.ts
 *
 *   POST /api/route/optimize
 *     Body: { stops[], baseTemp, solarHour, windSpeed, trustScore, packaging }
 *
 *   GET  /api/route/zones
 *     Returns all known Dhaka zones with coordinates.
 *
 * No authentication required — data is purely computational.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { optimizeRoute, getKnownZones } from '../../lib/services/routeOptimizer.service';

const router = Router();

// ── Zod Schema ────────────────────────────────────────────────────────────────

const RouteStopSchema = z.object({
  zone: z.string().min(1).max(100),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const OptimizeRouteSchema = z.object({
  stops: z
    .array(RouteStopSchema)
    .min(1, 'At least one stop is required')
    .max(20, 'Maximum 20 stops per route'),
  baseTemp: z.coerce.number().min(-10).max(60).default(31),
  solarHour: z.coerce.number().int().min(0).max(23).default(12),
  windSpeed: z.coerce.number().min(0).max(200).default(8),
  trustScore: z.coerce.number().min(0).max(100).default(80),
  packaging: z.enum(['standard', 'insulated', 'thermal']).default('standard'),
}).strict();

// ── POST /api/route/optimize ──────────────────────────────────────────────────

router.post(
  '/optimize',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = OptimizeRouteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { stops, baseTemp, solarHour, windSpeed, trustScore, packaging } = parsed.data;

      const result = optimizeRoute(
        stops.map((s) => ({
          zone: s.zone,
          latitude: s.latitude ?? 0,
          longitude: s.longitude ?? 0,
        })),
        baseTemp,
        solarHour,
        windSpeed,
        trustScore,
        packaging,
      );

      res.json({
        success: true,
        data: result,
        computedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/route/zones ──────────────────────────────────────────────────────

router.get(
  '/zones',
  (_req: Request, res: Response): void => {
    const zones = getKnownZones();
    res.json({ success: true, data: zones, count: zones.length });
  },
);

export default router;
