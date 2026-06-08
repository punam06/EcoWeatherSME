import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

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

function buildClaudeRAGPrompt(
  query: string,
  retrievedContext: string,
  language: 'bn' | 'en'
): string {
  const languageInstruction = language === 'bn' 
    ? 'Provide the final recommendation response in clean, helpful, natural-sounding conversational spoken Bangla.' 
    : 'Provide the final recommendation response in clean, helpful, natural-sounding conversational spoken English.';

  return `
You are the ClimaLogix AI Agricultural Compliance Advisor. Your job is to help green SMEs, commercial nurseries, and organic refineries analyze bio-asset parameters and choose quality circular inputs.

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

async function retrieveBARIContext(
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userQuery, language, preferredZone } = await req.json() as AIRecommendationRequest;

    if (!userQuery) {
      return new Response(JSON.stringify({ error: "Missing userQuery" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('DATABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error("Missing GROQ_API_KEY environment variable");
    }

    const { context, standardName } = await retrieveBARIContext(userQuery, supabaseUrl, supabaseKey);
    const prompt = buildClaudeRAGPrompt(userQuery, context, language || 'en');

    // Call Groq API via fetch
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful agricultural compliance assistant. You must output only valid JSON matching the requested structure." },
          { role: "user", content: prompt + `\n\nProvide the response strictly as a JSON object with the following keys: "advice" (string), "citedStandardName" (string, must be "${standardName}"), "suggestedAction" (string), "isCompliant" (boolean).` }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq API error: ${errText}`);
    }

    const groqData = await groqResponse.json();
    const parsedResponse = JSON.parse(groqData.choices[0].message.content) as AIRecommendationResponse;

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
