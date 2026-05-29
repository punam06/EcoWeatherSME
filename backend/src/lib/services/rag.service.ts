/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — RAG AI SERVICE (Groq via OpenAI SDK)
 * File: src/lib/services/rag.service.ts
 *
 * Retrieval-Augmented Generation using hardcoded BARI knowledge
 * chunks with simple keyword matching, injected into Groq.
 * ═══════════════════════════════════════════════════════════════
 */

import OpenAI from 'openai';

// ─── Groq Client ──────────────────────────────────────────────────────────────

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

// ─── BARI Knowledge Chunks ───────────────────────────────────────────────────

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

// ─── Keyword Matching / Context Retrieval ────────────────────────────────────

/**
 * Selects the top-2 most relevant knowledge chunks via keyword overlap scoring.
 * Returns the most relevant chunks in descending relevance order.
 */
function retrieveTopChunks(query: string, topN = 2): KnowledgeChunk[] {
  const queryLower = query.toLowerCase();

  const scored = BARI_KNOWLEDGE_CHUNKS.map((chunk) => {
    const matches = chunk.keywords.filter((kw) => queryLower.includes(kw)).length;
    return { chunk, matches };
  });

  // Sort by match count descending; tie-break by original order (stable sort)
  scored.sort((a, b) => b.matches - a.matches);

  // Return top N chunks (always at least 1 even if no keyword match)
  const top = scored.slice(0, topN);
  return top.map((s) => s.chunk);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Performs RAG-grounded question answering using BARI knowledge base and Groq.
 *
 * @param query - User's question
 * @param language - Response language: "bn" (Bangla) or "en" (English)
 * @returns RAGResult with answer, context references, and token usage
 */
export async function queryRAG(query: string, language: 'bn' | 'en'): Promise<RAGResult> {
  // ── 1. Retrieve relevant context chunks ───────────────────
  const relevantChunks = retrieveTopChunks(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  // ── 2. Build system prompt ────────────────────────────────
  const languageInstruction =
    language === 'bn'
      ? 'Respond in clean, helpful, natural conversational Bangla (বাংলা).'
      : 'Respond in clear, professional English.';

  const systemPrompt =
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector, ` +
    `specializing in BARI (Bangladesh Agricultural Research Institute) standards.\n` +
    `Answer based strictly on the following BARI standard context. ` +
    `If the answer is not in context, clearly state that.\n` +
    `${languageInstruction}\n\n` +
    `Context:\n${contextText}`;

  // ── 3. Call Groq API ──────────────────────────────────────
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
    // Fallback to mixtral if llama fails (e.g. rate limit)
    console.warn('[RAG] llama-3.3-70b-versatile failed, trying llama-3.1-8b-instant:', primaryError);
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
      console.error('[RAG] Both Groq models failed:', fallbackError);
      // Graceful degradation: return context summary
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

/**
 * Performs a conversational RAG query grounded in BARI context.
 */
export async function queryRAGConversational(
  query: string,
  language: 'bn' | 'en',
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<RAGResult> {
  const relevantChunks = retrieveTopChunks(query, 2);
  const contextText = relevantChunks.map((c) => c.content).join('\n\n');
  const contextCategories = relevantChunks.map((c) => c.category);

  const languageInstruction =
    language === 'bn'
      ? 'Respond in clean, helpful, natural conversational Bangla (বাংলা).'
      : 'Respond in clear, professional English.';

  const systemPrompt =
    `You are an expert agricultural AI assistant for Bangladesh's organic farming sector, ` +
    `specializing in BARI (Bangladesh Agricultural Research Institute) standards.\n` +
    `Answer based strictly on the following BARI standard context. ` +
    `If the answer is not in context, clearly state that.\n` +
    `${languageInstruction}\n\n` +
    `Context:\n${contextText}`;

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
    console.warn('[RAG] llama-3.3-70b-versatile conversational failed, trying llama-3.1-8b-instant:', primaryError);
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
      console.error('[RAG] Both Groq models failed for conversation:', fallbackError);
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

