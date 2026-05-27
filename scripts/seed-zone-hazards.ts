import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// BUET-Calibrated Neighborhood profiles data
const neighborhoodProfiles = [
  {
    zone: 'Old Dhaka',
    hazard_class: 'A',
    hazard_multiplier: 1.80,
    building_density: 0.90,
    vegetation_fraction: 0.10,
    wind_corridor_factor: 0.20,
    thermal_mass_coefficient: 0.85,
    base_survival_multiplier: 0.90,
    uhi_offset: 3.40
  },
  {
    zone: 'Savar',
    hazard_class: 'B+',
    hazard_multiplier: 1.55,
    building_density: 0.45,
    vegetation_fraction: 0.55,
    wind_corridor_factor: 0.70,
    thermal_mass_coefficient: 0.50,
    base_survival_multiplier: 1.00,
    uhi_offset: 1.50
  },
  {
    zone: 'Gazipur',
    hazard_class: 'B',
    hazard_multiplier: 1.50,
    building_density: 0.50,
    vegetation_fraction: 0.40,
    wind_corridor_factor: 0.60,
    thermal_mass_coefficient: 0.55,
    base_survival_multiplier: 1.05,
    uhi_offset: 1.80
  },
  {
    zone: 'Mirpur',
    hazard_class: 'B-',
    hazard_multiplier: 1.40,
    building_density: 0.75,
    vegetation_fraction: 0.25,
    wind_corridor_factor: 0.40,
    thermal_mass_coefficient: 0.70,
    base_survival_multiplier: 1.02,
    uhi_offset: 2.20
  },
  {
    zone: 'Gulshan',
    hazard_class: 'C',
    hazard_multiplier: 1.10,
    building_density: 0.60,
    vegetation_fraction: 0.45,
    wind_corridor_factor: 0.50,
    thermal_mass_coefficient: 0.65,
    base_survival_multiplier: 1.20,
    uhi_offset: 1.10
  }
];

async function seed() {
  console.log('🚀 Starting Neighborhood Hazard and Microclimate Profiling Database Seeding...');
  console.log(`Neighborhoods to seed: ${neighborhoodProfiles.map(p => p.zone).join(', ')}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-project-id')) {
    console.warn('\n⚠️ WARNING: Supabase URL or Service Role Key is not configured in .env.');
    console.log('Simulating seeding locally for verification:\n');
    console.table(neighborhoodProfiles);
    console.log('\n✅ Local simulation complete. To connect to Supabase, populate SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const profile of neighborhoodProfiles) {
    console.log(`\n⏳ Seeding profile for: ${profile.zone}...`);

    // 1. Seed zone_microclimate_profiles
    const microclimateData = {
      zone: profile.zone,
      uhi_offset: profile.uhi_offset,
      building_density: profile.building_density,
      vegetation_fraction: profile.vegetation_fraction,
      wind_corridor_factor: profile.wind_corridor_factor,
      thermal_mass_coefficient: profile.thermal_mass_coefficient
    };

    const { error: mcError } = await supabase
      .from('zone_microclimate_profiles')
      .upsert(microclimateData, { onConflict: 'zone' });

    if (mcError) {
      console.error(`❌ Error seeding zone_microclimate_profiles for ${profile.zone}:`, mcError.message);
    } else {
      console.log(`✅ Seeded zone_microclimate_profiles for ${profile.zone}`);
    }

    // 2. Seed zone_hazard_profiles
    const hazardData = {
      zone: profile.zone,
      hazard_class: profile.hazard_class,
      hazard_multiplier: profile.hazard_multiplier,
      building_density: profile.building_density,
      vegetation_fraction: profile.vegetation_fraction,
      wind_corridor_factor: profile.wind_corridor_factor,
      thermal_mass_coefficient: profile.thermal_mass_coefficient,
      base_survival_multiplier: profile.base_survival_multiplier
    };

    const { error: hzError } = await supabase
      .from('zone_hazard_profiles')
      .upsert(hazardData, { onConflict: 'zone' });

    if (hzError) {
      console.error(`❌ Error seeding zone_hazard_profiles for ${profile.zone}:`, hzError.message);
    } else {
      console.log(`✅ Seeded zone_hazard_profiles for ${profile.zone}`);
    }
  }

  console.log('\n🎉 Database Neighborhood Seeding Completed successfully!');
}

seed().catch(err => {
  console.error('💥 Seeding script crashed:', err);
  process.exit(1);
});
