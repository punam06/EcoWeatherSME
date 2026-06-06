/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — BUSINESS INTELLIGENCE ROUTE
 * File: src/api/routes/bi.route.ts
 *
 *   GET /api/bi
 *
 * Aggregates Sustainability × Market data for the BI dashboard view:
 *   - CO₂ sequestered trend (last 14 days, daily)
 *   - Plastic bottles saved trend (last 14 days, daily)
 *   - Batch creation trend (last 14 days, daily)
 *   - Regional market pull (top destination zones by batch count)
 *   - Trust score distribution (histogram buckets)
 *   - Layer breakdown (L1 registrations, L2 certifications, L3 QR scans)
 *   - Top performing batches (by trust score)
 *
 * No authentication required — this is a public-read aggregation
 * used by both the operator dashboard and the marketing view.
 *
 * Gracefully degrades when Supabase is not configured.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────
const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

function buildEmpty14DaySeries() {
  // Build an empty 14-day series with zero values for graceful degradation
  const series: { date: string; co2Kg: number; plasticBottles: number; batches: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    series.push({ date: dayKey(d), co2Kg: 0, plasticBottles: 0, batches: 0 });
  }
  return series;
}

function trustScoreBucket(score: number): string {
  if (score >= 90) return 'A+ (90-100)';
  if (score >= 80) return 'A  (80-89)';
  if (score >= 70) return 'B  (70-79)';
  if (score >= 60) return 'C  (60-69)';
  if (score >= 50) return 'D  (50-59)';
  return 'F  (<50)';
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Default: empty-but-valid response (for offline / pre-demo mode)
    const emptySeries = buildEmpty14DaySeries();
    const fallback = {
      success: true,
      data: {
        sustainabilityTrend: emptySeries,
        regionalMarketPull: [] as { zone: string; batches: number; totalWeightKg: number; avgTrustScore: number }[],
        trustDistribution: [
          { bucket: 'A+ (90-100)', count: 0 },
          { bucket: 'A  (80-89)',  count: 0 },
          { bucket: 'B  (70-79)',  count: 0 },
          { bucket: 'C  (60-69)',  count: 0 },
          { bucket: 'D  (50-59)',  count: 0 },
          { bucket: 'F  (<50)',     count: 0 },
        ],
        layerBreakdown: { l1Registrations: 0, l2Certifications: 0, l3QrScans: 0 },
        topBatches: [] as { batchId: string; productName: string; trustScore: number; weightKg: number }[],
        totals: {
          totalBatches: 0,
          certifiedBatches: 0,
          totalWeightKg: 0,
          co2SequesteredKg: 0,
          plasticBottlesSaved: 0,
        },
        source: 'fallback' as 'fallback' | 'live',
        generatedAt: new Date().toISOString(),
      },
    };

    if (!isSupabaseConfigured()) {
      res.json(fallback);
      return;
    }

    const supabase = getSupabaseClient();

    // ── Pull the last 60 days of batches (covers the 14-day window with buffer) ──
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const { data: batches, error: batchErr } = await supabase
      .from('batches')
      .select('id, batch_number, product_name, status, trust_score, destination_zone, weight_kg, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (batchErr) {
      console.warn('[bi] batches query failed:', batchErr.message);
      res.json(fallback);
      return;
    }

    // ── Build 14-day sustainability series ──
    const seriesMap = new Map<string, { date: string; co2Kg: number; plasticBottles: number; batches: number }>();
    for (const s of emptySeries) {
      seriesMap.set(s.date, { ...s });
    }

    let totalWeight = 0;
    let certifiedCount = 0;
    const zoneMap = new Map<string, { batches: number; totalWeightKg: number; trustSum: number }>();
    const bucketMap = new Map<string, number>();

    for (const b of batches || []) {
      const day = dayKey(new Date(b.created_at));
      const entry = seriesMap.get(day) || { date: day, co2Kg: 0, plasticBottles: 0, batches: 0 };
      const weight = Number(b.weight_kg) || 0;
      entry.batches += 1;
      entry.co2Kg += Math.round(weight * 0.25);          // 0.25 kg CO₂ per kg biochar
      entry.plasticBottles += 240;                         // 240 bottles saved per batch
      seriesMap.set(day, entry);

      totalWeight += weight;
      if (b.status === 'certified') certifiedCount += 1;

      // Regional aggregation
      const zone = b.destination_zone || 'Unknown';
      const z = zoneMap.get(zone) || { batches: 0, totalWeightKg: 0, trustSum: 0 };
      z.batches += 1;
      z.totalWeightKg += weight;
      z.trustSum += Number(b.trust_score) || 0;
      zoneMap.set(zone, z);

      // Trust score distribution
      const bucket = trustScoreBucket(Number(b.trust_score) || 0);
      bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1);
    }

    const sustainabilityTrend = Array.from(seriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const regionalMarketPull = Array.from(zoneMap.entries())
      .map(([zone, v]) => ({
        zone,
        batches: v.batches,
        totalWeightKg: Math.round(v.totalWeightKg),
        avgTrustScore: v.batches > 0 ? Math.round((v.trustSum / v.batches) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.batches - a.batches)
      .slice(0, 8);

    const trustDistribution = [
      'A+ (90-100)', 'A  (80-89)', 'B  (70-79)',
      'C  (60-69)', 'D  (50-59)',  'F  (<50)',
    ].map((b) => ({ bucket: b, count: bucketMap.get(b) || 0 }));

    // ── Layer breakdown (L1 / L2 / L3) ──
    let l3QrScans = 0;
    try {
      const { count } = await supabase
        .from('qr_scans')
        .select('*', { count: 'exact', head: true });
      l3QrScans = count ?? 0;
    } catch { /* qr_scans table may not exist yet */ }

    const topBatches = (batches || [])
      .filter((b: any) => Number(b.trust_score) > 0)
      .sort((a: any, b: any) => Number(b.trust_score) - Number(a.trust_score))
      .slice(0, 5)
      .map((b: any) => ({
        batchId: b.batch_number || b.id,
        productName: b.product_name || 'Unknown product',
        trustScore: Number(b.trust_score) || 0,
        weightKg: Number(b.weight_kg) || 0,
      }));

    res.json({
      success: true,
      data: {
        sustainabilityTrend,
        regionalMarketPull,
        trustDistribution,
        layerBreakdown: {
          l1Registrations: (batches || []).length,
          l2Certifications: certifiedCount,
          l3QrScans,
        },
        topBatches,
        totals: {
          totalBatches: (batches || []).length,
          certifiedBatches: certifiedCount,
          totalWeightKg: Math.round(totalWeight),
          co2SequesteredKg: Math.round(totalWeight * 0.25),
          plasticBottlesSaved: (batches || []).length * 240,
        },
        source: 'live' as 'fallback' | 'live',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[bi] unexpected error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to aggregate BI data',
    });
  }
});

export default router;
