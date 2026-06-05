/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT ORCHESTRATOR SERVICE
 * File: src/lib/services/agentOrchestrator.service.ts
 *
 * Full multi-intent dispatcher with:
 *   - weather, navigate, order, product_search, bari_advice
 *   - greeting, product_explain, app_help (new)
 *   - Hybrid session memory (in-memory + DB restore)
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import {
  getSession,
  getSessionAsync,
  createSession,
  appendMessage,
  PendingOrder,
} from './chatSession.service';
import { classifyIntent, cityNameNormalizer, IntentType } from './intentClassifier.service';
import { searchProducts, Product } from './productSearch.service';
import { initiateOrder, confirmOrder, cancelOrder, OrderResult } from './orderExecution.service';
import { queryRAGConversational } from './rag.service';
import { getWeatherByCity } from './weather.service';
import { groq, GROQ_MODEL } from '../groq';

// ── App Help Knowledge Base ───────────────────────────────────────────────────

import { APP_HELP_ENTRIES } from '../knowledge/appHelp';

// ── Agent Response Type ───────────────────────────────────────────────────────

export interface AgentResponse {
  type:
    | 'TEXT'
    | 'PRODUCT_LIST'
    | 'ORDER_CONFIRM_PROMPT'
    | 'ORDER_SUCCESS'
    | 'ORDER_CANCELLED'
    | 'NAVIGATION'
    | 'AUTH_REQUIRED'
    | 'APP_HELP'
    | 'GREETING'
    | 'ORDER_STATUS'
    | 'BATCH_EXPLAIN';
  message: string;
  language: 'bn' | 'en';
  products?: Product[];
  pendingOrder?: PendingOrder;
  orderResult?: OrderResult;
  navigationTarget?: string;
  verifiedBatchId?: string;
  verifiedDispatchZone?: string;
  requiresAuth?: boolean;
  helpTopic?: string;
  rawOrders?: any[];
  sessionId: string;
}

// ── Order Handler ─────────────────────────────────────────────────────────────

async function handleAgenticOrder(
  message: string,
  userId: string | undefined,
  lang: 'bn' | 'en',
  activeSessionId: string
): Promise<AgentResponse> {
  const text = message.toLowerCase();

  const qtyMatch = text.match(/\b\d+\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;

  const productType = text.includes('compost') || text.includes('কম্পোস্ট') ? 'compost' : 'fertilizer';
  const cropType = text.includes('tomato') || text.includes('টমেটো') ? 'tomato' : undefined;

  const products = await searchProducts(productType, cropType);

  if (products.length > 0) {
    const best = products[0];
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

// ── Climate Forecast Handler ───────────────────────────────────────────────────

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
          ? 'আবহাওয়া সেবা এই মুহূর্তে উপলব্ধ নেই।'
          : 'Weather service is temporarily unavailable.',
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
          ? `দুঃখিত, ${normalizedCity} শহরের আবহাওয়া তথ্য পাওয়া যায়নি।`
          : `Could not find weather data for ${normalizedCity}.`,
      language: lang,
      sessionId: activeSessionId,
    };
  }
}

// ── Product Search Handler ────────────────────────────────────────────────────

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
      console.error('[handleProductSearch] DB query failed:', err);
    }
  }

  if (products.length === 0) {
    products = await searchProducts(productType);
  }

  if (products.length > 0) {
    return {
      type: 'PRODUCT_LIST',
      message:
        lang === 'bn'
          ? 'আমি আপনার জন্য কিছু উন্নত মানের প্রোডাক্ট খুঁজে পেয়েছি। অনুগ্রহ করে নির্বাচন করুন:'
          : 'I found these matching products for you. Please select one:',
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

// ── Explain With Groq Helper ────────────────────────────────────────────────────

async function explainWithGroq(rawData: any, lang: 'bn' | 'en'): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for EcoSortha. Given this raw data, explain it to the user in simple, friendly language in 2–3 sentences. If the user wrote in Bangla, reply in Bangla. If English, reply in English.',
        },
        { role: 'user', content: `Language: ${lang}\nRaw Data:\n${JSON.stringify(rawData, null, 2)}` }
      ],
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content || '';
  } catch (err) {
    console.error('[Agent Orchestrator] Groq explanation failed', err);
    return lang === 'bn' ? 'তথ্যটি প্রক্রিয়াকরণ করা যাচ্ছে না।' : 'Could not process the data.';
  }
}

