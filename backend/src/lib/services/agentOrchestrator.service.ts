/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT ORCHESTRATOR SERVICE
 * File: src/lib/services/agentOrchestrator.service.ts
 *
 * Implements the explicit Step 2 routing dispatcher, Step 3 stubs,
 * Step 4 broad catalog matching, and the Step 5 catch-all safety net.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { getSession, createSession, appendMessage, PendingOrder } from './chatSession.service';
import { classifyIntent, cityNameNormalizer, IntentType } from './intentClassifier.service';
import { searchProducts, Product } from './productSearch.service';
import { initiateOrder, confirmOrder, cancelOrder, OrderResult } from './orderExecution.service';
import { queryRAGConversational } from './rag.service';
import { getWeatherByCity } from './weather.service';

export interface AgentResponse {
  type:
    | 'TEXT'
    | 'PRODUCT_LIST'
    | 'ORDER_CONFIRM_PROMPT'
    | 'ORDER_SUCCESS'
    | 'ORDER_CANCELLED'
    | 'NAVIGATION'
    | 'AUTH_REQUIRED';
  message: string;
  language: 'bn' | 'en';
  products?: Product[];
  pendingOrder?: PendingOrder;
  orderResult?: OrderResult;
  navigationTarget?: string;
  requiresAuth?: boolean;
  sessionId: string;
}

/**
 * Handles explicit order transactions: parses quantities/types, queries catalog,
 * and confirms purchase immediately.
 */
async function handleAgenticOrder(
  message: string,
  userId: string | undefined,
  lang: 'bn' | 'en',
  activeSessionId: string
): Promise<AgentResponse> {
  const text = message.toLowerCase();

  // Extract quantity (defaults to 1)
  const qtyMatch = text.match(/\b\d+\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;

  // Extract product types
  const productType = text.includes('compost') || text.includes('কম্পোস্ট') ? 'compost' : 'fertilizer';
  const cropType = text.includes('tomato') || text.includes('টমেটো') ? 'tomato' : undefined;

  const products = await searchProducts(productType, cropType);

  if (products.length > 0) {
    const best = products[0];

    // Place transaction
    initiateOrder(activeSessionId, best, quantity, userId);
    await confirmOrder(activeSessionId, userId || 'demo-farmer-id');

    return {
      type: 'ORDER_SUCCESS',
      message:
        lang === 'bn'
          ? `আপনার অর্ডার সফলভাবে নেওয়া হয়েছে: ${best.name}, পরিমাণ: ${quantity}।`
          : `Your order has been successfully placed: ${best.name}, quantity: ${quantity}.`,
      language: lang,
      products,
      sessionId: activeSessionId,
    };
  } else {
    return {
      type: 'TEXT',
      message:
        lang === 'bn'
          ? `এই মুহূর্তে কোনো ${productType === 'compost' ? 'কম্পোস্ট' : 'সার'} পাওয়া যাচ্ছে না। মার্কেটপ্লেস ট্যাব থেকে দেখুন।`
          : `Currently no ${productType} is available. Please check the Marketplace tab.`,
      language: lang,
      sessionId: activeSessionId,
    };
  }
}

/**
 * Handles climate forecast DVS checkouts, resolving canonical cities and error prompts.
 */
async function handleClimateForecast(
  message: string,
  lang: 'bn' | 'en',
  activeSessionId: string
): Promise<AgentResponse> {
  const normalizedCity = cityNameNormalizer(message);

  if (!normalizedCity) {
    return {
      type: 'TEXT',
      message:
        lang === 'bn'
          ? 'আপনার শহরের নাম জানান, আমি আবহাওয়া তথ্য দেব।'
          : 'Please let me know your city name, I will provide weather information.',
      language: lang,
      sessionId: activeSessionId,
    };
  }

  const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!apiKey || apiKey.includes('your-')) {
    return {
      type: 'TEXT',
      message:
        lang === 'bn'
          ? 'আবহাওয়া সেবা এই মুহূর্তে উপলব্ধ নেই। অনুগ্রহ করে পরে চেষ্টা করুন।'
          : 'Weather service is temporarily unavailable. Please try again later.',
      language: lang,
      sessionId: activeSessionId,
    };
  }

  const weather = await getWeatherByCity(normalizedCity, lang);
  if (weather.found) {
    const formatted =
      lang === 'bn'
        ? `${weather.city}-এর বর্তমান আবহাওয়া:\n🌡️ তাপমাত্রা: ${weather.temperature}°C (অনুভূতি: ${weather.feelsLike}°C)\n🌤️ অবস্থা: ${weather.description}\n💧 আর্দ্রতা: ${weather.humidity}%\n💨 বাতাসের গতি: ${weather.windSpeed} m/s`
        : `Current weather in ${weather.city}:\n🌡️ Temperature: ${weather.temperature}°C (Feels like: ${weather.feelsLike}°C)\n🌤️ Condition: ${weather.description}\n💧 Humidity: ${weather.humidity}%\n💨 Wind Speed: ${weather.windSpeed} m/s`;

    return {
      type: 'TEXT',
      message: formatted,
      language: lang,
      sessionId: activeSessionId,
    };
  } else {
    return {
      type: 'TEXT',
      message:
        lang === 'bn'
          ? `দুঃখিত, ${normalizedCity} শহরের আবহাওয়া সংক্রান্ত তথ্য পাওয়া যায়নি। শহরের নাম ঠিক আছে কিনা পরীক্ষা করুন।`
          : `Could not find weather data for ${normalizedCity}. Please check the city name.`,
      language: lang,
      sessionId: activeSessionId,
    };
  }
}

