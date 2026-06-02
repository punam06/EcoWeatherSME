import { ESGMetrics } from '../types';

export async function calculateESGMetrics(trustScore: number = 84, dvs: number = 72): Promise<ESGMetrics> {
  const eScore = Math.min(100, Math.round((trustScore * 0.5) + (dvs * 0.5)));
  const sScore = Math.min(100, Math.round((trustScore * 0.4) + 54));
  const gScore = Math.min(100, Math.round((trustScore * 0.6) + 38));
  const esgScore = Math.round((eScore + sScore + gScore) / 3);

  const plasticOffset = Math.round(trustScore * 0.85);
  const carbonSeq = Math.round(trustScore * 1.4);
  const waterSaved = Math.round(trustScore * 18.5);
  const wasteReduced = Math.round(trustScore * 3.2);
  const spoilagePrevented = Math.round(trustScore * 2.1 * (dvs / 100) * 40);

  const metrics: ESGMetrics = {
    e_score: eScore,
    s_score: sScore,
    g_score: gScore,
    esg_score: esgScore,
    plastic_offset_kg: plasticOffset,
    carbon_sequestered_kg: carbonSeq,
    water_saved_l: waterSaved,
    waste_reduced_kg: wasteReduced,
    trust_score: trustScore,
    dvs_score: dvs,
    month: new Date().toISOString(),
    spoilage_prevented_bdt: spoilagePrevented,
  };

  // Gracefully attempt saving to database without throwing crashes if Supabase is down
  try {
    const { getSupabaseClient, isSupabaseConfigured } = require('../supabase');
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      await supabase.from('esg_metrics').insert({
        e_score: metrics.e_score,
        s_score: metrics.s_score,
        g_score: metrics.g_score,
        esg_score: metrics.esg_score,
        plastic_offset_kg: metrics.plastic_offset_kg,
        carbon_sequestered_kg: metrics.carbon_sequestered_kg,
        water_saved_l: metrics.water_saved_l,
        waste_reduced_kg: metrics.waste_reduced_kg,
        spoilage_prevented_bdt: metrics.spoilage_prevented_bdt,
        trust_score: metrics.trust_score,
        dvs_score: metrics.dvs_score,
        month: metrics.month
      });
    }
  } catch (error) {
    console.warn('[ESG Service] program ESG insert failed:', error);
  }

  return metrics;
}
