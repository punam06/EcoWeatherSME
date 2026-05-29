import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

export interface ESGMetrics {
  month: string;
  spoilage_prevented_bdt: number;
  plastic_offset_kg: number;
  carbon_sequestered_kg: number;
  water_saved_l: number;
  waste_reduced_kg: number;
  e_score: number;
  s_score: number;
  g_score: number;
  esg_score: number;
  trust_score: number;
  dvs_score: number;
}

export async function calculateESGMetrics(userId: string): Promise<ESGMetrics> {
  let trustScore = 82; // Default/fallback trust score
  let dvs = 75; // Default/fallback DVS score

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      // Get latest batch trust_score
      const { data: batchData } = await supabase
        .from('batches')
        .select('trust_score')
        .order('created_at', { ascending: false })
        .limit(1);

      if (batchData && batchData.length > 0) {
        trustScore = batchData[0].trust_score;
      }

      // Get latest dispatch schedule dvs_score
      const { data: scheduleData } = await supabase
        .from('dispatch_schedules')
        .select('dvs_score')
        .order('created_at', { ascending: false })
        .limit(1);

      if (scheduleData && scheduleData.length > 0) {
        dvs = scheduleData[0].dvs_score;
      }
    } catch (err) {
      console.error('[calculateESGMetrics] database query error:', err);
    }
  }

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
    spoilage_prevented_bdt: 0, // Fallback/calculated value
  };

  // Save to database if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('esg_metrics')
        .insert({ ...metrics, user_id: userId });
      if (error) {
        console.error('Error saving ESG metrics to database:', error);
      }
    } catch (err) {
      console.error('Error saving ESG metrics to database:', err);
    }
  }

  return metrics;
}
