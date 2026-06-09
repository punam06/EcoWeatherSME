/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — PREDICTIVE SALE WINDOW ENGINE
 * File: src/lib/services/saleWindow.service.ts
 *
 * Combines live weather, MERM UHI offsets, batch moisture, trust
 * score, and packaging grade to recommend an optimal sale window
 * for SME inventory intake.
 * ═══════════════════════════════════════════════════════════════
 */

import { evaluateExposure, getZoneProfile } from './merm.service';
import { getWeatherByCity } from './weather.service';
import { ProductCategory } from '../types';

// ─── Types ─────────────────────────────────────────────────────

export interface SaleWindowInput {
  zone: string;
  moisturePct: number;
  trustScore: number;
  packagingType: string;
  category?: ProductCategory;
  /** Override ambient temp (e.g. from a pre-fetched weather call). */
  ambientTemperature?: number;
  solarHour?: number;
}

export interface SaleWindowRecommendation {
  best_sale_window: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  days_viable: number;
  /** Diagnostic fields for dashboards / audit logs. */
  diagnostics: {
    ambient_temperature_c: number;
    effective_temperature_c: number;
    uhi_offset_c: number;
    hazard_class: string;
    tst_minutes_base: number;
    tst_minutes_adjusted: number;
    moisture_factor: number;
    quality_factor: number;
    packaging_grade: 'low' | 'mid' | 'high';
    accelerated_degradation: boolean;
    weather_source: 'live' | 'estimated';
  };
}

// ─── Packaging Classification ────────────────────────────────────

const LOW_GRADE_PACKAGING = new Set([
  'standard',
  'basic',
  'open',
  'none',
  'gunny',
  'jute',
  'polythene',
  'loose',
]);

const HIGH_GRADE_PACKAGING = new Set([
  'cold-chain',
  'cold chain',
  'thermal',
  'insulated',
  'vacuum',
  'vacuum-sealed',
  'vacuum sealed',
  'refrigerated',
]);

function classifyPackaging(packagingType: string): 'low' | 'mid' | 'high' {
  const key = packagingType.trim().toLowerCase();
  if (HIGH_GRADE_PACKAGING.has(key)) return 'high';
  if (LOW_GRADE_PACKAGING.has(key) || key === '') return 'low';
  return 'mid';
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// ─── Moisture & Quality Modifiers ─────────────────────────────

/**
 * High moisture accelerates microbial activity and compound
 * volatilisation in Dhaka summer heat. Optimal band ≈ 35–50%.
 */
function moistureRetentionFactor(moisturePct: number): number {
  if (moisturePct <= 40) return 1.0;
  if (moisturePct <= 55) return 0.92;
  if (moisturePct <= 70) return 0.78;
  return clamp(1.0 - (moisturePct - 70) * 0.015, 0.45, 0.78);
}

/**
 * Trust score (0–100) scales baseline compound stability.
 * A grade-A batch (≥85) retains viability longer in storage.
 */
function qualityRetentionFactor(trustScore: number): number {
  return clamp(0.55 + (trustScore / 100) * 0.45, 0.55, 1.0);
}

/**
 * Shaded SME warehouse storage extends transit-oriented TST.
 * CRITICAL UHI zones get a shorter multiplier than green zones.
 */
function shadedStorageMultiplier(
  hazardClass: 'MODERATE' | 'HIGH' | 'CRITICAL',
): number {
  switch (hazardClass) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 7;
    default:
      return 14;
  }
}

/**
 * Accelerated degradation when ambient heat is extreme and
 * packaging cannot buffer thermal spikes.
 *
 * Uses an exponential decay curve keyed off effective temperature.
 */
function acceleratedDegradationFactor(
  effectiveTempC: number,
  packagingGrade: 'low' | 'mid' | 'high',
  ambientTempC: number,
): { factor: number; active: boolean } {
  const isExtremeHeat = ambientTempC > 35 || effectiveTempC > 38;
  if (!isExtremeHeat || packagingGrade !== 'low') {
    return { factor: 1.0, active: false };
  }
  const excess = Math.max(0, effectiveTempC - 35);
  const factor = clamp(Math.exp(-0.12 * excess), 0.25, 0.65);
  return { factor, active: true };
}

