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

// ── Trust Layer v2 — category-aware standards ────────────────────────────
export type ProductCategory =
  | 'organic'      // BARI EM-1 biofertilizer (existing hardcoded path)
  | 'retail'       // Packaged FMCG goods (shelf-life, packaging integrity)
  | 'pharma'       // DGDA-regulated medicines (cold chain, contamination)
  | 'dairy'        // Pasteurized milk/dairy (CFU, temperature, fat%)
  | 'manufacturing'; // Industrial chemicals, lubricants (ppm, viscosity)

export type QAReportSource = 'iot' | 'inspector' | 'manufacturer';

export interface ProductStandard {
  category: ProductCategory;
  displayName: string;
  /** Optimal pH range [min, max]. Use null when pH is not applicable. */
  phRange: [number, number] | null;
  /** Optimal EC range (dS/m) [min, max]. Use null when not applicable. */
  ecRange: [number, number] | null;
  /** Optimal temperature range (°C) [min, max]. */
  tempRange: [number, number];
  /** Required EM-1 / culture ratio. null when not applicable. */
  requiredRatio: string | null;
  /** Minimum fermentation / maturation days before release. */
  minFermentationDays: number;
  /** Maximum fermentation days (over-aged penalty). */
  maxFermentationDays: number;
  /** If true, source MUST be 'inspector' with a valid BSTI credential. */
  requiresBSTI: boolean;
  /** Penalty weights per dimension (sums do not need to be 1.0). */
  weights: {
    ph: number;
    ec: number;
    temp: number;
    ratio: number;
    days: number;
  };
}

export interface QAReport {
  id?: string;
  batch_id: string;
  category: ProductCategory;
  source: QAReportSource;
  /** Raw metric readings in the format the registry expects for this category. */
  metrics: IoTReadings;
  /** SHA-256 signature of the canonicalized metrics JSON, lowercase hex. */
  signature: string;
  /** Required when source === 'inspector'. Must match /^BSTI-\d{4,}$/. */
  bsti_credential?: string;
  /** Optional human-readable note from inspector/manufacturer. */
  note?: string;
  submitted_at?: Date;
  submitted_by?: string; // Supabase auth user id, if any
}

export interface ProvenanceEvent {
  id?: string;
  batch_id: string;
  event_type: 'qa' | 'dispatch' | 'delivery';
  /** Free-form event payload; the hash is computed over canonical JSON. */
  event_data: Record<string, unknown>;
  prev_hash: string | null; // null only for the genesis event
  current_hash: string;
  created_at?: Date;
  actor?: string; // user id or "system"
}

export interface ProvenanceChain {
  batch_id: string;
  events: ProvenanceEvent[];
  /** True if every event's stored current_hash matches a fresh recomputation. */
  is_tamper_free: boolean;
  /** Index of the first tampered event, if any. */
  first_tampered_index: number | null;
}

