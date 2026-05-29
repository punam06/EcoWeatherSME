import { getTrustScore } from './trustScore.service';
import { getLatestClimateDVS } from './dvs.service';
import { ESGMetrics } from '../../../../lib/types';
import { supabase } from '../supabase';

export async function calculateESGMetrics(userId: string): Promise<ESGMetrics> {
  const [trustScoreData, climateDVSData] = await Promise.all([
    getTrustScore(userId),
    getLatestClimateDVS(userId),
  ]);

  const trustScore = trustScoreData.trust_score;
  const dvs = climateDVSData?.dvs_score || 72; // Default DVS if not available

  const eScore = Math.round((trustScore * 0.5) + (dvs * 0.5));
  const sScore = Math.round((trustScore * 0.4) + 54);
  const gScore = Math.round((trustScore * 0.6) + 38);
  const esgScore = Math.round((eScore + sScore + gScore) / 3);

  const plasticOffset = Math.round(trustScore * 0.85);
  const carbonSeq = Math.round(trustScore * 1.4);
  const waterSaved = Math.round(trustScore * 18.5);
  const wasteReduced = Math.round(trustScore * 3.2);

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
    spoilage_prevented_bdt: 0, // This needs a real calculation
  };

  // Save to database
  const { error } = await supabase.from('esg_metrics').insert({ ...metrics, user_id: userId });
  if (error) {
    console.error('Error saving ESG metrics to database:', error);
  }

  return metrics;
}
