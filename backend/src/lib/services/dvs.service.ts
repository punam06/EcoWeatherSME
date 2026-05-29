/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — DELIVERY VIABILITY SCORE (DVS) SERVICE
 * File: src/lib/services/dvs.service.ts
 *
 * Combines Trust Score and MERM result into a single Delivery
 * Viability Score using weighted formula.
 * ═══════════════════════════════════════════════════════════════
 */

import { MERMResult } from './merm.service';

// ─── Output Type ──────────────────────────────────────────────────────────────

export interface DVSResult {
  /** Final DVS score: 0–100 */
  dvsScore: number;
  /** true if DVS ≥ 60 */
  deliveryApproved: boolean;
  /** Contribution from trust score component (weight 0.6) */
  trustScoreWeight: number;
  /** Contribution from climate/TST component (weight 0.4) */
  climateScoreWeight: number;
  /** Human-readable dispatch advice */
  recommendation: string;
}

// ─── DVS Formula ─────────────────────────────────────────────────────────────

/**
 * Calculates the Delivery Viability Score.
 *
 * DVS = (trustScore × 0.6) + (tstMinutes / 480 × 100 × 0.4)
 *
 * @param trustScore - Bio-asset quality trust score (0–100)
 * @param mermResult - Full MERM evaluation result
 * @returns DVS result with approval status and recommendation
 */
export function calculateDVS(trustScore: number, mermResult: MERMResult): DVSResult {
  // ── Trust score component (60% weight) ────────────────────
  const trustScoreWeight = parseFloat((trustScore * 0.6).toFixed(4));

  // ── Climate / TST component (40% weight) ──────────────────
  // Normalize TST to [0, 100]: max TST is 480 minutes (8 hours)
  const normalizedTST = Math.min(mermResult.tstMinutes / 480, 1) * 100;
  const climateScoreWeight = parseFloat((normalizedTST * 0.4).toFixed(4));

  // ── Final DVS ─────────────────────────────────────────────
  const rawDVS = trustScoreWeight + climateScoreWeight;
  const dvsScore = parseFloat(Math.min(100, Math.max(0, rawDVS)).toFixed(2));

  const deliveryApproved = dvsScore >= 60;

  // ── Human-Readable Recommendation ─────────────────────────
  const recommendation = buildRecommendation(
    dvsScore,
    deliveryApproved,
    mermResult,
    trustScore
  );

  return {
    dvsScore,
    deliveryApproved,
    trustScoreWeight,
    climateScoreWeight,
    recommendation,
  };
}

// ─── Recommendation Builder ───────────────────────────────────────────────────

function buildRecommendation(
  dvsScore: number,
  deliveryApproved: boolean,
  mermResult: MERMResult,
  trustScore: number
): string {
  const { zone, hazardClass, tstMinutes, exposureRiskLevel, dispatchWindow } = mermResult;

  if (dvsScore >= 85) {
    return (
      `✅ OPTIMAL — DVS ${dvsScore.toFixed(0)}: ${zone} zone is safe for immediate dispatch. ` +
      `TST is ${tstMinutes.toFixed(0)} min (${exposureRiskLevel} exposure). ` +
      `Recommended window: ${dispatchWindow.recommended}.`
    );
  }

  if (dvsScore >= 70) {
    return (
      `🟡 GOOD — DVS ${dvsScore.toFixed(0)}: ${zone} zone is suitable for dispatch with standard precautions. ` +
      `TST ${tstMinutes.toFixed(0)} min. Schedule within: ${dispatchWindow.recommended}.`
    );
  }

  if (deliveryApproved) {
    return (
      `⚠️ CAUTION — DVS ${dvsScore.toFixed(0)}: ${zone} is a ${hazardClass} hazard zone. ` +
      `TST only ${tstMinutes.toFixed(0)} min. Dispatch before ${dispatchWindow.deadline}. ` +
      `Consider insulated packaging to extend thermal survival time.`
    );
  }

  // DVS < 60 — not approved
  if (trustScore < 55) {
    return (
      `❌ REJECTED — DVS ${dvsScore.toFixed(0)}: Bio-asset quality is below the minimum threshold (Trust Score: ${trustScore}). ` +
      `Improve fermentation parameters before attempting dispatch.`
    );
  }

  return (
    `❌ REJECTED — DVS ${dvsScore.toFixed(0)}: ${zone} (${hazardClass}) poses EXTREME transit risk. ` +
    `Current TST is only ${tstMinutes.toFixed(0)} min. Delay dispatch to ${dispatchWindow.recommended} ` +
    `or upgrade to thermal-insulated bins.`
  );
}