/**
 * Handles explicit broad catalog lookup with broad ilike regex queries and stubs.
 */
async function handleProductSearch(
  message: string,
  lang: 'bn' | 'en',
  activeSessionId: string
): Promise<AgentResponse> {
  const text = message.toLowerCase().trim();
  const productType = text.includes('compost') || text.includes('কম্পোস্ট') ? 'compost' : 'fertilizer';

  let products: Product[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(
          `name.ilike.%${productType}%,category.ilike.%${productType}%,name.ilike.%সার%,description.ilike.%${productType}%`
        )
        .limit(10);

      if (!error && data) {
        products = data;
      }
    } catch (err) {
      console.error('[handleProductSearch] broad DB query failed:', err);
    }
  }

  // Fallback to local keywords catalog search
  if (products.length === 0) {
    products = await searchProducts(productType);
  }

  if (products.length > 0) {
    return {
      type: 'PRODUCT_LIST',
      message:
        lang === 'bn'
          ? `আমি আপনার জন্য কিছু উন্নত মানের প্রোডাক্ট খুঁজে পেয়েছি। অনুগ্রহ করে নির্বাচন করুন:`
          : `I found these matching products for you. Please select one:`,
      language: lang,
      products,
      sessionId: activeSessionId,
    };
  } else {
    return {
      type: 'TEXT',
      message:
        lang === 'bn'
          ? 'এই মুহূর্তে কোনো সার পাওয়া যাচ্ছে না। মার্কেটপ্লেস ট্যাব থেকে দেখুন।'
          : 'Currently no fertilizers are available. Please check the Marketplace tab.',
      language: lang,
      sessionId: activeSessionId,
    };
  }
}

import { groq, GROQ_MODEL } from '../groq';

const AGENT_SYSTEM_PROMPT = `
You are EcoSortha AI, an intelligent agricultural commerce assistant for Bangladesh's organic farming sector. You understand Bangla, English, and Banglish (mixed) naturally.

You help farmers and SMEs with: weather/climate data, BARI agricultural guidelines, product browsing, placing orders, and navigating the platform dashboard.

For every user message, respond with a JSON object in this exact format:
{
  "intent": "weather" | "navigate" | "order" | "product_search" | "bari_advice" | "general_chat",
  "language": "bn" | "en" | "mixed",
  "extractedData": {
    "city": "string or null",
    "page": "dashboard" | "orders" | "marketplace" | "batches" | "batch_verification" | "microclimate" | "climate_demand" | "impact_esg" | "chatbot" | null,
    "productName": "string or null",
    "quantity": "number or null",
    "unit": "string or null",
    "cropContext": "string or null"
  },
  "replyMessage": "Your natural conversational response in the same language the user used"
}

Rules:
- Always respond in the same language the user wrote in (Bangla, English, or mixed)
- "replyMessage" must be warm, conversational, and helpful — never robotic
- If the assistant previously asked for a city name/location and the user responds with a city name (e.g. "Dhaka", "Sylhet", "dhakar"), set the intent to "weather" and extract the city
- If the user says anything like "dashboard দেখাও", "go to orders", "marketplace নিয়ে যাও", "order page" — set intent to "navigate" and extract the page
- If the user wants to buy/order something — set intent to "order"
- If the user asks about weather, temperature, climate, আবহাওয়া — set intent to "weather"
- For BARI guidelines, soil, pH, organic farming advice — set intent to "bari_advice"
- Everything else is "general_chat" — answer helpfully from your agricultural knowledge
- Never say "I cannot help with that". Always try to answer.

IMPORTANT: Respond ONLY with a valid JSON object. Do not wrap it in markdown block backticks or include any preambles.
`;

