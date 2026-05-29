/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — RAG AI SERVICE (Anthropic Claude & Supabase pgvector)
 * File: src/lib/services/rag.service.ts
 *
 * Implements native Claude 3.5 Sonnet RAG grounded in Supabase pgvector
 * similarity matching, with a robust keyword fallback.
 * ═══════════════════════════════════════════════════════════════
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

// ─── Groq Client (Fallback LLM) ──────────────────────────────────────────────

let _groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!_groqClient) {
    _groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groqClient;
}

// ─── Anthropic Client (Primary LLM) ───────────────────────────────────────────

let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
  }
  return _anthropicClient;
}

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
      'Each 0.1 unit deviation from the ideal range incurs a −2 point trust penalty. ' +
      'For EM-1 fermented bio-slurry, maintain pH strictly within 6.5–7.2 for optimal microbial colony counts.',
  },
  {
    id: 'chunk-ec-thresholds',
    category: 'EC Thresholds',
    keywords: ['ec', 'electrical conductivity', 'salinity', 'conductance', 'dS/m', 'fertilizer', 'biofertilizer'],
    content:
      'BARI Electrical Conductivity (EC) Standards for Bio-Fertilizer Viability (BARI-EC-2025): ' +
      'Ideal EC range for EM-1 bio-fertilizer: 1.5–3.5 dS/m (equivalent to 1500–3500 µS/cm). ' +
      'EC below 1.5 dS/m indicates insufficient nutrient concentration and low microbial density. ' +
      'EC above 3.5 dS/m creates osmotic stress that suppresses plant root development. ' +
      'Critical threshold: EC > 5.0 dS/m renders product non-viable for organic certification. ' +
      'Each 0.5 dS/m deviation from the 1.5–3.5 range incurs a −3 point trust score penalty.',
  },
  {
    id: 'chunk-em1-fermentation',
    category: 'EM-1 Fermentation',
    keywords: ['em1', 'em-1', 'em 1', 'fermentation', 'ratio', 'dilution', 'effective microorganism', 'bokashi'],
    content:
      'BARI EM-1 Fermentation Standard (BARI-EM-2025): ' +
      'Approved EM-1 application ratios: 1:500 (0.002), 1:1000 (0.001), and 1:2000 (0.0005). ' +
      'Any ratio outside these three approved values is non-compliant and incurs −10 trust penalty. ' +
      'Minimum fermentation duration: 21 days to ensure complete anaerobic transformation. ' +
      'Each day below the 21-day minimum incurs −4 points. ' +
      'Extended fermentation beyond 21 days is acceptable and does not reduce score. ' +
      'The 1:1000 ratio is the standard recommendation for foliar spray applications.',
  },
  {
    id: 'chunk-temperature-safety',
    category: 'Temperature Safety',
    keywords: ['temperature', 'heat', 'cooling', 'transit', 'storage', 'thermal', 'celsius', 'organic transit'],
    content:
      'BARI Temperature Safety Guidelines for Organic Transit in Bangladesh (BARI-TS-2024): ' +
      'Safe storage temperature range: 25–35°C for bio-slurry and EM-1 products. ' +
      'Below 25°C: microbial activity slows, reducing biological effectiveness by up to 15%. ' +
      'Above 35°C: accelerated protein denaturation and pathogen growth risk. ' +
      'Each 1°C outside the 25–35°C range incurs −1.5 trust penalty. ' +
      'Critical threshold: >40°C causes irreversible microbial colony collapse. ' +
      'Pre-dispatch temperature verification is mandatory for all BARI-certified batches.',
  },
  {
    id: 'chunk-urban-heat-island',
    category: 'Urban Heat Island',
    keywords: ['uhi', 'urban heat island', 'dhaka', 'city heat', 'microclimate', 'dispatch', 'delivery', 'zone', 'tst', 'thermal survival'],
    content:
      'Urban Heat Island (UHI) Effect on Perishable Organic Goods in Bangladesh (BARI-UHI-2025): ' +
      'Dhaka\'s built environment creates UHI offsets ranging from +2.1°C (Uttara) to +3.5°C (Motijheel). ' +
      'The Thermal Survival Time (TST) formula accounts for UHI: ' +
      'Effective Temp = (Ambient + UHI Offset) × Solar Load Factor. ' +
      'TST (minutes) = max(0, 480 − (Effective Temp − 30) × 18). ' +
      'Safe dispatch windows are 06:00–08:00 AM before peak solar loading. ' +
      'Motijheel (CRITICAL), Mirpur and Mohammadpur (HIGH) require insulated packaging. ' +
      'Uttara and Dhanmondi (MODERATE) allow standard packaging before 10:00 AM.',
  },
] as const;

// ─── RAG Types ────────────────────────────────────────────────────────────────

export interface RAGResult {
  answer: string;
  language: 'bn' | 'en';
  contextUsed: string[];
  tokensUsed: number;
}

// ─── Deterministic Hash-Based Embedding Generator ──────────────────────────────

/**
 * Generates a unit-normalized (L2) 1536-dimensional embedding vector deterministically.
 * This guarantees similarity search matching behaves identically across restarts, offline 
 * environments, or when external API keys are restricted.
 */
function generateDeterministicEmbedding(text: string): number[] {
  const vector = new Array(1536).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    // Spread weights deterministically to 5 indices
    for (let j = 0; j < 5; j++) {
      const idx = Math.abs((hash + j * 313) % 1536);
      vector[idx] += 0.2;
    }
  }

  // L2 Norm normalization
  let sumSq = 0;
  for (let i = 0; i < 1536; i++) sumSq += vector[i] * vector[i];
  const norm = Math.sqrt(sumSq) || 1.0;
  for (let i = 0; i < 1536; i++) vector[i] /= norm;

  return vector;
}

