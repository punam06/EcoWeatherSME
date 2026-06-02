import { ESGMetrics } from '../types';

/**
 * Calculates standard plastic packaging containers saved via bulk-refill stations
 * and translates it into physical PET weight offset.
 *
 * @param volumesRefilled Liters of bio-slurry refilled across batches
 * @returns Plastic weight offset in kilograms (rounded to nearest integer)
 */
export function calculatePlasticOffset(volumesRefilled: number[]): number {
  const standardVolume = 0.25; // 0.25 Liters standard container volume
  const averagePetWeightKg = 0.015; // 15 grams per standard bottle

  const bottlesSaved = volumesRefilled.reduce((acc, vol) => acc + (vol / standardVolume), 0);
  return Math.round(bottlesSaved * averagePetWeightKg);
}

/**
 * Translates thermochemical solid carbonization (pyrolysis) into CO2-equivalent metrics.
 *
 * @param massBiocharProduced Mass of solid biochar produced in kilograms
 * @returns Carbon sequestered in kg CO2e (rounded to nearest integer)
 */
export function calculateCarbonSequestration(massBiocharProduced: number): number {
  const carbonFractionIndex = 0.75; // Carbon fraction index under 450°C slow pyrolysis
  const co2ToCarbonRatio = 44 / 12; // Molecular mass ratio to convert carbon to CO2
  const permanenceFactor = 0.95; // Permanence stabilization rating over a 100-year soil horizon

  return Math.round(massBiocharProduced * carbonFractionIndex * co2ToCarbonRatio * permanenceFactor);
}

/**
 * Measures regional financial losses averted using the platform's smart dispatch scheduler.
 *
 * @param shipmentsCount Number of shipments scheduled complying with DVS
 * @returns Financial losses averted in BDT (rounded to nearest integer)
 */
export function calculateSpoilageAverted(shipmentsCount: number): number {
  const baseValueBdt = 15000; // Median market value of biological batches
  const degradationRate = 0.40; // Loss coefficient if shipped during extreme UHI heat without DVS insulation
  const smartWindowCompliance = 0.90; // Fraction of delivery shipments conforming with the scheduler

  return Math.round(shipmentsCount * baseValueBdt * degradationRate * smartWindowCompliance);
}

/**
 * Aggregates all ESG circular economy performance metrics for reporting
 *
 * @param month Reporting month format "YYYY-MM"
 * @param volumesRefilled List of refilled slurry volumes in liters
 * @param biocharKg Mass of biochar produced in kilograms
 * @param compliantShipmentsCount Number of smart shipments completed
 * @returns Full ESG metrics object
 */
export function compileESGMetrics(
  month: string,
  volumesRefilled: number[],
  biocharKg: number,
  compliantShipmentsCount: number
): ESGMetrics {
  const plastic_offset_kg = calculatePlasticOffset(volumesRefilled);
  const carbon_sequestered_kg = calculateCarbonSequestration(biocharKg);
  const spoilage_prevented_bdt = calculateSpoilageAverted(compliantShipmentsCount);

  // Derived circular economy metrics matching backend logic
  const water_saved_l = Math.round(volumesRefilled.reduce((acc, v) => acc + v, 0) * 18.5);
  const waste_reduced_kg = Math.round(biocharKg * 1.2);

  // Default baseline score variables
  const trust_score = 85;
  const dvs_score = 80;

  const e_score = Math.min(100, Math.round((trust_score * 0.5) + (dvs_score * 0.5)));
  const s_score = Math.min(100, Math.round((trust_score * 0.4) + 54));
  const g_score = Math.min(100, Math.round((trust_score * 0.6) + 38));
  const esg_score = Math.round((e_score + s_score + g_score) / 3);

  return {
    month,
    spoilage_prevented_bdt,
    plastic_offset_kg,
    carbon_sequestered_kg,
    water_saved_l,
    waste_reduced_kg,
    e_score,
    s_score,
    g_score,
    esg_score,
    trust_score,
    dvs_score
  };
}
