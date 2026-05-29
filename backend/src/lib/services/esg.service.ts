import { ESGMetrics } from '../../../../lib/types';

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
    const { supabase } = require('../supabase');
    if (supabase) {
      await supabase.from('esg_metrics').insert({ ...metrics });
    }
  } catch (error) {
    // Graceful bypass
  }

  return metrics;
}
