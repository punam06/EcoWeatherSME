/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — MERM SERVICE
 * File: src/lib/services/merm.service.ts
 *
 * Microclimate Exposure Risk Model (MERM) for Dhaka delivery zones.
 * O(1) in-memory static zone profiles — all 50+ frontend UHI zones.
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Zone Profile Types ───────────────────────────────────────────────────────

interface DhakaZoneProfile {
  uhiOffset: number;
  hazardClass: 'MODERATE' | 'HIGH' | 'CRITICAL';
  solarCoefficient: number;
}

// ─── Static Zone Registry (O(1) lookup) ──────────────────────────────────────
// Mirrors the frontend UHI_ZONES exactly (50+ Dhaka zones)

export const DHAKA_ZONES: Readonly<Record<string, DhakaZoneProfile>> = {
  // ── Dense Commercial / Old Dhaka (CRITICAL UHI) ──
  'Old Dhaka':     { uhiOffset: 3.4, hazardClass: 'CRITICAL', solarCoefficient: 1.22 },
  'Motijheel':     { uhiOffset: 3.1, hazardClass: 'CRITICAL', solarCoefficient: 1.20 },
  'Tejgaon':       { uhiOffset: 3.2, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Hazaribagh':    { uhiOffset: 3.5, hazardClass: 'CRITICAL', solarCoefficient: 1.23 },
  'Kamrangirchar': { uhiOffset: 3.3, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Chowkbazar':    { uhiOffset: 3.4, hazardClass: 'CRITICAL', solarCoefficient: 1.22 },
  'Lalbagh':       { uhiOffset: 3.2, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Jatrabari':     { uhiOffset: 3.3, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Sutrapur':      { uhiOffset: 3.1, hazardClass: 'CRITICAL', solarCoefficient: 1.20 },
  'Bangshal':      { uhiOffset: 3.3, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Kotwali':       { uhiOffset: 3.4, hazardClass: 'CRITICAL', solarCoefficient: 1.22 },
  'New Market':    { uhiOffset: 2.9, hazardClass: 'CRITICAL', solarCoefficient: 1.18 },
  'Moghbazar':     { uhiOffset: 2.9, hazardClass: 'CRITICAL', solarCoefficient: 1.18 },
  'Paltan':        { uhiOffset: 3.0, hazardClass: 'CRITICAL', solarCoefficient: 1.19 },

  // ── Dense Residential / Mixed (HIGH UHI) ──
  'Mirpur':        { uhiOffset: 2.1, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Mirpur 10':     { uhiOffset: 2.2, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Mirpur 12':     { uhiOffset: 2.0, hazardClass: 'HIGH', solarCoefficient: 1.14 },
  'Karwan Bazar':  { uhiOffset: 3.3, hazardClass: 'CRITICAL', solarCoefficient: 1.21 },
  'Mohammadpur':   { uhiOffset: 2.3, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Badda':         { uhiOffset: 2.5, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Rampura':       { uhiOffset: 2.6, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Malibagh':      { uhiOffset: 2.8, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Khilgaon':      { uhiOffset: 2.7, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Azimpur':       { uhiOffset: 2.4, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Shantinagar':   { uhiOffset: 2.8, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Kakrail':       { uhiOffset: 2.7, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Mugda':         { uhiOffset: 2.6, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Sabujbagh':     { uhiOffset: 2.5, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Demra':         { uhiOffset: 2.4, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Kadamtali':     { uhiOffset: 2.6, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Shyampur':      { uhiOffset: 2.7, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Gendaria':      { uhiOffset: 2.8, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Mohakhali':     { uhiOffset: 2.8, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Pallabi':       { uhiOffset: 2.0, hazardClass: 'HIGH', solarCoefficient: 1.14 },
  'Rupnagar':      { uhiOffset: 2.1, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Shah Ali':      { uhiOffset: 2.2, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Darus Salam':   { uhiOffset: 2.3, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Adabor':        { uhiOffset: 2.2, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Kalabagan':     { uhiOffset: 2.5, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Shahbagh':      { uhiOffset: 2.6, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Ramna':         { uhiOffset: 2.5, hazardClass: 'HIGH', solarCoefficient: 1.17 },
  'Shahjahanpur':  { uhiOffset: 2.7, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Bhatara':       { uhiOffset: 2.4, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Bhashantek':    { uhiOffset: 2.2, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Kafrul':        { uhiOffset: 2.3, hazardClass: 'HIGH', solarCoefficient: 1.16 },
  'Sher-e-Bangla': { uhiOffset: 2.0, hazardClass: 'HIGH', solarCoefficient: 1.14 },
  'Dhanmondi':     { uhiOffset: 2.2, hazardClass: 'HIGH', solarCoefficient: 1.15 },
  'Uttara':        { uhiOffset: 1.8, hazardClass: 'HIGH', solarCoefficient: 1.13 },
  'Savar':         { uhiOffset: 2.8, hazardClass: 'HIGH', solarCoefficient: 1.18 },
  'Gazipur':       { uhiOffset: 2.4, hazardClass: 'HIGH', solarCoefficient: 1.16 },

  // ── Planned Residential / Wealthy (MODERATE UHI) ──
  'Gulshan':        { uhiOffset: 1.3, hazardClass: 'MODERATE', solarCoefficient: 1.10 },
  'Banani':         { uhiOffset: 1.5, hazardClass: 'MODERATE', solarCoefficient: 1.11 },
  'Baridhara':      { uhiOffset: 1.2, hazardClass: 'MODERATE', solarCoefficient: 1.09 },
  'Niketan':        { uhiOffset: 1.6, hazardClass: 'MODERATE', solarCoefficient: 1.12 },
  'Bashundhara RA': { uhiOffset: 1.4, hazardClass: 'MODERATE', solarCoefficient: 1.10 },

  // ── Peripheral / Green (MODERATE UHI) ──
  'Purbachal':   { uhiOffset: 0.8, hazardClass: 'MODERATE', solarCoefficient: 1.05 },
  'Cantonment':  { uhiOffset: 1.0, hazardClass: 'MODERATE', solarCoefficient: 1.06 },
  'Turag':       { uhiOffset: 1.5, hazardClass: 'MODERATE', solarCoefficient: 1.11 },
  'Khilkhet':    { uhiOffset: 1.7, hazardClass: 'MODERATE', solarCoefficient: 1.12 },
  'Bimanbandar': { uhiOffset: 1.6, hazardClass: 'MODERATE', solarCoefficient: 1.12 },
  'Uttar Khan':  { uhiOffset: 1.4, hazardClass: 'MODERATE', solarCoefficient: 1.10 },
  'Dakshinkhan': { uhiOffset: 1.5, hazardClass: 'MODERATE', solarCoefficient: 1.11 },
};

/**
 * Returns zone profile — falls back to MODERATE defaults for unknown zones.
 */
export function getZoneProfile(zone: string): DhakaZoneProfile {
  return DHAKA_ZONES[zone] ?? { uhiOffset: 2.0, hazardClass: 'MODERATE', solarCoefficient: 1.12 };
}

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface MERMInput {
  zone: string;
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

function toSolarScale(hour24: number): number {
  const h = Math.max(0, Math.min(23, hour24));
  return (h / 23) * 12;
}

// ─── TST Formula ─────────────────────────────────────────────────────────────

function calculateTST(
  ambientTemperature: number,
  zone: DhakaZoneProfile,
  solarHour24: number
): { tstMinutes: number; effectiveTemperature: number } {
  const solarScale = toSolarScale(solarHour24);
  const adjustedTemp = ambientTemperature + zone.uhiOffset;
  const solarLoadFactor =
    1 + (zone.solarCoefficient - 1) * Math.sin((Math.PI * solarScale) / 12);
  const effectiveTemperature = parseFloat((adjustedTemp * solarLoadFactor).toFixed(2));
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
  const recommended = '06:00–08:00';
  const deadline = hazardClass === 'CRITICAL' ? 'Before 08:00' : 'Before 10:00';
  const isSafeHour = solarHour24 < 10 || solarHour24 >= 18;
  const isSafeWindow = tstMinutes > 120;
  const isCurrentlySafe = isSafeHour && isSafeWindow;
  return { recommended, deadline, isCurrentlySafe };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates the microclimate exposure risk for any Dhaka delivery zone.
 */
export function evaluateExposure(input: MERMInput): MERMResult {
  const { zone, ambientTemperature, solarHour } = input;
  const zoneProfile = getZoneProfile(zone);
  const { tstMinutes, effectiveTemperature } = calculateTST(ambientTemperature, zoneProfile, solarHour);
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
