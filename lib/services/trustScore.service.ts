/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — TRUST SCORE (Trust Layer v2, category-aware)
 * File: lib/services/trustScore.service.ts
 *
 * Deterministic, BARI-aligned quality trust score (0-100) for any
 * product category registered in standardsRegistry. Replaces the
 * previous hardcoded BARI EM-1 ranges with a registry-driven design
 * so the same function scores organic biofertilizer, retail FMCG,
 * pharma, dairy, and industrial chemicals.
 *
 * Backward compatibility:
 *   - calculateTrustScore(readings) defaults to category='organic',
 *     so the existing /api/calculate-trust-score and /api/clever-responder
 *     routes continue to behave exactly as before.
 * ═══════════════════════════════════════════════════════════════
 */

import { IoTReadings, ProductCategory } from '../types';
import { getStandard } from './standardsRegistry.service';

export interface TrustScoreResult {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  isViable: boolean;
  category: ProductCategory;
  /** Per-dimension deltas so the UI can show "why this score". */
  breakdown: {
    ph: number;
    ec: number;
    temp: number;
    ratio: number;
    days: number;
  };
}

/**
 * Computes a 0-100 trust score for the given readings under the
 * standards of the supplied product category. Pure function — no I/O.
 */
export function calculateTrustScore(
  readings: IoTReadings,
  category: ProductCategory = 'organic'
): TrustScoreResult {
  const std = getStandard(category);

  let score = 100;
  const breakdown = { ph: 0, ec: 0, temp: 0, ratio: 0, days: 0 };

  // ── 1. pH penalty (skipped when category has no pH range) ─────────────
  if (std.phRange) {
    const [pMin, pMax] = std.phRange;
    if (readings.pH < pMin) {
      const penalty = Math.min(25, (pMin - readings.pH) * std.weights.ph);
      score -= penalty;
      breakdown.ph = -Math.round(penalty);
    } else if (readings.pH > pMax) {
      const penalty = Math.min(25, (readings.pH - pMax) * (std.weights.ph * 0.7));
      score -= penalty;
      breakdown.ph = -Math.round(penalty);
    }
  }

  // ── 2. EC penalty (skipped when category has no EC range) ────────────
  if (std.ecRange) {
    const [eMin, eMax] = std.ecRange;
    if (readings.EC < eMin) {
      const penalty = Math.min(20, (eMin - readings.EC) * std.weights.ec);
      score -= penalty;
      breakdown.ec = -Math.round(penalty);
    } else if (readings.EC > eMax) {
      const penalty = Math.min(20, (readings.EC - eMax) * (std.weights.ec * 0.6));
      score -= penalty;
      breakdown.ec = -Math.round(penalty);
    }
  }

  // ── 3. Temperature penalty ───────────────────────────────────────────
  const [tMin, tMax] = std.tempRange;
  if (readings.temp < tMin) {
    const penalty = Math.min(15, (tMin - readings.temp) * std.weights.temp);
    score -= penalty;
    breakdown.temp = -Math.round(penalty);
  } else if (readings.temp > tMax) {
    const penalty = Math.min(20, (readings.temp - tMax) * (std.weights.temp * 1.1));
    score -= penalty;
    breakdown.temp = -Math.round(penalty);
  }

  // ── 4. EM-1 / culture ratio penalty (skipped when not required) ──────
  if (std.requiredRatio && readings.em1_ratio !== std.requiredRatio) {
    const penalty = std.weights.ratio;
    score -= penalty;
    breakdown.ratio = -Math.round(penalty);
  }

  // ── 5. Fermentation / maturation days penalty ────────────────────────
  if (readings.fermentation_days < std.minFermentationDays) {
    const penalty = (std.minFermentationDays - readings.fermentation_days) * std.weights.days;
    score -= penalty;
    breakdown.days = -Math.round(penalty);
  } else if (readings.fermentation_days > std.maxFermentationDays) {
    const penalty = (readings.fermentation_days - std.maxFermentationDays) * (std.weights.days * 0.5);
    score -= penalty;
    breakdown.days = -Math.round(penalty);
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    grade: gradeFor(finalScore),
    isViable: finalScore >= 60,
    category,
    breakdown,
  };
}

function gradeFor(score: number): TrustScoreResult['grade'] {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'F';
}

// ── Legacy compatibility shim ─────────────────────────────────────────────
// The old /api/calculate-trust-score route and the clever-responder
// expect a plain number. We keep that behavior for organic batches.
export function calculateTrustScoreLegacy(readings: IoTReadings): number {
  return calculateTrustScore(readings, 'organic').score;
}