function deriveRiskLevel(daysViable: number): SaleWindowRecommendation['risk_level'] {
  if (daysViable >= 10) return 'LOW';
  if (daysViable >= 5) return 'MEDIUM';
  if (daysViable >= 2) return 'HIGH';
  return 'EXTREME';
}

function buildSaleWindowMessage(
  daysViable: number,
  zone: string,
  accelerated: boolean,
  effectiveTempC: number,
  packagingGrade: 'low' | 'mid' | 'high',
): string {
  const roundedDays = Math.max(0.5, Math.round(daysViable * 10) / 10);

  if (roundedDays <= 2) {
    const hours = Math.max(6, Math.round(roundedDays * 24));
    const heatNote = accelerated
      ? 'due to incoming heatwave risks and low-grade packaging accelerating active organic compound drop'
      : `due to elevated microclimate heat (${effectiveTempC.toFixed(1)}°C effective) in ${zone}`;
    return `Sell within ${hours} hours ${heatNote}.`;
  }

  if (roundedDays <= 7) {
    const pkgNote =
      packagingGrade === 'low'
        ? ' — consider shaded storage and fast turnover'
        : '';
    return `Sell within ${Math.ceil(roundedDays)} days — ${zone} UHI exposure is ${effectiveTempC.toFixed(1)}°C effective${pkgNote}.`;
  }

  return `Safe for storage up to ${Math.floor(roundedDays)} days under shaded conditions in ${zone}.`;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Resolves live weather (with Dhaka summer fallback) then runs
 * the MERM engine and batch-specific modifiers to produce an
 * optimal sale window recommendation.
 */
export async function calculateOptimalSaleWindow(
  input: SaleWindowInput,
): Promise<SaleWindowRecommendation> {
  const solarHour = input.solarHour ?? new Date().getHours();
  let ambientTemp = input.ambientTemperature;
  let weatherSource: 'live' | 'estimated' = 'estimated';

  if (ambientTemp === undefined) {
    const weather = await getWeatherByCity('Dhaka', 'en');
    if (weather.found && weather.temperature > 0) {
      ambientTemp = weather.temperature;
      weatherSource = 'live';
    } else {
      ambientTemp = 33;
    }
  } else {
    weatherSource = 'live';
  }

  const zoneProfile = getZoneProfile(input.zone);
  const merm = evaluateExposure({
    zone: input.zone,
    ambientTemperature: ambientTemp,
    solarHour,
  });

  const moistureFactor = moistureRetentionFactor(input.moisturePct);
  const qualityFactor = qualityRetentionFactor(input.trustScore);
  const storageMult = shadedStorageMultiplier(merm.hazardClass);
  const packagingGrade = classifyPackaging(input.packagingType);

  const baseTstMinutes = merm.tstMinutes;
  let adjustedTstMinutes =
    baseTstMinutes * moistureFactor * qualityFactor * storageMult;

  const { factor: degFactor, active: accelerated } = acceleratedDegradationFactor(
    merm.effectiveTemperature,
    packagingGrade,
    ambientTemp,
  );
  adjustedTstMinutes *= degFactor;

  const daysViable = clamp(
    Math.round((adjustedTstMinutes / 1440) * 10) / 10,
    0.5,
    30,
  );

  const riskLevel = deriveRiskLevel(daysViable);

  return {
    best_sale_window: buildSaleWindowMessage(
      daysViable,
      input.zone,
      accelerated,
      merm.effectiveTemperature,
      packagingGrade,
    ),
    risk_level: riskLevel,
    days_viable: daysViable,
    diagnostics: {
      ambient_temperature_c: ambientTemp,
      effective_temperature_c: merm.effectiveTemperature,
      uhi_offset_c: zoneProfile.uhiOffset,
      hazard_class: merm.hazardClass,
      tst_minutes_base: baseTstMinutes,
      tst_minutes_adjusted: Math.round(adjustedTstMinutes),
      moisture_factor: Math.round(moistureFactor * 1000) / 1000,
      quality_factor: Math.round(qualityFactor * 1000) / 1000,
      packaging_grade: packagingGrade,
      accelerated_degradation: accelerated,
      weather_source: weatherSource,
    },
  };
}
