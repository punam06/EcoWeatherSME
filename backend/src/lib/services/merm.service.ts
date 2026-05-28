/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — MERM SERVICE
 * File: src/lib/services/merm.service.ts
 *
 * Microclimate Exposure Risk Model (MERM) for Dhaka delivery zones.
 * O(1) in-memory static zone profiles, no database calls.
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Zone Profile Types ───────────────────────────────────────────────────────

interface DhakaZoneProfile {
  uhiOffset: number;
  hazardClass: 'MODERATE' | 'HIGH' | 'CRITICAL';
  solarCoefficient: number;
}

// ─── Static Zone Registry (O(1) lookup) ──────────────────────────────────────

export const DHAKA_ZONES: Readonly<Record<string, DhakaZoneProfile>> = {
  Mirpur: {
    uhiOffset: 3.2,
    hazardClass: 'HIGH',
    solarCoefficient: 1.15,
  },
  Mohammadpur: {
    uhiOffset: 2.8,
    hazardClass: 'HIGH',
    solarCoefficient: 1.12,
  },
  Uttara: {
    uhiOffset: 2.1,
    hazardClass: 'MODERATE',
    solarCoefficient: 1.08,
  },
  Motijheel: {
    uhiOffset: 3.5,
    hazardClass: 'CRITICAL',
    solarCoefficient: 1.20,
  },
  Dhanmondi: {
    uhiOffset: 2.5,
    hazardClass: 'MODERATE',
    solarCoefficient: 1.10,
  },
} as const;

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface MERMInput {
  zone: keyof typeof DHAKA_ZONES;
  ambientTemperature: number;
  /** Hour in 24-hour format: 0–23 */
  solarHour: number;
}

export interface DispatchWindow {
  recommended: string;
  deadline: string;
  isCurrentlySafe: boolean;
}

export interface MERMResult {
  zone: string;
  hazardClass: 'MODERATE' | 'HIGH' | 'CRITICAL';
  tstMinutes: number;
  effectiveTemperature: number;
  exposureRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  dispatchWindow: DispatchWindow;
}

// ─── Solar Hour Mapping ───────────────────────────────────────────────────────

/**
 * Maps a 24-hour clock value to a 0–12 solar scale.
 * Peak solar intensity occurs between 12:00–14:00 (noon = peak).
 *
 * Linear mapping: solarHour_24 in [0, 23] → solar_scale in [0, 12]
 * We treat 13:00 (1 PM) as the true peak → solar value 12.
 */
function toSolarScale(hour24: number): number {
  // Clamp to [0, 23]
  const h = Math.max(0, Math.min(23, hour24));
  // Peak at hour 13 (1 PM solar noon for Bangladesh):
  // Map: hour 0 → 0, hour 13 → 12, hour 23 → ~10.15
  // Simple linear scaling: solar = (h / 23) * 12
  return (h / 23) * 12;
}

// ─── TST Formula ─────────────────────────────────────────────────────────────

/**
 * Calculates Thermal Survival Time using the MERM formula:
 *
 * Adjusted Temp = Ambient Temp + UHI Offset
 * Solar Load Factor = 1 + (Solar Coefficient - 1) × sin(π × SolarHour / 12)
 * Effective Temp = Adjusted Temp × Solar Load Factor
 * TST (minutes) = max(0, 480 - ((Effective Temp - 30) × 18))
 *
 * @param ambientTemperature - Ambient regional temperature in °C
 * @param zone - Dhaka zone profile
 * @param solarHour - 24-hour time (0–23) mapped to solar scale
 * @returns TST in minutes
 */
function calculateTST(
  ambientTemperature: number,
  zone: DhakaZoneProfile,
  solarHour24: number
): { tstMinutes: number; effectiveTemperature: number } {
  const solarScale = toSolarScale(solarHour24);

  // Step 1: Adjusted temperature (add UHI offset)
  const adjustedTemp = ambientTemperature + zone.uhiOffset;

  // Step 2: Solar Load Factor
  const solarLoadFactor =
    1 + (zone.solarCoefficient - 1) * Math.sin((Math.PI * solarScale) / 12);

  // Step 3: Effective temperature
  const effectiveTemperature = parseFloat((adjustedTemp * solarLoadFactor).toFixed(2));

  // Step 4: TST in minutes (never below 0)
  const tstRaw = 480 - (effectiveTemperature - 30) * 18;
  const tstMinutes = Math.max(0, parseFloat(tstRaw.toFixed(2)));

  return { tstMinutes, effectiveTemperature };
}

// ─── Exposure Risk Level ──────────────────────────────────────────────────────

function deriveExposureRiskLevel(tstMinutes: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (tstMinutes > 240) return 'LOW';
  if (tstMinutes >= 120) return 'MEDIUM';
  if (tstMinutes >= 60) return 'HIGH';
  return 'EXTREME';
}

// ─── Dispatch Window Logic ────────────────────────────────────────────────────

function computeDispatchWindow(
  tstMinutes: number,
  hazardClass: 'MODERATE' | 'HIGH' | 'CRITICAL',
  solarHour24: number
): DispatchWindow {
  // Safe dispatch window is early morning (before peak solar heat)
  const recommended = '06:00–08:00';
  const deadline = 'Before 10:00';

  // isCurrentlySafe: current hour is in a low-risk window and TST > 120 min
  const isSafeHour = solarHour24 < 10 || solarHour24 >= 18;
  const isSafeWindow = tstMinutes > 120;
  const isCurrentlySafe = isSafeHour && isSafeWindow;

  return { recommended, deadline, isCurrentlySafe };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates the microclimate exposure risk for a given Dhaka delivery zone.
 *
 * @param input - Zone, ambient temperature, and current solar hour
 * @returns Full MERM result with TST, risk level, and dispatch window
 */
export function evaluateExposure(input: MERMInput): MERMResult {
  const { zone, ambientTemperature, solarHour } = input;

  const zoneProfile = DHAKA_ZONES[zone];

  const { tstMinutes, effectiveTemperature } = calculateTST(
    ambientTemperature,
    zoneProfile,
    solarHour
  );

  const exposureRiskLevel = deriveExposureRiskLevel(tstMinutes);
  const dispatchWindow = computeDispatchWindow(tstMinutes, zoneProfile.hazardClass, solarHour);

  return {
    zone,
    hazardClass: zoneProfile.hazardClass,
    tstMinutes,
    effectiveTemperature,
    exposureRiskLevel,
    dispatchWindow,
  };
}