/**
 * Computes text embedding using OpenAI api if available, otherwise falls back to deterministic generator.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !openaiKey.includes('your-')) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (err) {
      console.warn('[RAG] OpenAI Embedding failed, falling back to deterministic embedding:', err);
    }
  }
  return generateDeterministicEmbedding(text);
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

// ─── pgvector Similarity Retriever ───────────────────────────────────────────

async function retrieveRelevantChunksFromDB(query: string, topN = 2): Promise<{ content: string; category: string }[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[RAG] Supabase not configured. Using local keywords fallback.');
    return retrieveTopChunks(query, topN);
  }

  try {
    const supabase = getSupabaseClient();
    const queryEmbedding = await getEmbedding(query);

    const { data, error } = await supabase.rpc('match_bari_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // permissive to guarantee matching
      match_count: topN,
    });

    if (error || !data || data.length === 0) {
      console.warn('[RAG] pgvector similarity search returned empty or error, falling back to local:', error?.message);
      return retrieveTopChunks(query, topN);
    }

    return data.map((row: any) => ({
      content: row.content,
      category: row.category,
    }));
  } catch (err) {
    console.warn('[RAG] Unexpected error in similarity retrieval, using local fallback:', err);
    return retrieveTopChunks(query, topN);
  }
}

// ─── Auto Seeding Null Embeddings ─────────────────────────────────────────────

/**
 * Scans DB on startup and computes embeddings for seeded BARI knowledge chunks if null.
 */
export async function seedNullEmbeddingsIfNecessary(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bari_knowledge_chunks')
      .select('id, content')
      .is('embedding', null);

    if (error) {
      console.warn('[RAG] Failed to scan un-embedded BARI chunks:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[RAG] Found ${data.length} un-embedded BARI chunks in DB. Syncing vector embeddings...`);
      for (const row of data) {
        const embedding = await getEmbedding(row.content);
        const { error: updateError } = await supabase
          .from('bari_knowledge_chunks')
          .update({ embedding })
          .eq('id', row.id);

        if (updateError) {
          console.error(`[RAG] Failed to set embedding for chunk ${row.id}:`, updateError.message);
        } else {
          console.log(`[RAG] Successfully updated vector embeddings for chunk: ${row.id}`);
        }
      }
    }
  } catch (err) {
    console.warn('[RAG] Startup auto-embedding pipeline check failed:', err);
  }
}

// ─── Claude RAG Services ──────────────────────────────────────────────────────

/**
 * Grounded QA recommendations utilizing Claude 3.5 Sonnet and Supabase pgvector.
 */
export async function queryClaudeRAG(query: string, language: 'bn' | 'en'): Promise<RAGResult> {
  // Trigger auto-embed of null db rows concurrently (fire-and-forget)
  seedNullEmbeddingsIfNecessary().catch(() => {});

  const relevantChunks = await retrieveRelevantChunksFromDB(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  const systemPrompt =
    `You MUST respond exclusively in ${language === 'bn' ? 'Bangla (Bengali script)' : 'English'}. ` +
    `Do not switch languages under any circumstance. ` +
    `If the user writes in Romanized Bangla (Banglish), still respond in proper Bangla script.\n\n` +
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector, ` +
    `specializing in BARI (Bangladesh Agricultural Research Institute) standards.\n` +
    `Answer based strictly on the following BARI standard context. ` +
    `If the answer is not in context, clearly state that.\n\n` +
    `Context:\n${contextText}`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.includes('your-')) {
    console.warn('[RAG] Claude API key is missing. Gracefully falling back to Groq Llama-3.3...');
    return queryRAG(query, language, contextText, contextCategories);
  }

  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // exact model requested in prompt
      max_tokens: 400,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : 'No answer generated.';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    return {
      answer,
      language,
      contextUsed: contextCategories,
      tokensUsed,
    };
  } catch (error) {
    console.error('[RAG] Claude Sonnet prompt invocation failed. Trying Groq fallback:', error);
    return queryRAG(query, language, contextText, contextCategories);
  }
}

/**
 * Conversational Multi-turn groundings utilizing Claude 3.5 Sonnet and Supabase pgvector.
 */
export async function queryRAGConversational(
  query: string,
  language: 'bn' | 'en',
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<RAGResult> {
  const relevantChunks = await retrieveRelevantChunksFromDB(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  const systemPrompt =
    `You MUST respond exclusively in ${language === 'bn' ? 'Bangla (Bengali script)' : 'English'}. ` +
    `Do not switch languages under any circumstance. ` +
    `If the user writes in Romanized Bangla (Banglish), still respond in proper Bangla script.\n\n` +
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector, ` +
    `specializing in BARI (Bangladesh Agricultural Research Institute) standards.\n` +
    `Answer based strictly on the following BARI standard context. ` +
    `If the answer is not in context, clearly state that.\n\n` +
    `Context:\n${contextText}`;

  const conversationMessages = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.includes('your-')) {
    console.warn('[RAG] Claude API key is missing. Gracefully falling back to Groq conversational Llama...');
    return queryRAGConversationalGroq(query, language, history, contextText, contextCategories);
  }

  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        ...conversationMessages,
        { role: 'user', content: query },
      ],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : 'No answer generated.';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    return {
      answer,
      language,
      contextUsed: contextCategories,
      tokensUsed,
    };
  } catch (error) {
    console.error('[RAG] Claude conversational session invocation failed. Trying Groq fallback:', error);
    return queryRAGConversationalGroq(query, language, history, contextText, contextCategories);
  }
}

// ─── Groq Llama Fallback Implementations ──────────────────────────────────────

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

  const groq = getGroqClient();
  let answer: string;
  let tokensUsed = 0;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

  const groq = getGroqClient();
  let answer: string;
  let tokensUsed = 0;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
