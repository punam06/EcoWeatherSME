import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

import { generateEmbedding } from '../backend/src/lib/services/embedding.service';

// BARI standards knowledge data chunks
const bariStandards = [
  {
    standard_name: 'EM-1 Fermentation Standard (BARI-EM-2025)',
    document_chunk: `EM-1 Bio-Slurry Nutrient Fermentation Standard guidelines from the Bangladesh Agricultural Research Institute (BARI). 
    - Ambient Heat Exposure Limits: EM-1 cultures are highly sensitive to thermal degradation. Maximum safe operating and holding temperatures range between 20°C and 32°C. Exposure to ambient temperatures above 35°C triggers rapid degradation of effective microorganisms (up to 40% microbial die-off).
    - Optimal Fermentation pH Boundaries: Pathologically optimal pH levels must strictly stay between 3.50 and 4.20. Deviation from this range indicates incomplete anaerobic digestion or pathological bacterial infection.
    - Optimal EC (Electrical Conductivity) Boundaries: Stabilized commercial slurry must maintain an EC between 2.0 and 5.0 mS/cm.
    - Pathogen Tolerance: Zero tolerance for Escherichia coli and Salmonella spp.`
  },
  {
    standard_name: 'Soil Carbon Stabilization and Pyrolysis Standard (BARI-CS-2026)',
    document_chunk: `BARI Solid Soil Carbonization and Pyrolysis Standards for Biochar & Organic Soil Enhancers:
    - Fixed Carbon Fraction Index: Solid woody and dry agricultural waste feedstocks processed through thermochemical pyrolysis must achieve a fixed carbon index (carbon fraction) of at least 0.75 (75% fixed carbon) under slow pyrolysis conditions at temperatures of 400°C to 500°C.
    - Carbon Sequestration Molecular Conversion: Fixed carbon is converted to Carbon Dioxide Equivalent (CO2e) metrics using the molecular ratio 44/12 (3.67).
    - 100-Year Permanence Stabilization Rating: Permanence factor (gamma stabilization) is set to 0.95 (95% permanence rating over a 100-year soil carbon sink horizon).
    - Heavy Metal Limits: Lead (Pb) < 120 mg/kg, Cadmium (Cd) < 1.5 mg/kg, Arsenic (As) < 15 mg/kg.`
  }
];

async function seed() {
  console.log('🚀 Starting BARI Standards Knowledge Base Seeding...');
  console.log(`Standards to seed: ${bariStandards.map(s => s.standard_name).join(', ')}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-project-id')) {
    console.warn('\n⚠️ WARNING: Supabase URL or Service Role Key is not configured in .env.');
    console.log('Simulating seeding locally for verification:\n');
    console.log(JSON.stringify(bariStandards, null, 2));
    console.log('\n✅ Local simulation complete. To connect to Supabase, populate SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const doc of bariStandards) {
    console.log(`\n⏳ Seeding standard: ${doc.standard_name}...`);

    // In a production app, we would query OpenAI or another LLM embedding service to get a 1536-dimensional vector.
    // We now use generateEmbedding utility.
    let mockVector: number[] = [];
    try {
      mockVector = await generateEmbedding(doc.document_chunk);
    } catch (err: any) {
      console.error(`❌ Skipping ${doc.standard_name} due to embedding error:`, err.message);
      continue;
    }

    const { error } = await supabase
      .from('compliance_knowledge_base')
      .insert({
        standard_name: doc.standard_name,
        document_chunk: doc.document_chunk,
        embedding: mockVector
      });

    if (error) {
      console.error(`❌ Error seeding ${doc.standard_name}:`, error.message);
    } else {
      console.log(`✅ Seeded ${doc.standard_name} with real 1536-dim vector embeddings.`);
    }
  }

  console.log('\n🎉 BARI Standards Knowledge Seeding Completed successfully!');
}

seed().catch(err => {
  console.error('💥 Seeding script crashed:', err);
  process.exit(1);
});
