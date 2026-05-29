/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — TRUST SCORE ENGINE
 * File: src/lib/services/trustScore.service.ts
 *
 * Deterministic, pure mathematical scoring function.
 * Starts at 100 and subtracts penalties per BARI specification.
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Input / Output Types ────────────────────────────────────────────────────

export interface TrustScoreInput {
  /** pH of the biological material — ideal range: 6.5–7.5 */
  pH: number;
  /** Electrical Conductivity in dS/m — ideal range: 1.5–3.5 */
  ec: number;
  /** Temperature in Celsius — ideal range: 25–35 */
  temperatureCelsius: number;
  /**
   * EM-1 Ratio expressed as a decimal:
   *   1:500  → 0.002
   *   1:1000 → 0.001
   *   1:2000 → 0.0005
   */
  em1Ratio: number;
  /** Fermentation duration in days — minimum: 21 */
  fermentationDays: number;
}

export interface TrustScorePenalties {
  phPenalty: number;
  ecPenalty: number;
  temperaturePenalty: number;
  em1Penalty: number;
  fermentationPenalty: number;
}

export interface TrustScoreResult {
  /** Final score clamped to [0, 100] */
  score: number;
  /** "A" ≥ 85, "B" ≥ 70, "C" ≥ 55, "F" < 55 */
  grade: string;
  /** Itemised breakdown of every deduction */
  penalties: TrustScorePenalties;
  /** true if score ≥ 55 */
  isViable: boolean;
}

// ─── Approved EM-1 ratio values ──────────────────────────────────────────────

const APPROVED_EM1_RATIOS: ReadonlySet<number> = new Set([
  0.002,  // 1:500
  0.001,  // 1:1000
  0.0005, // 1:2000
]);

// ─── Ideal parameter ranges ───────────────────────────────────────────────────

const PH_LOW = 6.5;
const PH_HIGH = 7.5;
const EC_LOW = 1.5;
const EC_HIGH = 3.5;
const TEMP_LOW = 25;
const TEMP_HIGH = 35;
const FERM_MIN = 21;

// ─── Penalty rate constants ───────────────────────────────────────────────────

const PH_PENALTY_PER_0_1_UNIT = 2;    // −2 pts per 0.1 unit outside ideal
const EC_PENALTY_PER_0_5_DSPM = 3;    // −3 pts per 0.5 dS/m outside ideal
const TEMP_PENALTY_PER_DEGREE = 1.5;  // −1.5 pts per °C outside ideal
const EM1_PENALTY = 10;               // −10 pts if ratio not in approved list
const FERM_PENALTY_PER_DAY = 4;       // −4 pts per day below 21

// ─── Grade thresholds ─────────────────────────────────────────────────────────

function deriveGrade(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'F';
}

// ─── Main calculation function ────────────────────────────────────────────────

/**
 * Calculates the BARI-aligned Trust Score for a biological batch.
 *
 * @param readings - IoT sensor readings and fermentation metadata
 * @returns Structured score result with penalties breakdown
 */
export function calculateTrustScore(readings: TrustScoreInput): TrustScoreResult {
  const { pH, ec, temperatureCelsius, em1Ratio, fermentationDays } = readings;

  // ── 1. pH Penalty ──────────────────────────────────────────
  // −2 points per 0.1 unit outside [6.5, 7.5]
  let phDeviation = 0;
  if (pH < PH_LOW) {
    phDeviation = PH_LOW - pH;
  } else if (pH > PH_HIGH) {
    phDeviation = pH - PH_HIGH;
  }
  // Convert deviation to units of 0.1 and multiply by penalty rate
  const phPenalty = parseFloat((Math.round(phDeviation / 0.1) * PH_PENALTY_PER_0_1_UNIT).toFixed(4));

  // ── 2. EC Penalty ──────────────────────────────────────────
  // −3 points per 0.5 dS/m outside [1.5, 3.5]
  let ecDeviation = 0;
  if (ec < EC_LOW) {
    ecDeviation = EC_LOW - ec;
  } else if (ec > EC_HIGH) {
    ecDeviation = ec - EC_HIGH;
  }
  // Convert deviation to units of 0.5 dS/m and multiply by penalty rate
  const ecPenalty = parseFloat((Math.round(ecDeviation / 0.5) * EC_PENALTY_PER_0_5_DSPM).toFixed(4));

  // ── 3. Temperature Penalty ─────────────────────────────────
  // −1.5 points per °C outside [25, 35]
  let tempDeviation = 0;
  if (temperatureCelsius < TEMP_LOW) {
    tempDeviation = TEMP_LOW - temperatureCelsius;
  } else if (temperatureCelsius > TEMP_HIGH) {
    tempDeviation = temperatureCelsius - TEMP_HIGH;
  }
  const temperaturePenalty = parseFloat((tempDeviation * TEMP_PENALTY_PER_DEGREE).toFixed(4));

  // ── 4. EM-1 Ratio Penalty ──────────────────────────────────
  // −10 points if ratio not in approved set
  // Use approximate comparison with tolerance to handle floating point
  const em1IsApproved = [...APPROVED_EM1_RATIOS].some(
    (approved) => Math.abs(em1Ratio - approved) < 1e-9
  );
  const em1Penalty = em1IsApproved ? 0 : EM1_PENALTY;

  // ── 5. Fermentation Days Penalty ───────────────────────────
  // −4 points per day below 21 (no penalty at or above 21)
  const daysBelow21 = Math.max(0, FERM_MIN - fermentationDays);
  const fermentationPenalty = daysBelow21 * FERM_PENALTY_PER_DAY;

  // ── Final Score ────────────────────────────────────────────
  const rawScore =
    100 - phPenalty - ecPenalty - temperaturePenalty - em1Penalty - fermentationPenalty;

  const score = Math.max(0, parseFloat(rawScore.toFixed(2)));

  return {
    score,
    grade: deriveGrade(score),
    penalties: {
      phPenalty,
      ecPenalty,
      temperaturePenalty,
      em1Penalty,
      fermentationPenalty,
    },
    isViable: score >= 55,
  };
}
