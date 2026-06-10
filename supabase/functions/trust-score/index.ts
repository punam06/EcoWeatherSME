// Removed Deno serve import
import { corsHeaders } from "../_shared/cors.ts";

export interface IoTReadings {
  pH: number;
  EC: number;
  temp: number;
  em1_ratio: string;
  fermentation_days: number;
}

/**
 * Calculates a deterministic, BARI-aligned quality trust score (0-100) for biological batches.
 * Enforces exact subtraction penalties based on IoT fermentation readings.
 */
function calculateTrustScore(readings: IoTReadings): number {
  let score = 100;

  // 1. pH Penalty: Optimal range 3.5 - 7.5
  if (readings.pH < 3.5) {
    score -= Math.min(25, (3.5 - readings.pH) * 30);
  } else if (readings.pH > 7.5) {
    score -= Math.min(25, (readings.pH - 7.5) * 20);
  }

  // 2. EC Penalty: Optimal range 2.5 - 5.0 dS/m
  if (readings.EC < 2.5) {
    score -= Math.min(20, (2.5 - readings.EC) * 25);
  } else if (readings.EC > 5.0) {
    score -= Math.min(20, (readings.EC - 5.0) * 15);
  }

  // 3. Temp Penalty: Optimal range 25°C - 35°C
  if (readings.temp < 25) {
    score -= Math.min(15, (25 - readings.temp) * 3);
  } else if (readings.temp > 35) {
    score -= Math.min(20, (readings.temp - 35) * 4);
  }

  // 4. EM-1 ratio Penalty
  if (readings.em1_ratio !== '1:1:20') {
    score -= 15;
  }

  // 5. Fermentation days Penalty
  if (readings.fermentation_days < 7) {
    score -= (7 - readings.fermentation_days) * 10;
  }

  return Math.max(0, Math.round(score));
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const readings = body as IoTReadings;

    if (
      readings.pH === undefined ||
      readings.EC === undefined ||
      readings.temp === undefined ||
      readings.em1_ratio === undefined ||
      readings.fermentation_days === undefined
    ) {
      return new Response(JSON.stringify({ error: "Missing required reading properties." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const score = calculateTrustScore(readings);

    return new Response(JSON.stringify({ trustScore: score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
