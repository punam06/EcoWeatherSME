/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — SEED BARI KNOWLEDGE
 * File: scripts/seedBARIKnowledge.ts
 *
 * Seed script to push the standard BARI compliance context blocks
 * into Supabase's bari_knowledge_chunks table.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../backend/src/lib/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BARI_CHUNKS = [
  {
    content:
      'BARI pH Standards for Organic Compost (BARI-OC-2024): The optimal pH range for certified organic compost and bio-slurry is 6.5 to 7.5. pH below 6.5 indicates excessive acidity which inhibits microbial activity. pH above 7.5 leads to ammonia volatilisation and reduced phosphorus solubility. Each 0.1 unit deviation from the ideal range incurs a −2 point trust penalty.',
    category: 'pH Standards',
  },
  {
    content:
      'BARI Electrical Conductivity Standards for Bio-Fertilizer Viability (BARI-EC-2025): Ideal EC range for EM-1 bio-fertilizer: 1.5–3.5 dS/m (equivalent to 1500–3500 µS/cm). EC below 1.5 dS/m indicates insufficient nutrient concentration. EC above 3.5 dS/m creates osmotic stress that suppresses plant root development. Critical threshold: EC > 5.0 dS/m renders product non-viable for organic certification. Each 0.5 dS/m deviation incurs a −3 point trust score penalty.',
    category: 'EC Thresholds',
  },
  {
    content:
      'BARI EM-1 Fermentation Standard (BARI-EM-2025): Approved EM-1 application ratios: 1:500 (0.002), 1:1000 (0.001), and 1:2000 (0.0005). Any ratio outside these three approved values is non-compliant and incurs −10 trust penalty. Minimum fermentation duration: 21 days to ensure complete anaerobic transformation. Each day below the 21-day minimum incurs −4 points.',
    category: 'EM-1 Fermentation',
  },
  {
    content:
      'BARI Temperature Safety Guidelines for Organic Transit in Bangladesh (BARI-TS-2024): Safe storage temperature range: 25–35°C for bio-slurry and EM-1 products. Below 25°C: microbial activity slows, reducing biological effectiveness. Above 35°C: accelerated protein denaturation and pathogen growth risk. Each 1°C outside the 25–35°C range incurs −1.5 trust penalty. Critical threshold: >40°C causes irreversible microbial colony collapse.',
    category: 'Temperature Safety',
  },
  {
    content:
      'Urban Heat Island (UHI) Effect on Perishable Organic Goods in Bangladesh (BARI-UHI-2025): Dhaka built environment creates UHI offsets: Uttara +2.1°C (MODERATE), Dhanmondi +2.5°C (MODERATE), Mohammadpur +2.8°C (HIGH), Mirpur +3.2°C (HIGH), Motijheel +3.5°C (CRITICAL). TST formula: TST = max(0, 480 − (EffectiveTemp − 30) × 18) minutes. Safe dispatch window: 06:00–08:00 AM before peak solar loading.',
    category: 'Urban Heat Island',
  },
];

async function seed() {
  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured in environment variables.');
    process.exit(1);
  }

  console.log('🌱 Starting seed of BARI agricultural standards vector database...');

  const supabase = getSupabaseClient();

  for (const chunk of BARI_CHUNKS) {
    const { error } = await supabase
      .from('bari_knowledge_chunks')
      .insert({
        content: chunk.content,
        category: chunk.category,
      });

    if (error) {
      console.warn(`⚠️ Failed to insert chunk: ${chunk.category}`, error.message);
    } else {
      console.log(`✅ Seeded chunk: ${chunk.category}`);
    }
  }

  console.log('🎉 Seed operation complete!');
}

seed().catch((err) => {
  console.error('Fatal seed failure:', err);
});
