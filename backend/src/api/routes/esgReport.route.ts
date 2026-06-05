/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — PUBLIC ESG REPORT ROUTE
 * File: src/api/routes/esgReport.route.ts
 *
 *   GET /api/esg/report            — current month's aggregate
 *   GET /api/esg/report?months=12  — rolling N-month aggregate
 *
 * Public, no auth. Pulls from the `esg_metrics` table that the
 * ESG service writes to. Used by the marketing site, the
 * dashboard, and the judge's demo screen.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

interface MonthlyAggregate {
  month: string;
  e_score: number;
  s_score: number;
  g_score: number;
  esg_score: number;
  trust_score: number;
  dvs_score: number;
  plastic_offset_kg: number;
  carbon_sequestered_kg: number;
  water_saved_l: number;
  waste_reduced_kg: number;
  spoilage_prevented_bdt: number;
  /** Private running count for averaging; stripped from response. */
  _n?: number;
}

function emptyAggregate(month: string): MonthlyAggregate {
  return {
    month,
    e_score: 0,
    s_score: 0,
    g_score: 0,
    esg_score: 0,
    trust_score: 0,
    dvs_score: 0,
    plastic_offset_kg: 0,
    carbon_sequestered_kg: 0,
    water_saved_l: 0,
    waste_reduced_kg: 0,
    spoilage_prevented_bdt: 0,
  };
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const monthsParam = Number(req.query.months ?? 1);
      const months = Math.max(1, Math.min(24, Number.isFinite(monthsParam) ? monthsParam : 1));

      // Demo data fallback (offline / pre-deploy)
      const demo = (m: string): MonthlyAggregate => ({
        month: `${m}-01T00:00:00.000Z`,
        e_score: 86,
        s_score: 78,
        g_score: 82,
        esg_score: 82,
        trust_score: 84,
        dvs_score: 72,
        plastic_offset_kg: 71,
        carbon_sequestered_kg: 118,
        water_saved_l: 1554,
        waste_reduced_kg: 269,
        spoilage_prevented_bdt: 5080,
      });

      if (!isSupabaseConfigured()) {
        const data: MonthlyAggregate[] = [];
        for (let i = months - 1; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          data.push(demo(monthKey(d.toISOString())));
        }
        res.status(200).json({ success: true, source: 'demo', data });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: rows, error } = await supabase
        .from('esg_metrics')
        .select('e_score, s_score, g_score, esg_score, trust_score, dvs_score, plastic_offset_kg, carbon_sequestered_kg, water_saved_l, waste_reduced_kg, spoilage_prevented_bdt, month')
        .order('month', { ascending: false })
        .limit(months * 200); // up to 200 samples / month

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      // Group by month and average
      const buckets = new Map<string, MonthlyAggregate>();
      for (const r of rows ?? []) {
        const key = monthKey(r.month);
        const bucket = buckets.get(key) ?? emptyAggregate(`${key}-01T00:00:00.000Z`);
        const n = (buckets.get(key)?._n ?? 0) + 1;
        bucket.e_score += r.e_score;
        bucket.s_score += r.s_score;
        bucket.g_score += r.g_score;
        bucket.esg_score += r.esg_score;
        bucket.trust_score += r.trust_score;
        bucket.dvs_score += r.dvs_score;
        bucket.plastic_offset_kg += r.plastic_offset_kg;
        bucket.carbon_sequestered_kg += r.carbon_sequestered_kg;
        bucket.water_saved_l += r.water_saved_l;
        bucket.waste_reduced_kg += r.waste_reduced_kg;
        bucket.spoilage_prevented_bdt += r.spoilage_prevented_bdt;
        (bucket as any)._n = n;
        buckets.set(key, bucket);
      }

      const data = Array.from(buckets.values())
        .map((b: any) => ({
          month: b.month,
          e_score: Math.round(b.e_score / b._n),
          s_score: Math.round(b.s_score / b._n),
          g_score: Math.round(b.g_score / b._n),
          esg_score: Math.round(b.esg_score / b._n),
          trust_score: Math.round(b.trust_score / b._n),
          dvs_score: Math.round(b.dvs_score / b._n),
          plastic_offset_kg: Math.round(b.plastic_offset_kg / b._n),
          carbon_sequestered_kg: Math.round(b.carbon_sequestered_kg / b._n),
          water_saved_l: Math.round(b.water_saved_l / b._n),
          waste_reduced_kg: Math.round(b.waste_reduced_kg / b._n),
          spoilage_prevented_bdt: Math.round(b.spoilage_prevented_bdt / b._n),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      res.status(200).json({ success: true, source: 'database', data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
