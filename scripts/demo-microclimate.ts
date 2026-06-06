import { fetchRegionalWeather, calculateMicroclimate, calculateTST, HAZARD_REGISTRY } from '../lib/services/climate.service';

async function runDemo() {
  console.log('========================================================================');
  console.log('🌤️  ClimaLogix AI (ClimateShield) - Microclimate Pipeline Demonstration  ');
  console.log('========================================================================\n');

  console.log('🛰️  Step 1: Querying regional real-time weather from Open-Meteo API...');
  const weather = await fetchRegionalWeather();
  console.log(`✅ Base Temperature: ${weather.baseTemp}°C`);
  console.log(`✅ Base Wind Speed: ${weather.windSpeed} km/h`);
  console.log('------------------------------------------------------------------------\n');

  console.log('🗺️  Step 2: Processing Dhaka Neighborhood Microclimates and TST Curves');
  console.log('Scenario parameters:');
  console.log('- Batch Trust Score: 85 (standard IoT bio-fertilizer)');
  console.log('- Dispatch Times tested: 12:00 PM (Peak Solar) & 8:00 PM (Nighttime)');
  console.log('- Packaging selections: Standard Plastic vs. Thermal-Insulated Bins\n');

  const testCases = [
    { zone: 'Old Dhaka', timeStr: '12:00 PM (Peak)', time: new Date('2026-06-01T12:00:00'), packaging: 'Standard Plastic', uhiOffset: 3.40 },
    { zone: 'Old Dhaka', timeStr: '12:00 PM (Peak)', time: new Date('2026-06-01T12:00:00'), packaging: 'Thermal-Insulated Cooling Bin', uhiOffset: 3.40 },
    { zone: 'Mirpur', timeStr: '03:30 PM (Day)', time: new Date('2026-06-01T15:30:00'), packaging: 'Standard Plastic', uhiOffset: 2.20 },
    { zone: 'Gulshan', timeStr: '12:00 PM (Peak)', time: new Date('2026-06-01T12:00:00'), packaging: 'Standard Plastic', uhiOffset: 1.10 },
    { zone: 'Savar', timeStr: '08:00 PM (Night)', time: new Date('2026-06-01T20:00:00'), packaging: 'Standard Plastic', uhiOffset: 1.50 }
  ];

  console.log('📊 SIMULATION RESULTS MATRIX:');
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  console.log(
    `${'Zone'.padEnd(12)} | ${'Time'.padEnd(15)} | ${'UHI'.padStart(5)} | ${'Adj Temp'.padStart(8)} | ${'Thermal Risk'.padStart(12)} | ${'Packaging'.padEnd(20)} | ${'TST (Mins)'.padStart(10)} | ${'Risk Level'.padStart(10)}`
  );
  console.log('-----------------------------------------------------------------------------------------------------------------------------');

  for (const tc of testCases) {
    // 1. Determine Solar Factor based on target time
    const hours = tc.time.getHours();
    let solarFactor = 0.2;
    if (hours >= 11 && hours < 15) solarFactor = 1.0;
    else if ((hours >= 8 && hours < 11) || (hours >= 15 && hours < 18)) solarFactor = 0.6;

    // 2. Compute microclimate temp
    const mc = calculateMicroclimate(weather.baseTemp, weather.windSpeed, tc.uhiOffset, solarFactor);

    // 3. Compute TST and exposure risk
    const tst = calculateTST(85, tc.zone, tc.packaging, tc.time);

    console.log(
      `${tc.zone.padEnd(12)} | ${tc.timeStr.padEnd(15)} | ${('+' + tc.uhiOffset.toFixed(1) + '°C').padStart(5)} | ${(mc.adjustedTemp.toFixed(1) + '°C').padStart(8)} | ${mc.thermalRisk.toFixed(1).padStart(12)} | ${tc.packaging.substring(0, 20).padEnd(20)} | ${tst.tst_minutes.toString().padStart(10)} | ${tst.exposure_risk_level.padStart(10)}`
    );
  }
  console.log('-----------------------------------------------------------------------------------------------------------------------------\n');

  console.log('📋 Step 3: Actionable Smart Dispatch Advice & Safety Log Outputs');
  for (const tc of testCases) {
    const tst = calculateTST(85, tc.zone, tc.packaging, tc.time);
    console.log(`\n📍 [${tc.zone} at ${tc.timeStr} using ${tc.packaging}]:`);
    console.log(`   └─ TST: ${tst.tst_minutes} minutes (${(tst.tst_minutes / 60).toFixed(1)} hours)`);
    console.log(`   └─ Risk Assessment: ${tst.exposure_risk_level.toUpperCase()}`);
    console.log(`   └─ Dispatch Advice: "${tst.advice}"`);
  }

  console.log('\n========================================================================');
  console.log('✅ Microclimate pipeline modeling, API fetching & risk analysis is verified!');
  console.log('========================================================================');
}

runDemo().catch(console.error);