// ── App Help Handler ──────────────────────────────────────────────────────────

async function handleAppHelp(query: string, lang: 'bn' | 'en', activeSessionId: string): Promise<AgentResponse> {
  const lowerQuery = query.toLowerCase();

  let bestMatch = APP_HELP_ENTRIES[0];
  let maxScore = -1;
  for (const entry of APP_HELP_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lowerQuery.includes(kw)) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = entry;
    }
  }

  const rawData = maxScore > 0 ? bestMatch : { info: "No specific help found, provide general guidance about navigating the platform." };
  const explanation = await explainWithGroq(rawData, lang);

  return {
    type: 'APP_HELP',
    message: explanation,
    helpTopic: maxScore > 0 ? bestMatch.topic : 'general',
    language: lang,
    sessionId: activeSessionId,
  };
}

// ── Greeting Handler ──────────────────────────────────────────────────────────

function handleGreeting(lang: 'bn' | 'en', activeSessionId: string, userName?: string): AgentResponse {
  const greetings = {
    en: [
      `Hello${userName ? ' ' + userName : ''}! 👋 I'm EcoSortha AI — your agricultural assistant for BARI compliance, organic product orders, climate forecasts, and platform navigation. How can I help you today?`,
      `Hi there${userName ? ', ' + userName : ''}! 🌱 Ready to help with your organic farming operations. Ask me about products, weather, batch safety, or anything else!`,
    ],
    bn: [
      `নমস্কার${userName ? ' ' + userName : ''}! 👋 আমি EcoSortha AI — BARI কমপ্লায়েন্স, জৈব পণ্য অর্ডার, আবহাওয়া পূর্বাভাস এবং প্ল্যাটফর্ম নেভিগেশনে আপনার সহকারী। আজ কীভাবে সাহায্য করতে পারি?`,
      `আস্সালামু আলাইকুম${userName ? ' ' + userName : ''}! 🌿 আপনার জৈব কৃষি কার্যক্রমে সাহায্য করতে প্রস্তুত। পণ্য, আবহাওয়া, ব্যাচের নিরাপত্তা বা অন্য কিছু জিজ্ঞাসা করুন!`,
    ],
  };
  const options = greetings[lang];
  const greeting = options[Math.floor(Math.random() * options.length)];

  return {
    type: 'GREETING',
    message: greeting,
    language: lang,
    sessionId: activeSessionId,
  };
}

// ── Product Explain Handler ────────────────────────────────────────────────────