interface AgentParsedResult {
  intent: 'weather' | 'navigate' | 'order' | 'product_search' | 'bari_advice' | 'general_chat';
  language: 'bn' | 'en' | 'mixed';
  extractedData: {
    city: string | null;
    page: 'dashboard' | 'orders' | 'marketplace' | 'batches' | 'batch_verification' | 'microclimate' | 'climate_demand' | 'impact_esg' | 'chatbot' | null;
    productName: string | null;
    quantity: number | null;
    unit: string | null;
    cropContext: string | null;
  };
  replyMessage: string;
}

async function queryLLMIntent(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<AgentParsedResult> {
  const conversationHistory = history.slice(-6).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }));

  const messages = [...conversationHistory, { role: 'user' as const, content: query }];

  let textResult = '';

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    textResult = completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('[Agent Orchestrator] Groq intent classification failed:', error);
  }

  // Parse textResult as JSON
  try {
    let cleaned = textResult.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (parsed && parsed.intent) {
      return parsed as AgentParsedResult;
    }
  } catch (e) {
    console.error('[Agent Orchestrator] Failed to parse JSON from LLM response. Raw text:', textResult);
  }

  // Default fallback
  return {
    intent: 'general_chat',
    language: 'bn',
    extractedData: {
      city: null,
      page: null,
      productName: null,
      quantity: null,
      unit: null,
      cropContext: null,
    },
    replyMessage: textResult || 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।',
  };
}

/**
 * Main process pipeline.
 */
export async function processMessage(
  query: string,
  language: 'bn' | 'en',
  sessionId?: string,
  farmerId?: string
): Promise<AgentResponse> {
  // Resolve or Create Session
  let activeSessionId = sessionId;
  let session = sessionId ? getSession(sessionId) : undefined;
  if (!session) {
    const newSession = createSession(farmerId);
    activeSessionId = newSession.sessionId;
    session = newSession;
  }

  if (farmerId) {
    session.farmerId = farmerId;
  }

  // Query LLM Intent Layer
  const llmResult = await queryLLMIntent(query, session.history);

  appendMessage(activeSessionId!, 'user', query);

  try {
    let result: AgentResponse;

    // Step 2: Unified dispatcher switch block based on LLM intent
    switch (llmResult.intent) {
      case 'order': {
        result = {
          type: 'ORDER_CONFIRM_PROMPT',
          message: llmResult.replyMessage,
          language,
          sessionId: activeSessionId!,
          pendingOrder: {
            productId: 'pending',
            productName: llmResult.extractedData?.productName || '',
            priceBdt: 0,
            quantity: llmResult.extractedData?.quantity || 1,
            totalBdt: 0,
          }
        };
        break;
      }

      case 'weather': {
        const cityCandidate = llmResult.extractedData?.city || query;
        const normalizedCity = cityNameNormalizer(cityCandidate);
        if (!normalizedCity) {
          result = {
            type: 'TEXT',
            message:
              language === 'bn'
                ? 'আপনার শহরের নাম জানান, আমি আবহাওয়া তথ্য দেব। যেমন: "ঢাকার আবহাওয়া" বা "Chittagong weather"'
                : 'Please let me know your city name, I will provide weather information.',
            language,
            sessionId: activeSessionId!,
          };
        } else {
          result = await handleClimateForecast(normalizedCity, language, activeSessionId!);
        }
        break;
      }

      case 'navigate': {
        result = {
          type: 'NAVIGATION',
          message: llmResult.replyMessage,
          navigationTarget: llmResult.extractedData?.page || 'dashboard',
          language,
          sessionId: activeSessionId!,
        };
        break;
      }

      case 'product_search': {
        result = await handleProductSearch(query, language, activeSessionId!);
        if (llmResult.replyMessage) {
          result.message = llmResult.replyMessage;
        }
        break;
      }

      case 'bari_advice': {
        const ragResult = await queryRAGConversational(query, language, session.history.slice(-5, -1));
        result = {
          type: 'TEXT',
          message: ragResult.answer,
          language,
          sessionId: activeSessionId!,
        };
        break;
      }

      case 'general_chat':
      default: {
        result = {
          type: 'TEXT',
          message: llmResult.replyMessage,
          language,
          sessionId: activeSessionId!,
        };
        break;
      }
    }

    appendMessage(activeSessionId!, 'assistant', result.message);

    // Logging to DB
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      (async () => {
        try {
          await supabase.from('agent_interaction_logs').insert({
            session_id: activeSessionId,
            farmer_id: session!.farmerId || null,
            message: query,
            intent: llmResult.intent,
            response_type: result.type,
            language,
          });
        } catch (err) {}
      })();
    }

    return result;
  } catch (error) {
    // Step 5: Catch-all safety net
    console.error('[ChatHandler Error]', error);
    return {
      type: 'TEXT',
      message:
        language === 'bn'
          ? 'দুঃখিত, একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
          : 'Sorry, something went wrong. Please try again.',
      language,
      sessionId: activeSessionId!,
    };
  }
}
