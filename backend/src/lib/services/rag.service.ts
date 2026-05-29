/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — RAG AI SERVICE (Groq & Supabase Text Search)
 * File: src/lib/services/rag.service.ts
 *
 * Implements native Groq Llama-3.3 RAG grounded in Supabase
 * textSearch similarity matching, with a robust keyword fallback.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { groq, GROQ_MODEL } from '../groq';

// ─── BARI Knowledge Chunks (Local Fallback) ────────────────────────────────────

interface KnowledgeChunk {
  id: string;
  category: string;
  keywords: ReadonlyArray<string>;
  content: string;
}

const BARI_KNOWLEDGE_CHUNKS: ReadonlyArray<KnowledgeChunk> = [
  {
    id: 'chunk-ph-standards',
    category: 'pH Standards',
    keywords: ['ph', 'acidity', 'alkalinity', 'hydrogen', 'compost', 'organic'],
    content:
      'BARI pH Standards for Organic Compost (BARI-OC-2024): ' +
      'The optimal pH range for certified organic compost and bio-slurry is 6.5 to 7.5. ' +
      'pH below 6.5 indicates excessive acidity which inhibits microbial activity and reduces nutrient availability. ' +
      'pH above 7.5 leads to ammonia volatilisation and reduced phosphorus solubility. ' +
      'Continuous application outside the 6.5-7.5 range requires soil neutralization with lime (for acidic soils) or gypsum (for alkaline soils).'
  },
  {
    id: 'chunk-ec-standards',
    category: 'Electrical Conductivity',
    keywords: ['ec', 'conductivity', 'salt', 'salinity', 'fertilizer', 'compost'],
    content:
      'BARI Electrical Conductivity (EC) Limits for Organic Bio-fertilizer (BARI-EC-2024): ' +
      'The maximum safe EC value for finished organic compost is 4.0 dS/m. ' +
      'Optimal salinity range is between 1.5 and 3.0 dS/m. ' +
      'An EC above 4.0 dS/m indicates high soluble salt concentration which causes osmotic stress, burns young crop root systems, and inhibits seed germination. ' +
      'To mitigate high EC compost, flush with clean low-salinity irrigation water or dilute by blending with low-salt carbonaceous feedstocks (straw, sawdust) at a 1:2 ratio.'
  },
  {
    id: 'chunk-temp-standards',
    category: 'Fermentation Temperature',
    keywords: ['temp', 'temperature', 'fermentation', 'heat', 'decomposition', 'pathogen'],
    content:
      'BARI Fermentation Temperature Guidelines for Solid-State Bio-reactors (BARI-T-2024): ' +
      'The aerobic decomposition phase must maintain a temperature of 55°C to 65°C for at least 7 to 10 consecutive days. ' +
      'This high-temperature thermophilic phase is critical to destroy weed seeds, plant pathogens (e.g. Fusarium oxysporum), and enteric viruses (Salmonella, E. coli). ' +
      'Temperatures exceeding 70°C must be avoided as they kill beneficial spore-forming actinomycetes and cellulose-decomposing fungi, arresting the curing phase. ' +
      'Regulate temperatures by active turning, passive convective aeration, or moisture adjustments (target 50-60% moisture).'
  },
  {
    id: 'chunk-em1-ratio',
    category: 'EM-1 Microbial Inoculant',
    keywords: ['em1', 'em-1', 'inoculant', 'microbial', 'fermentation', 'ratio', 'yeast'],
    content:
      'BARI EM-1 Microbial Inoculant Application Standard (BARI-EM-2024): ' +
      'Effective Microorganisms (EM-1) containing lactic acid bacteria, photosynthetic bacteria, and yeasts must be applied at a ratio of 1:1:20 (1 Liter EM-1 : 1 Liter Molasses : 20 Liters non-chlorinated water). ' +
      'Activate by fermenting in a sealed anaerobic container for 5 to 7 days until the pH drops below 3.7. ' +
      'Apply the activated solution to compost feedstocks at a dilution rate of 1:100 to 1:200. ' +
      'Under-inoculation (ratios lower than 1:1:20 activated) leads to slow stabilization, foul odor emissions (hydrogen sulfide, methane), and dominance of putrefactive microbes.'
  },
  {
    id: 'chunk-fermentation-days',
    category: 'Stabilization Curing Days',
    keywords: ['days', 'curing', 'stabilization', 'duration', 'time', 'maturation'],
    content:
      'BARI Compost Stabilization and Curing Duration Guidelines (BARI-D-2024): ' +
      'Certified organic compost must undergo a minimum stabilization and curing duration of 45 to 60 days. ' +
      'This includes 15 to 20 days of active thermophilic fermentation followed by 30 to 40 days of mesophilic curing. ' +
      'Short-duration processes (less than 45 days) yield immature compost containing toxic volatile fatty acids, high phytotoxic carbon-to-nitrogen (C:N) ratios, and active organic compounds that deplete soil oxygen and stunt crop seedling development.'
  },
  {
    id: 'chunk-tomato-guidelines',
    category: 'Tomato Cultivation',
    keywords: ['tomato', 'টমেটো', 'সার', 'fertilizer', 'compost', 'টমেটোর জন্য সার'],
    content:
      'BARI Organic Tomato Cultivation Fertilizer Guidelines (BARI-Tomato-2024): ' +
      'Organic tomato crops require high potassium and phosphorus input for healthy flowering and fruit set. ' +
      'BARI recommends applying certified organic compost (pH 6.8, EC 2.2 dS/m) at a rate of 10 tons per hectare (approx 1 kg per square meter) during final land preparation. ' +
      'Supplement with activated EM-1 foliar spray (dilution 1:500) every 14 days post-transplantation to enhance disease resistance against early blight (Alternaria solani).'
  }
];