async function handleProductExplain(
  query: string,
  lang: 'bn' | 'en',
  activeSessionId: string,
  llmReply?: string
): Promise<AgentResponse> {
  const text = query.toLowerCase();
  let rawData: any = { message: llmReply || "No specific product info available." };

  const terms = ['compost', 'biochar', 'fertilizer', 'neem', 'trichoderma', 'rhizobium'];
  const matched = terms.find(t => text.includes(t));

  if (matched && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${matched}%`)
        .limit(1);
      if (data && data.length > 0) rawData = data[0];
    } catch { /* silently ignore */ }
  }

  const explanation = await explainWithGroq(rawData, lang);

  return {
    type: 'TEXT',
    message: explanation,
    language: lang,
    sessionId: activeSessionId,
  };
}

// ── Order Status Handler ──────────────────────────────────────────────────────

async function handleOrderStatus(
  userId: string | undefined,
  lang: 'bn' | 'en',
  activeSessionId: string
): Promise<AgentResponse> {
  if (!userId || userId === 'guest') {
    return {
      type: 'TEXT',
      message: lang === 'bn' ? 'অর্ডার দেখতে অনুগ্রহ করে লগইন করুন।' : 'Please login to view your orders.',
      language: lang,
      sessionId: activeSessionId,
    };
  }

  let orders: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from('orders').select('*').eq('buyer_id', userId).limit(5);
      if (data) orders = data;
    } catch { /* ignore */ }
  }

  const explanation = await explainWithGroq({ userOrders: orders.length > 0 ? orders : "No orders found." }, lang);

  return {
    type: 'ORDER_STATUS',
    message: explanation,
    language: lang,
    sessionId: activeSessionId,
    rawOrders: orders,
  };
}

// ── Batch Explain Handler ─────────────────────────────────────────────────────

async function handleBatchExplain(
  query: string,
  lang: 'bn' | 'en',
  activeSessionId: string,
  batchId?: string
): Promise<AgentResponse> {
  let bid = batchId;
  if (!bid) {
    const match = query.match(/BCH-\d+/i);
    if (match) bid = match[0].toUpperCase();
  }

  let rawData: any = { error: 'No specific batch provided.' };

  if (bid && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data: batch } = await supabase.from('batches').select('*').eq('batch_number', bid).single();
      if (batch) {
        const { data: readings } = await supabase.from('iot_readings').select('*').eq('batch_id', batch.id).order('timestamp', { ascending: false }).limit(3);
        rawData = { batch, recent_readings: readings || [] };
      } else {
        rawData = { error: `Batch ${bid} not found in database.` };
      }
    } catch { /* ignore */ }
  }

  const explanation = await explainWithGroq(rawData, lang);

  return {
    type: 'TEXT',
    message: explanation,
    language: lang,
    sessionId: activeSessionId,
  };
}

// ── LLM Intent Query ──────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `
You are EcoSortha AI, an intelligent agricultural commerce assistant for Bangladesh's organic farming sector. You understand Bangla, English, and Banglish (mixed) naturally.

You help farmers and SMEs with: weather/climate data, BARI agricultural guidelines, product browsing, placing orders, analyzing batch safety/verification, navigating the platform dashboard, and answering questions about how the platform works.

For every user message, respond with a JSON object in this exact format:
{
  "intent": "weather" | "navigate" | "order" | "product_search" | "bari_advice" | "general_chat" | "greeting" | "product_explain" | "app_help" | "order_status" | "batch_explain",
  "language": "bn" | "en" | "mixed",
  "extractedData": {
    "city": "string or null",
    "page": "dashboard" | "orders" | "marketplace" | "batches" | "batch_verification" | "microclimate" | "climate_demand" | "impact_esg" | "chatbot" | null,
    "productName": "string or null",
    "quantity": "number or null",
    "unit": "string or null",
    "cropContext": "string or null",
    "batchId": "string or null",
    "helpTopic": "dashboard" | "orders" | "batch_verification" | "microclimate" | "marketplace" | "chatbot" | "trust_score" | "dvs" | "login" | "esg" | null
  },
  "replyMessage": "Your natural conversational response in the same language the user used"
}

Intent Rules:
- "greeting": When the user says hi, hello, সালাম, নমস্কার, or starts a new conversation
- "weather": User asks about weather, temperature, climate, আবহাওয়া
- "navigate": User wants to go to a section (dashboard, orders, marketplace, etc.)
- "order": User wants to buy/purchase/order a product
- "order_status": User asks about their existing orders or past purchases
- "product_search": User is browsing or searching for products without intent to order yet
- "product_explain": User asks what a product IS, how it works, its benefits, or what it contains
- "app_help": User asks how to use the app, what a feature does, navigation help
- "batch_explain": User asks about a specific batch's status, readings, or certification
- "bari_advice": BARI guidelines, soil advice, pH, organic farming advice
- "general_chat": Everything else — answer helpfully

Special Rules:
- If the user mentions a batch (BCH-XXX) and asks if it's safe/verified → "navigate" with page "batch_verification" and extract batchId
- If the user responds with just a city name after being asked for one → intent is "weather"
- Always respond in the same language the user wrote in
- "replyMessage" must be warm, conversational, and helpful — never robotic
- Never say "I cannot help with that"

IMPORTANT: Respond ONLY with a valid JSON object. No markdown. No preambles.
`;

interface AgentParsedResult {
  intent: 'weather' | 'navigate' | 'order' | 'product_search' | 'bari_advice' | 'general_chat' | 'greeting' | 'product_explain' | 'app_help' | 'order_status' | 'batch_explain';
  language: 'bn' | 'en' | 'mixed';
  extractedData: {
    city: string | null;
    page: 'dashboard' | 'orders' | 'marketplace' | 'batches' | 'batch_verification' | 'microclimate' | 'climate_demand' | 'impact_esg' | 'chatbot' | null;
    productName: string | null;
    quantity: number | null;
    unit: string | null;
    cropContext: string | null;
    batchId: string | null;
    helpTopic: string | null;
  };
  replyMessage: string;
}

async function queryLLMIntent(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  customProductsContext?: string
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
        { role: 'system', content: AGENT_SYSTEM_PROMPT + (customProductsContext ? `\n\n${customProductsContext}` : '') },
        ...messages,
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    textResult = completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('[Agent Orchestrator] Groq intent classification failed:', error);
  }

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
      batchId: null,
      helpTopic: null,
    },
    replyMessage: textResult || 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।',
  };
}

// ── Main Process Pipeline ─────────────────────────────────────────────────────

export async function processMessage(
  query: string,
  language: 'bn' | 'en',
  sessionId?: string,
  farmerId?: string,
  customProducts?: any[],
  userId?: string
): Promise<AgentResponse> {
  // Resolve or create session (with async DB restoration support)
  let activeSessionId = sessionId;
  let session = sessionId ? await getSessionAsync(sessionId) : undefined;
  if (!session) {
    const newSession = createSession(farmerId, userId);
    activeSessionId = newSession.sessionId;
    session = newSession;
  }

  if (farmerId && !session.farmerId) session.farmerId = farmerId;
  if (userId && !session.userId) session.userId = userId;

  // Format custom products context
  const customProductsContext = Array.isArray(customProducts) && customProducts.length > 0
    ? `Here is the current customized SME product catalog:\n` +
      customProducts.map((p: any) => `- ${p.name} (${p.category || 'Agriculture'}): Price: ${p.price}, Unit: ${p.unit || 'Kg'}, DVS Score: ${p.dvs || 90}, Seller: ${p.seller || 'Custom SME'}`).join('\n')
    : '';

  // Query LLM Intent Layer
  const llmResult = await queryLLMIntent(query, session.history, customProductsContext);

  appendMessage(activeSessionId!, 'user', query);

  const lang: 'bn' | 'en' = (llmResult.language === 'bn') ? 'bn' : 'en';

  try {
    let result: AgentResponse;

    switch (llmResult.intent) {
      case 'greeting': {
        result = handleGreeting(lang, activeSessionId!);
        break;
      }

      case 'app_help': {
        result = await handleAppHelp(query, lang, activeSessionId!);
        break;
      }

      case 'product_explain': {
        result = await handleProductExplain(query, lang, activeSessionId!, llmResult.replyMessage);
        break;
      }

      case 'order_status': {
        result = await handleOrderStatus(userId, lang, activeSessionId!);
        break;
      }

      case 'batch_explain': {
        result = await handleBatchExplain(query, lang, activeSessionId!, llmResult.extractedData?.batchId || undefined);
        break;
      }

      case 'order': {
        result = {
          type: 'ORDER_CONFIRM_PROMPT',
          message: llmResult.replyMessage,
          language: lang,
          sessionId: activeSessionId!,
          pendingOrder: {
            productId: 'pending',
            productName: llmResult.extractedData?.productName || '',
            priceBdt: 0,
            quantity: llmResult.extractedData?.quantity || 1,
            totalBdt: 0,
          },
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
              lang === 'bn'
                ? 'আপনার শহরের নাম জানান, আমি আবহাওয়া তথ্য দেব। যেমন: "ঢাকার আবহাওয়া" বা "Chittagong weather"'
                : 'Please let me know your city name. For example: "Dhaka weather" or "Chittagong আবহাওয়া"',
            language: lang,
            sessionId: activeSessionId!,
          };
        } else {
          result = await handleClimateForecast(normalizedCity, lang, activeSessionId!);
        }
        break;
      }

      case 'navigate': {
        const page = llmResult.extractedData?.page || 'dashboard';
        const isBatchVerification =
          page === 'batch_verification' ||
          (/(safe|verify|validation|verification|নিরাপদ|ভেরিফাই|যাচাই)/i.test(query) &&
            /(batch|ব্যাটচ|ব্যাচ|bch)/i.test(query));

        if (isBatchVerification) {
          const { getBatchesList, getBatchFromStore } = require('./batchStore.service');

          let batchId = llmResult.extractedData?.batchId || '';
          if (!batchId) {
            const bchMatch = query.match(/BCH-\d+/i);
            if (bchMatch) batchId = bchMatch[0].toUpperCase();
          }

          let targetBatch: any = null;
          if (batchId) targetBatch = getBatchFromStore(batchId);
          if (!targetBatch) {
            const list = getBatchesList();
            if (list.length > 0) targetBatch = list[0];
          }

          if (targetBatch) {
            const destZone = targetBatch.destination_zone || 'Old Dhaka';
            const bId = targetBatch.batch_number || targetBatch.id;
            result = {
              type: 'NAVIGATION',
              message:
                lang === 'bn'
                  ? `আমি আপনার ${targetBatch.product_name} ব্যাচ ${bId}-এর নিরাপত্তা যাচাই করছি। ব্যাচ ভেরিফিকেশন পেজে নিয়ে যাওয়া হচ্ছে...`
                  : `Verifying batch ${bId} (${targetBatch.product_name}) destined for ${destZone}. Navigating to Batch Verification...`,
              navigationTarget: 'batch_verification',
              verifiedBatchId: bId,
              verifiedDispatchZone: destZone,
              language: lang,
              sessionId: activeSessionId!,
            };
          } else {
            result = {
              type: 'NAVIGATION',
              message:
                lang === 'bn'
                  ? 'ব্যাচ ভেরিফিকেশন পেজে যাওয়া হচ্ছে। আপনার ব্যাচ আইডি ইনপুট করুন।'
                  : 'Navigating to Batch Verification. Please input your batch ID.',
              navigationTarget: 'batch_verification',
              verifiedBatchId: 'BCH-100',
              verifiedDispatchZone: 'Old Dhaka',
              language: lang,
              sessionId: activeSessionId!,
            };
          }
        } else {
          result = {
            type: 'NAVIGATION',
            message: llmResult.replyMessage,
            navigationTarget: page,
            language: lang,
            sessionId: activeSessionId!,
          };
        }
        break;
      }

      case 'product_search': {
        result = await handleProductSearch(query, lang, activeSessionId!);
        if (llmResult.replyMessage) result.message = llmResult.replyMessage;
        break;
      }

      case 'bari_advice': {
        const ragResult = await queryRAGConversational(query, language, session.history.slice(-5, -1));
        result = {
          type: 'TEXT',
          message: ragResult.answer,
          language: lang,
          sessionId: activeSessionId!,
        };
        break;
      }

      case 'general_chat':
      default: {
        result = {
          type: 'TEXT',
          message: llmResult.replyMessage,
          language: lang,
          sessionId: activeSessionId!,
        };
        break;
      }
    }

    appendMessage(activeSessionId!, 'assistant', result.message);

    // Async log to DB
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
            language: lang,
          });
        } catch (err) {}
      })();
    }

    return result;
  } catch (error) {
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
