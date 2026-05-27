import { calculateMicroclimate, calculateTST } from '../lib/services/climate.service';
import { calculatePlasticOffset, calculateCarbonSequestration, calculateSpoilageAverted } from '../lib/services/esg.service';

function runTests() {
  console.log('🧪 Starting EcoSortha AI Mathematical Engine Test Suite...\n');

  let passed = true;

  // ----------------------------------------------------
  // TEST 1: TST Equation Verification (Peak Solar Test Case)
  // ----------------------------------------------------
  try {
    console.log('--- Test 1: TST Equation Verification (Old Dhaka Peak Solar) ---');
    const trustScore = 85;
    const zone = 'Old Dhaka'; // Hazard Multiplier = 1.80, Base Survival = 0.90
    const packaging = 'Standard Plastic'; // Factor = 1.0
    const dispatchTime = new Date('2026-06-01T12:00:00'); // 12:00 PM -> Peak Solar Multiplier = 1.5

    const result = calculateTST(trustScore, zone, packaging, dispatchTime);

    console.log(`TST Calculated minutes: ${result.tst_minutes}`);
    console.log(`Expected minutes: 1700`);
    console.log(`Exposure Risk: ${result.exposure_risk_level}`);
    console.log(`Viable: ${result.is_viable}`);
    console.log(`Advice: "${result.advice}"`);

    if (result.tst_minutes === 1700) {
      console.log('✅ TEST 1 PASSED: TST is exactly 1700 minutes!\n');
    } else {
      console.error('❌ TEST 1 FAILED: TST mismatch!\n');
      passed = false;
    }
  } catch (error) {
    console.error('❌ TEST 1 CRASHED:', error);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 2: Microclimate Adjusted Temperature Formula
  // ----------------------------------------------------
  try {
    console.log('--- Test 2: Microclimate Adjusted Temperature ---');
    const baseTemp = 31.0;
    const windSpeed = 8.0; // <= 15 km/h -> Wcooling = 0.0
    const uhiOffset = 2.2; // Mirpur UHI Offset
    const solarFactor = 0.6; // Standard daylight hour

    const result = calculateMicroclimate(baseTemp, windSpeed, uhiOffset, solarFactor);

    // Formula: AdjustedTemp = 31.0 + (2.2 * 0.6) - 0.0 = 31.0 + 1.32 = 32.32
    console.log(`Base Temp: ${baseTemp}°C`);
    console.log(`UHI Offset: ${uhiOffset}°C`);
    console.log(`Adjusted Temp: ${result.adjustedTemp}°C`);
    console.log(`Thermal Risk Index: ${result.thermalRisk}`);

    if (result.adjustedTemp === 32.32 && result.thermalRisk === 0.5) {
      console.log('✅ TEST 2 PASSED: Microclimate temperature and risk match exactly!\n');
    } else {
      console.error('❌ TEST 2 FAILED: Value mismatch!\n');
      passed = false;
    }
  } catch (error) {
    console.error('❌ TEST 2 CRASHED:', error);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 3: ESG Metrics Calculations
  // ----------------------------------------------------
  try {
    console.log('--- Test 3: ESG Metric Mathematical Equations ---');
    
    // A. Plastic Bottle Offset
    // Volumes: [5.0, 10.0, 2.5] Liters. Total volume = 17.5 Liters.
    // Standard volume = 0.25L -> 17.5 / 0.25 = 70 bottles refilled.
    // Standard PET weight = 0.015 kg -> 70 * 0.015 = 1.05 kg -> Math.round -> 1 kg offset.
    const refilledVolumes = [5.0, 10.0, 2.5];
    const plasticOffset = calculatePlasticOffset(refilledVolumes);
    console.log(`Plastic PET Bottle Offset: ${plasticOffset} kg`);
    
    // B. Carbon Sequestration
    // Mass: 100 kg biochar. Formula: Math.round(100 * 0.75 * (44/12) * 0.95) = Math.round(100 * 0.75 * 3.6667 * 0.95) = Math.round(261.25) = 261 kg CO2e
    const biocharMass = 100;
    const carbonSeq = calculateCarbonSequestration(biocharMass);
    console.log(`Carbon Dioxide Equivalent Sequestered: ${carbonSeq} kg CO2e`);

    // C. Prevented Biological Spoilage (BDT)
    // Shipments: 5 shipments. Formula: Math.round(5 * 15000 * 0.40 * 0.90) = Math.round(27000) = BDT 27,000
    const shipmentsCount = 5;
    const spoilageAverted = calculateSpoilageAverted(shipmentsCount);
    console.log(`Spoilage Averted (BDT): ${spoilageAverted} BDT`);

    if (plasticOffset === 1 && carbonSeq === 261 && spoilageAverted === 27000) {
      console.log('✅ TEST 3 PASSED: All ESG circular equations verified with correct rounding!\n');
    } else {
      console.error('❌ TEST 3 FAILED: ESG metrics calculations incorrect!\n');
      passed = false;
    }
  } catch (error) {
    console.error('❌ TEST 3 CRASHED:', error);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 4: Deterministic BARI Trust Score Penalties
  // ----------------------------------------------------
  try {
    console.log('--- Test 4: BARI Trust Score Penality Calculation ---');
    const { calculateTrustScore } = require('../lib/services/trustScore.service');
    
    // Ideal readings: pH=4.1, EC=3.4, temp=28.0, em1_ratio='1:1:20', fermentation_days=9
    // Expected score: 100
    const idealScore = calculateTrustScore({
      pH: 4.1,
      EC: 3.4,
      temp: 28.0,
      em1_ratio: '1:1:20',
      fermentation_days: 9
    });
    console.log(`Ideal Readings Trust Score: ${idealScore} (Expected: 100)`);

    // Faulty readings: pH=3.0 (loss of 15), fermentation_days=5 (loss of 20)
    // Expected score: 100 - 15 - 20 = 65
    const faultyScore = calculateTrustScore({
      pH: 3.0,
      EC: 3.4,
      temp: 28.0,
      em1_ratio: '1:1:20',
      fermentation_days: 5
    });
    console.log(`Faulty Readings Trust Score: ${faultyScore} (Expected: 65)`);

    if (idealScore === 100 && faultyScore === 65) {
      console.log('✅ TEST 4 PASSED: Trust Score penalties matching BARI specification!\n');
    } else {
      console.error('❌ TEST 4 FAILED: Trust Score mismatch!\n');
      passed = false;
    }
  } catch (error) {
    console.error('❌ TEST 4 CRASHED:', error);
    passed = false;
  }

  // ----------------------------------------------------
  // FINAL SCORE & SUMMARY
  // ----------------------------------------------------
  console.log('==================================================');
  if (passed) {
    console.log('🏆 ALL TESTS PASSED: EcoSortha AI Core Math Engines are 100% verified and type-safe.');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Review calculations and float constraints.');
    process.exit(1);
  }
  console.log('==================================================');
}

runTests();

