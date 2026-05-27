import { createClient } from '@supabase/supabase-js';

export interface AIRecommendationRequest {
  userQuery: string;
  language: 'bn' | 'en';
  preferredZone?: string;
}

export interface AIRecommendationResponse {
  advice: string;
  citedStandardName: string;
  suggestedAction: string;
  isCompliant: boolean;
}

/**
 * Standardizes the voice prompt context for Claude 3.5 Sonnet
 */
export function buildClaudeRAGPrompt(
  query: string,
  retrievedContext: string,
  language: 'bn' | 'en'
): string {
  const languageInstruction = language === 'bn' 
    ? 'Provide the final recommendation response in clean, helpful, natural-sounding conversational spoken Bangla.' 
    : 'Provide the final recommendation response in clean, helpful, natural-sounding conversational spoken English.';

  return `
You are the EcoSortha AI Agricultural Compliance Advisor. Your job is to help green SMEs, commercial nurseries, and organic refineries analyze bio-asset parameters and choose quality circular inputs.

Retrieved BARI Scientific Guidelines:
----------------------------------
${retrievedContext}
----------------------------------

User Query: "${query}"

Instructions:
1. Ground your advice strictly in the provided BARI scientific guidelines.
2. If there are parameters mentioned (like pH, EC, temperature), check them against the standard.
3. Be friendly and highly encouraging of circular agriculture.
4. ${languageInstruction}
5. Keep your response brief (2-3 sentences max) so it is ideal for natural voice play-back.
  `.trim();
}

/**
 * Foundation RAG Search service helper.
 * If Supabase/Vector store is not online, it gracefully falls back to keyword matching.
 */
export async function retrieveBARIContext(
  query: string,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ context: string; standardName: string }> {
  const defaultStandardName = 'EM-1 Fermentation Standard (BARI-EM-2025)';
  const fallbackContext = `EM-1 Bio-Slurry Nutrient Fermentation Standard guidelines:
- Safe holding temperature is below 32°C. Temperatures above 35°C trigger up to 40% microorganism degradation.
- Optimal fermentation pH range is strictly between 3.50 and 4.20. Deviation indicates pathological infection.
- Electrical Conductivity (EC) range: 2.0 to 5.0 mS/cm.`;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
    // Graceful Keyword fallback for early development/offline local hackathon environments
    if (query.toLowerCase().includes('carbon') || query.toLowerCase().includes('biochar') || query.toLowerCase().includes('solid')) {
      return {
        standardName: 'Soil Carbon Stabilization and Pyrolysis Standard (BARI-CS-2026)',
        context: `BARI Solid Soil Carbonization and Pyrolysis Standards:
- Pyrolysis must achieve at least 0.75 (75%) fixed carbon fraction at 400°C to 500°C.
- Molecular conversion ratio to CO2e is 44/12 (3.67).
- 100-year permanence factor (gamma stabilization) is 0.95.`
      };
    }
    return {
      standardName: defaultStandardName,
      context: fallbackContext
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Zihad will implement the pgvector RPC search here.
    // For now, we fall back to a direct keyword select query for high-velocity startup testing.
    const searchWord = query.toLowerCase().includes('carbon') ? 'carbon' : 'em-1';
    const { data, error } = await supabase
      .from('compliance_knowledge_base')
      .select('standard_name, document_chunk')
      .ilike('document_chunk', `%${searchWord}%`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return { standardName: defaultStandardName, context: fallbackContext };
    }

    return {
      standardName: data[0].standard_name,
      context: data[0].document_chunk
    };
  } catch (error) {
    console.warn('RAG Context retrieval failed, using fallback metrics.', error);
    return { standardName: defaultStandardName, context: fallbackContext };
  }
}
