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
}

export interface IoTReadings {
  pH: number;
  EC: number;
  temp: number;
  em1_ratio: string;
  fermentation_days: number;
}

