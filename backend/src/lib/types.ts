/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — SHARED LIBRARY TYPES (BACKEND)
 * File: src/lib/types.ts
 *
 * Core domain types. The legacy types below are preserved for
 * backward compatibility with the original trust-score route.
 * Trust Layer v2 (category-aware) types are added at the bottom.
 * ═══════════════════════════════════════════════════════════════
 */

export interface MicroclimateProfile {
  id?: string;
  zone: string;
  uhi_offset: number;
  building_density: number;
  vegetation_fraction: number;
  wind_corridor_factor: number;
  thermal_mass_coefficient: number;
  created_at?: Date;
}

export interface ZoneHazardProfile {
  id?: string;
  zone: string;
  hazard_class: string;
  hazard_multiplier: number;
  building_density: number;
  vegetation_fraction: number;
  wind_corridor_factor: number;
  thermal_mass_coefficient: number;
  base_survival_multiplier: number;
  created_at?: Date;
}

export interface MicroclimateCalculation {
  zone: string;
  base_temp: number;
  wind_speed: number;
  solar_factor: number;
  adjusted_temp: number;
  thermal_risk: number;
}

export interface DVSResult {
  tst_minutes: number;
  exposure_risk_level: 'Low' | 'Medium' | 'High';
  is_viable: boolean;
  advice: string;
}

export interface ESGMetrics {
  month: string;
  spoilage_prevented_bdt: number;
  plastic_offset_kg: number;
  carbon_sequestered_kg: number;
  water_saved_l: number;
  waste_reduced_kg: number;
  e_score: number;
  s_score: number;
  g_score: number;
  esg_score: number;
  trust_score: number;
  dvs_score: number;
}

export interface IoTReadings {
  pH: number;
  EC: number;
  temp: number;
  em1_ratio: string;
  fermentation_days: number;
}

export type SMEType = 'Agro' | 'Retail' | 'Manufacturing';

export interface ElNinoAlert {
  alertLevel: 'Normal' | 'Watch' | 'Warning' | 'Emergency';
  ensoIndex: number;
  expectedImpacts: string[];
  recommendedActions: string[];
}

export interface SpotPricingResponse {
  batchId: string;
  productName: string;
  basePrice: number;
  discountedPrice: number;
  discountPercent: number;
  tstMinutes: number;
  riskTier: 'high' | 'medium' | 'safe';
  riskLabel: string;
  warningMessage: string;
  currency: string;
}

// ─── Trust Layer v2 — Category-Aware Types ─────────────────────

/**
 * Product categories that have distinct regulatory / quality
 * standards. Adding a new category requires adding an entry to
 * `STANDARDS` in `standardsRegistry.service.ts`.
 */
export type ProductCategory =
  | 'organic'
  | 'retail'
  | 'pharma'
  | 'dairy'
  | 'manufacturing';

export interface ProductStandard {
  category: ProductCategory;
  /** Display label, e.g. "Organic Compost (BARI aligned)" */
  label: string;
  /** Acceptable pH range [low, high] */
  phRange: [number, number];
  /** Acceptable electrical conductivity dS/m [low, high] */
  ecRange: [number, number];
  /** Acceptable temperature Celsius [low, high] */
  tempRange: [number, number];
  /** EM-1 or microbial ratio required for biological safety */
  requiredRatio: number;
  /** Minimum fermentation / curing / maturation days */
  minFermentationDays: number;
  /** Whether a BSTI license number is required for compliance */
  requiresBSTI: boolean;
  /** Citable regulatory reference (BARI / BSTI / DGDA etc.) */
  reference: string;
  /** Weights for the 5 scoring components (sum should be 1.0) */
  weights: {
    ph: number;
    ec: number;
    temp: number;
    ratio: number;
    days: number;
  };
}

export type QAReportSource = 'iot' | 'inspector' | 'manufacturer';

export interface QAReport {
  id?: string;
  batch_id: string;
  source: QAReportSource;
  category: ProductCategory;
  metrics: {
    pH: number;
    ec: number;
    temp: number;
    em1Ratio: number;
    fermentationDays: number;
  };
  /** Optional BSTI license when required by the category */
  bstiCredential?: string;
  /** Optional inspector notes (free text) */
  inspectorNotes?: string;
  /** SHA-256 of canonical metrics, signed at ingest time */
  signature: string;
  signed_at: string;
  signed_by?: string;
}

export type ProvenanceEventType =
  | 'genesis'
  | 'qa_ingested'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'verified'
  | 'flagged';

export interface ProvenanceEvent {
  seq: number;
  type: ProvenanceEventType;
  actor?: string;
  data: Record<string, unknown>;
  prev_hash: string;
  current_hash: string;
  timestamp: string;
}

export interface ProvenanceChain {
  batch_id: string;
  events: ProvenanceEvent[];
  /** SHA-256 of the last event — used as the chain fingerprint */
  head_hash: string;
  /** true if recomputed hashes match all stored current_hash values */
  verified: boolean;
}

