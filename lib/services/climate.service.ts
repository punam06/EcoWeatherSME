import { DVSResult, ZoneHazardProfile } from '../types';

/**
 * BUET-Calibrated Neighborhood Hazard Registry mapping
 */
export const HAZARD_REGISTRY: Record<string, { hazardClass: string; multiplier: number; baseSurvival: number }> = {
  'Old Dhaka': { hazardClass: 'A', multiplier: 1.80, baseSurvival: 0.90 },
  'Savar': { hazardClass: 'B+', multiplier: 1.55, baseSurvival: 1.00 },
  'Gazipur': { hazardClass: 'B', multiplier: 1.50, baseSurvival: 1.05 },
  'Mirpur': { hazardClass: 'B-', multiplier: 1.40, baseSurvival: 1.02 },
  'Gulshan': { hazardClass: 'C', multiplier: 1.10, baseSurvival: 1.20 }
};

/**
 * Helper to determine Solar Factor and Multiplier based on time of day
 */
export function getSolarMultipliers(date: Date): { solarFactor: number; solarHourMultiplier: number } {
  const hours = date.getHours();

  if (hours >= 11 && hours < 15) {
    // Peak Solar Hour (11:00 AM - 3:00 PM)
    return { solarFactor: 1.0, solarHourMultiplier: 1.5 };
  } else if ((hours >= 8 && hours < 11) || (hours >= 15 && hours < 18)) {
    // Standard Daylight Hour (8:00 AM - 11:00 AM & 3:00 PM - 6:00 PM)
    return { solarFactor: 0.6, solarHourMultiplier: 1.0 };
  } else {
    // Nighttime / Dawn / Dusk
    return { solarFactor: 0.2, solarHourMultiplier: 0.4 };
  }
}

/**
 * Fetches regional weather from Open-Meteo API
 */
export async function fetchRegionalWeather(): Promise<{ baseTemp: number; windSpeed: number }> {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,wind_speed_10m';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP error: ${res.status}`);
    }
    const data = await res.json() as any;
    return {
      baseTemp: Number(data.current.temperature_2m),
      windSpeed: Number(data.current.wind_speed_10m)
    };
  } catch (error) {
    console.warn('Failed to fetch Open-Meteo API. Using fallback defaults.', error);
    // Fallback Defaults
    return {
      baseTemp: 31.0,
      windSpeed: 8.0
    };
  }
}

/**
 * Calculates dynamically adjusted microclimate temperature and thermal risk index
 */
export function calculateMicroclimate(
  baseTemp: number,
  windSpeed: number,
  uhiOffset: number,
  solarFactor: number
): { adjustedTemp: number; thermalRisk: number } {
  // Wind Cooling Dispersion Factor (Wcooling)
  const wCooling = windSpeed > 15.0 ? 1.0 : 0.0;

  // Microclimate Temperature adjustment formula
  const adjustedTemp = Number((baseTemp + (uhiOffset * solarFactor) - wCooling).toFixed(2));

  // Thermal Risk Index
  let thermalRisk = 0.1;
  if (adjustedTemp > 35.0) {
    thermalRisk = 1.0; // Critical Degradation
  } else if (adjustedTemp > 32.0 && adjustedTemp <= 35.0) {
    thermalRisk = 0.5; // Moderate Hazard
  }

  return { adjustedTemp, thermalRisk };
}

/**
 * Deterministic Thermal Survival Time (TST) engine
 */
export function calculateTST(
  trustScore: number,
  zone: string,
  packagingType: 'Standard Plastic' | 'Thermal-Insulated Cooling Bin' | string,
  dispatchTime: Date
): DVSResult {
  // Packaging Factor mapping
  const packagingFactor = packagingType === 'Thermal-Insulated Cooling Bin' ? 4.0 : 1.0;

  // Solar multiplier
  const { solarHourMultiplier } = getSolarMultipliers(dispatchTime);

  // Neighborhood hazard mapping
  const hazardData = HAZARD_REGISTRY[zone] || { hazardClass: 'Unknown', multiplier: 1.0, baseSurvival: 1.0 };
  const hazardMultiplier = hazardData.multiplier;
  const baseSurvivalMultiplier = hazardData.baseSurvival;

  // Formula Execution
  const rawHours = (trustScore * packagingFactor * baseSurvivalMultiplier) / (hazardMultiplier * solarHourMultiplier);
  const tst_minutes = Math.max(10, Math.round(rawHours * 60));

  // Determine exposure risk level based on the result
  let exposure_risk_level: 'Low' | 'Medium' | 'High' = 'Low';
  let is_viable = true;

  if (tst_minutes < 120) { // Less than 2 hours buffer
    exposure_risk_level = 'High';
    is_viable = false;
  } else if (tst_minutes < 480) { // Less than 8 hours buffer
    exposure_risk_level = 'Medium';
  }

  // Actionable advice generation
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
