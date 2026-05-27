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
  return {
    month,
    spoilage_prevented_bdt: calculateSpoilageAverted(compliantShipmentsCount),
    plastic_offset_kg: calculatePlasticOffset(volumesRefilled),
    carbon_sequestered_kg: calculateCarbonSequestration(biocharKg)
  };
}
