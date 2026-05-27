import readline from 'readline';
import { fetchRegionalWeather, calculateMicroclimate, calculateTST, HAZARD_REGISTRY } from '../lib/services/climate.service';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string) {
  return new Promise<string>((resolve) => rl.question(query, resolve));
}

async function runInteractive() {
  console.log('Interactive Microclimate Tester');
  console.log('Available zones:', Object.keys(HAZARD_REGISTRY).join(', '));

  const zoneInput = (await question('Zone (default: Old Dhaka): ')).trim() || 'Old Dhaka';
  const zone = Object.keys(HAZARD_REGISTRY).includes(zoneInput) ? zoneInput : 'Old Dhaka';

  const timeStr = (await question('Dispatch time (ISO or HH:MM, default 12:00): ')).trim() || '12:00';
  // parse time into a Date on 2026-06-01
  let dispatchTime = new Date('2026-06-01T12:00:00');
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number);
    dispatchTime = new Date(2026, 5, 1, hh, mm);
  } else if (!isNaN(Date.parse(timeStr))) {
    dispatchTime = new Date(timeStr);
  }

  const packaging = (await question('Packaging (Standard Plastic or Thermal-Insulated Cooling Bin) [default: Standard Plastic]: ')).trim() || 'Standard Plastic';

  const trustRaw = (await question('Batch trust score (1-100, default 85): ')).trim() || '85';
  const trustScore = Math.max(1, Math.min(100, Number(trustRaw)));

  console.log('\nFetching regional weather...');
  const weather = await fetchRegionalWeather();
  console.log(`Base Temperature: ${weather.baseTemp}°C, Wind Speed: ${weather.windSpeed} km/h`);

  // pick a UHI offset from registry (approx)
  const uhiOffset = HAZARD_REGISTRY[zone]?.multiplier ? (HAZARD_REGISTRY[zone].multiplier - 1) * 2 : 1.5;
  const { solarFactor } = (function getSF() {
    const hours = dispatchTime.getHours();
    if (hours >= 11 && hours < 15) return { solarFactor: 1.0 };
    if ((hours >= 8 && hours < 11) || (hours >= 15 && hours < 18)) return { solarFactor: 0.6 };
    return { solarFactor: 0.2 };
  })();

  const mc = calculateMicroclimate(weather.baseTemp, weather.windSpeed, uhiOffset, solarFactor);
  const tst = calculateTST(trustScore, zone, packaging, dispatchTime);

  console.log('\n--- Results ---');
  console.log(`Zone: ${zone}`);
  console.log(`Dispatch Time: ${dispatchTime.toISOString()}`);
  console.log(`Packaging: ${packaging}`);
  console.log(`Trust Score: ${trustScore}`);
  console.log(`Adjusted Temp: ${mc.adjustedTemp}°C`);
  console.log(`Thermal Risk Index: ${mc.thermalRisk}`);
  console.log(`TST (minutes): ${tst.tst_minutes}`);
  console.log(`Exposure Risk Level: ${tst.exposure_risk_level}`);
  console.log(`Advice: ${tst.advice}`);

  rl.close();
}

runInteractive().catch((err) => {
  console.error(err);
  rl.close();
});