export interface RAGResult {
  answer: string;
  language: 'bn' | 'en';
  contextUsed: string[];
  tokensUsed: number;
}

// ─── Keyword Local Matching ──────────────────────────────────────────────────

function retrieveTopChunks(query: string, topN = 2): { content: string; category: string }[] {
  const queryLower = query.toLowerCase();

  const scored = BARI_KNOWLEDGE_CHUNKS.map((chunk) => {
    const matches = chunk.keywords.filter((kw) => queryLower.includes(kw)).length;
    return { chunk, matches };
  });

  scored.sort((a, b) => b.matches - a.matches);
  return scored.slice(0, topN).map((s) => ({
    content: s.chunk.content,
    category: s.chunk.category,
  }));
}

// ─── Supabase Text Search Similarity Retriever ───────────────────────────────

async function retrieveRelevantChunksFromDB(query: string, topN = 2): Promise<{ content: string; category: string }[]> {
  if (!isSupabaseConfigured()) {
    return retrieveTopChunks(query, topN);
  }

  try {
    const supabase = getSupabaseClient();
    
    // Fallback to text search on bari_knowledge_chunks
    const { data, error } = await supabase
      .from('bari_knowledge_chunks')
      .select('content, category')
      .textSearch('content', query)
      .limit(topN);

    if (error || !data || data.length === 0) {
      return retrieveTopChunks(query, topN);
    }

    return data.map((row: any) => ({
      content: row.content,
      category: row.category,
    }));
  } catch (err) {
    return retrieveTopChunks(query, topN);
  }
}

// ─── Auto Seeding Null Embeddings (Stub No-Op) ───────────────────────────────────

export async function seedNullEmbeddingsIfNecessary(): Promise<void> {
  // No-op: pgvector embeddings successfully migrated to Supabase textSearch fallback
}

export async function getEmbedding(text: string): Promise<number[]> {
  // Return standard mock vector since embeddings are disabled
  return new Array(1536).fill(0);
}

// ─── Groq RAG Service ────────────────────────────────────────────────────────

/**
 * Grounded QA recommendations utilizing Groq exclusively.
 */
