import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

export interface DVSResult {
  tst_minutes: number;
  exposure_risk_level: 'Low' | 'Medium' | 'High';
  is_viable: boolean;
  advice: string;
}

export const HAZARD_REGISTRY: Record<string, { hazardClass: string; multiplier: number; baseSurvival: number }> = {
  'Old Dhaka': { hazardClass: 'A', multiplier: 1.80, baseSurvival: 0.90 },
  'Savar': { hazardClass: 'B+', multiplier: 1.55, baseSurvival: 1.00 },
  'Gazipur': { hazardClass: 'B', multiplier: 1.50, baseSurvival: 1.05 },
  'Mirpur': { hazardClass: 'B-', multiplier: 1.40, baseSurvival: 1.02 },
  'Gulshan': { hazardClass: 'C', multiplier: 1.10, baseSurvival: 1.20 }
};

export function getSolarMultipliers(date: Date): { solarFactor: number; solarHourMultiplier: number } {
  const hours = date.getHours();

  if (hours >= 11 && hours < 15) {
    return { solarFactor: 1.0, solarHourMultiplier: 1.5 };
  } else if ((hours >= 8 && hours < 11) || (hours >= 15 && hours < 18)) {
    return { solarFactor: 0.6, solarHourMultiplier: 1.0 };
  } else {
    return { solarFactor: 0.2, solarHourMultiplier: 0.4 };
  }
}

export function calculateTST(
  trustScore: number,
  zone: string,
  packagingType: 'Standard Plastic' | 'Thermal-Insulated Cooling Bin' | string,
  dispatchTime: Date
): DVSResult {
  const packagingFactor = packagingType === 'Thermal-Insulated Cooling Bin' ? 4.0 : 1.0;
  const { solarHourMultiplier } = getSolarMultipliers(dispatchTime);
  const hazardData = HAZARD_REGISTRY[zone] || { hazardClass: 'Unknown', multiplier: 1.0, baseSurvival: 1.0 };
  const hazardMultiplier = hazardData.multiplier;
  const baseSurvivalMultiplier = hazardData.baseSurvival;

  const rawHours = (trustScore * packagingFactor * baseSurvivalMultiplier) / (hazardMultiplier * solarHourMultiplier);
  const tst_minutes = Math.max(10, Math.round(rawHours * 60));

  let exposure_risk_level: 'Low' | 'Medium' | 'High' = 'Low';
  let is_viable = true;

  if (tst_minutes < 120) {
    exposure_risk_level = 'High';
    is_viable = false;
  } else if (tst_minutes < 480) {
    exposure_risk_level = 'Medium';
  }

  let advice = 'Safe to dispatch under current conditions.';
  if (exposure_risk_level === 'High') {
    advice = `Standard packaging will fail in ${zone} under current solar conditions. Upgrade to insulated thermal bins or delay dispatch to double the survival time window.`;
  } else if (exposure_risk_level === 'Medium') {
    advice = `Moderate risk detected. Ensure delivery is scheduled promptly and check solar intensity windows.`;
  }

  return {
    tst_minutes,
    exposure_risk_level,
    is_viable,
    advice
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { trustScore, zone, packagingType, dispatchTime } = body;

    if (trustScore === undefined || !zone || !packagingType) {
      return new Response(JSON.stringify({ error: "Missing required parameters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const time = dispatchTime ? new Date(dispatchTime) : new Date();
    const result = calculateTST(trustScore, zone, packagingType, time);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
