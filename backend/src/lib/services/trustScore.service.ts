/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — CATEGORY-AWARE TRUST SCORE ENGINE
 * File: src/lib/services/trustScore.service.ts
 *
 * Deterministic 0–100 scoring. The ideal ranges, ratio, days and
 * weights are pulled from `standardsRegistry.service.ts` based on
 * the product category. A `calculateTrustScoreLegacy` shim keeps
 * the old BARI-only behaviour for any caller that has not yet
 * been migrated.
 * ═══════════════════════════════════════════════════════════════
 */

import { ProductCategory, ProductStandard } from '../types';
import { getStandard } from './standardsRegistry.service';

// ─── Public Types ──────────────────────────────────────────────

export interface TrustScoreInput {
  category: ProductCategory;
  pH: number;
  ec: number;
  temperatureCelsius: number;
  em1Ratio: number;
  fermentationDays: number;
}

export interface TrustScoreBreakdown {
  ph: number;
  ec: number;
  temp: number;
  ratio: number;
  days: number;
}

export interface TrustScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'F';
  isViable: boolean;
  category: ProductCategory;
  reference: string;
  breakdown: TrustScoreBreakdown;
  notes: string[];
}

// ─── Helpers ───────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const distanceOutside = (
  value: number,
  range: [number, number],
): number => {
  if (value < range[0]) return range[0] - value;
  if (value > range[1]) return value - range[1];
  return 0;
};

/**
 * Returns the A/B/C/F grade for a numeric score.
 * A ≥ 85, B ≥ 70, C ≥ 55, F < 55.
 */
function deriveGrade(score: number): TrustScoreResult['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'F';
}

// ─── Main Scoring Function ────────────────────────────────────

/**
 * Computes the category-aware Trust Score.
 *
 * Each of the 5 components (pH, EC, temperature, ratio, days) is
 * normalised to a 0–1 sub-score where 1 means perfectly within
 * spec and 0 means completely out of spec. The final score is
 * the weighted sum, scaled to 0–100.
 */
export function calculateTrustScore(
  input: TrustScoreInput,
): TrustScoreResult {
  const std = getStandard(input.category);
  const notes: string[] = [];

  // pH sub-score: linear decay from 1.0 at the range edge to 0.0
  // at 1.0 units beyond the range.
  const phDev = distanceOutside(input.pH, std.phRange);
  const phSub = clamp(1 - phDev, 0, 1);

  // EC sub-score: same idea, scaled to 1.0 dS/m beyond range.
  const ecDev = distanceOutside(input.ec, std.ecRange);
  const ecSub = clamp(1 - ecDev, 0, 1);

  // Temperature sub-score: linear decay over 5 °C of headroom.
  const tempDev = distanceOutside(input.temperatureCelsius, std.tempRange);
  const tempSub = clamp(1 - tempDev / 5, 0, 1);

  // Ratio sub-score: 1.0 if within 5% of required, else linear
  // decay to 0 at 50% off.
  const ratioDelta = Math.abs(input.em1Ratio - std.requiredRatio);
  const ratioTolerance = std.requiredRatio * 0.05;
  const ratioSub = std.requiredRatio === 0
    ? 1
    : ratioDelta <= ratioTolerance
      ? 1
      : clamp(1 - (ratioDelta - ratioTolerance) / (std.requiredRatio * 0.5), 0, 1);

  // Days sub-score: 1.0 at the minimum, 1.0 above, ramps in from 0
  // when below.
  const daysRatio = input.fermentationDays / std.minFermentationDays;
  const daysSub = clamp(daysRatio, 0, 1);

  const w = std.weights;
  const weighted =
    phSub * w.ph +
    ecSub * w.ec +
    tempSub * w.temp +
    ratioSub * w.ratio +
    daysSub * w.days;

  const score = Math.round(weighted * 1000) / 10; // one decimal
  const grade = deriveGrade(score);

  if (phSub < 0.5) notes.push('pH outside acceptable band');
  if (ecSub < 0.5) notes.push('EC outside acceptable band');
  if (tempSub < 0.5) notes.push('Temperature outside acceptable band');
  if (ratioSub < 1) notes.push('Microbial ratio off-spec');
  if (daysSub < 1) notes.push('Fermentation days below minimum');

  return {
    score,
    grade,
    isViable: score >= 55,
    category: input.category,
    reference: std.reference,
    breakdown: {
      ph: Math.round(phSub * 1000) / 10,
      ec: Math.round(ecSub * 1000) / 10,
      temp: Math.round(tempSub * 1000) / 10,
      ratio: Math.round(ratioSub * 1000) / 10,
      days: Math.round(daysSub * 1000) / 10,
    },
    notes,
  };
}

// ─── Legacy Shim ───────────────────────────────────────────────

/**
 * Backward-compatible shim for callers that still pass the old
 * BARI-only readings shape. Defaults to category='organic'.
 */
export interface LegacyReadings {
  pH: number;
  ec: number;
  temperatureCelsius: number;
  em1Ratio: number;
  fermentationDays: number;
}

export function calculateTrustScoreLegacy(
  readings: LegacyReadings,
): TrustScoreResult {
  return calculateTrustScore({
    category: 'organic',
    pH: readings.pH,
    ec: readings.ec,
    temperatureCelsius: readings.temperatureCelsius,
    em1Ratio: readings.em1Ratio,
    fermentationDays: readings.fermentationDays,
  });
}

// ─── Re-export for convenience ─────────────────────────────────
export { getStandard, tryGetStandard, PRODUCT_CATEGORIES, isValidBSTICredential } from './standardsRegistry.service';
export type { ProductStandard } from '../types';