export async function queryClaudeRAG(query: string, language: 'bn' | 'en'): Promise<RAGResult> {
  const relevantChunks = await retrieveRelevantChunksFromDB(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  return queryRAG(query, language, contextText, contextCategories);
}

/**
 * Conversational Multi-turn groundings utilizing Groq.
 */
export async function queryRAGConversational(
  query: string,
  language: 'bn' | 'en',
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<RAGResult> {
  const relevantChunks = await retrieveRelevantChunksFromDB(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  return queryRAGConversationalGroq(query, language, history, contextText, contextCategories);
}

// ─── Groq Llama Implementations ──────────────────────────────────────────────

export async function queryRAG(
  query: string,
  language: 'bn' | 'en',
  contextTextOverride?: string,
  contextCategoriesOverride?: string[]
): Promise<RAGResult> {
  const contextText = contextTextOverride ?? retrieveTopChunks(query, 2).map((c) => c.content).join('\n\n');
  const contextCategories = contextCategoriesOverride ?? retrieveTopChunks(query, 2).map((c) => c.category);

  const systemPrompt =
    `You MUST respond exclusively in ${language === 'bn' ? 'Bangla (Bengali script)' : 'English'}. ` +
    `Do not switch languages under any circumstance.\n\n` +
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector.\n` +
    `Answer strictly based on BARI context:\n${contextText}`;

  let answer: string;
  let tokensUsed = 0;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    answer = completion.choices[0]?.message?.content ?? 'No answer generated.';
    tokensUsed = completion.usage?.total_tokens ?? 0;
  } catch (primaryError) {
    try {
      const fallback = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });
      answer = fallback.choices[0]?.message?.content ?? 'No answer generated.';
      tokensUsed = fallback.usage?.total_tokens ?? 0;
    } catch (fallbackError) {
      console.error('[RAG] All Groq RAG fallbacks failed:', fallbackError);
      answer =
        language === 'bn'
          ? `দুঃখিত, AI সার্ভিস এই মুহূর্তে অনুপলব্ধ। প্রাসঙ্গিক BARI নির্দেশিকা: ${contextText.slice(0, 300)}...`
          : `AI service temporarily unavailable. Relevant BARI context: ${contextText.slice(0, 300)}...`;
    }
  }

  return {
    answer,
    language,
    contextUsed: contextCategories,
    tokensUsed,
  };
}

async function queryRAGConversationalGroq(
  query: string,
  language: 'bn' | 'en',
  history: { role: 'user' | 'assistant'; content: string }[],
  contextText: string,
  contextCategories: string[]
): Promise<RAGResult> {
  const systemPrompt =
    `You MUST respond exclusively in ${language === 'bn' ? 'Bangla (Bengali script)' : 'English'}. ` +
    `Do not switch languages under any circumstance.\n\n` +
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector.\n` +
    `Answer strictly based on BARI context:\n${contextText}`;

  const conversationMessages = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  let answer: string;
  let tokensUsed = 0;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    answer = completion.choices[0]?.message?.content ?? 'No answer generated.';
    tokensUsed = completion.usage?.total_tokens ?? 0;
  } catch (primaryError) {
    try {
      const fallback = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages,
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });
      answer = fallback.choices[0]?.message?.content ?? 'No answer generated.';
      tokensUsed = fallback.usage?.total_tokens ?? 0;
    } catch (fallbackError) {
      console.error('[RAG] Groq conversational fallbacks failed:', fallbackError);
      answer =
        language === 'bn'
          ? `দুঃখিত, AI সার্ভিস এই মুহূর্তে অনুপলব্ধ। প্রাসঙ্গিক BARI নির্দেশিকা: ${contextText.slice(0, 300)}...`
          : `AI service temporarily unavailable. Relevant BARI context: ${contextText.slice(0, 300)}...`;
    }
  }

  return {
    answer,
    language,
    contextUsed: contextCategories,
    tokensUsed,
  };
}
