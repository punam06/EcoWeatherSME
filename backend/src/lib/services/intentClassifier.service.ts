/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — INTENT CLASSIFIER SERVICE
 * File: src/lib/services/intentClassifier.service.ts
 *
 * Instant keyword-based intent classifier. Does not use Groq
 * to guarantee ultra-low latency and zero token usage.
 * ═══════════════════════════════════════════════════════════════
 */

import { normalizeLanguage } from '../utils/languageNormalizer';

export type AgentIntent =
  | 'PURCHASE_PRODUCT'
  | 'PRODUCT_SEARCH'
  | 'NAVIGATE'
  | 'AUTO_RECOMMEND_BUY'
  | 'ORDER_CONFIRM'
  | 'ORDER_CANCEL'
  | 'PRODUCT_SELECT'
  | 'GENERAL_ADVICE'
  | 'WEATHER_QUERY'
  | 'UNKNOWN';

export interface ExtractedEntities {
  productType?: string;
  cropType?: string;
  quantity?: number;
  unit?: string;
  targetPage?: string;
  selectionIndex?: number;
  cityName?: string;
}

export interface ClassifiedIntent {
  intent: AgentIntent;
  confidence: number;
  extractedEntities: ExtractedEntities;
}

// Page map translations for routing
const PAGE_MAP: Record<string, string> = {
  'dashboard': '/dashboard',
  'ড্যাশবোর্ড': '/dashboard',
  'orders': '/orders',
  'my orders': '/orders',
  'অর্ডার': '/orders',
  'আমার অর্ডার': '/orders',
  'marketplace': '/marketplace',
  'market': '/marketplace',
  'মার্কেটপ্লেস': '/marketplace',
  'মার্কেট': '/marketplace',
  'profile': '/profile',
  'প্রোফাইল': '/profile',
  'settings': '/settings',
  'সেটিংস': '/settings',
  'fertilizer': '/marketplace?category=fertilizer',
  'সার': '/marketplace?category=fertilizer',
  'pesticide': '/marketplace?category=pesticide',
  'কীটনাশক': '/marketplace?category=pesticide',
  'compost': '/marketplace?category=compost',
  'কম্পোস্ট': '/marketplace?category=compost',
};

// Crop keywords
const CROP_KEYWORDS: Record<string, string> = {
  'rice': 'rice',
  'ধান': 'rice',
  'potato': 'potato',
  'আলু': 'potato',
  'tomato': 'tomato',
  'টমেটো': 'tomato',
  'wheat': 'wheat',
  'গম': 'wheat',
};

// Product type keywords
const PRODUCT_KEYWORDS: Record<string, string> = {
  'fertilizer': 'fertilizer',
  'সার': 'fertilizer',
  'compost': 'compost',
  'কম্পোস্ট': 'compost',
  'pesticide': 'pesticide',
  'কীটনাশক': 'pesticide',
  'bio': 'bio-slurry',
  'বায়ো': 'bio-slurry',
};

/**
 * Classifies query intent based on strict keyword matching in Bangla and English.
 */
export function classifyIntent(query: string): ClassifiedIntent {
  const normalized = normalizeLanguage(query);

  const entities: ExtractedEntities = {};

  // 1. Check for Selection Index (e.g. 1st, first, first one, ১, ২, ৩, প্রথম, দ্বিতীয়)
  const selectionMatches = normalized.match(/\b(first|second|third|1st|2nd|3rd)\b/) || 
                           normalized.match(/(প্রথম|দ্বিতীয়|তৃতীয়|১|২|৩|নম্বর)/);
  if (selectionMatches) {
    const matchedStr = selectionMatches[0];
    let index = -1;
    if (matchedStr.includes('first') || matchedStr.includes('1st') || matchedStr.includes('প্রথম') || matchedStr === '১') {
      index = 0;
    } else if (matchedStr.includes('second') || matchedStr.includes('2nd') || matchedStr.includes('দ্বিতীয়') || matchedStr === '২') {
      index = 1;
    } else if (matchedStr.includes('third') || matchedStr.includes('3rd') || matchedStr.includes('তৃতীয়') || matchedStr === '৩') {
      index = 2;
    }
    if (index >= 0) {
      entities.selectionIndex = index;
      return {
        intent: 'PRODUCT_SELECT',
        confidence: 0.95,
        extractedEntities: entities,
      };
    }
  }

  // 2. Check Order Confirmation
  const confirmKeywords = ['yes', 'confirm', 'ok', 'sure', 'agree', 'হ্যাঁ', 'ঠিক আছে', 'কনফার্ম', 'নিশ্চিত'];
  // Match confirm keywords as standalone words/phrases to prevent substring false-positives
  if (confirmKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(normalized) || normalized === kw;
  })) {
    return {
      intent: 'ORDER_CONFIRM',
      confidence: 0.9,
      extractedEntities: {},
    };
  }

  // 3. Check Order Cancel
  const cancelKeywords = ['no', 'cancel', 'stop', 'abort', 'reject', 'না', 'বাদ', 'বাতিল', 'ক্যান্সেল'];
  // Match cancel keywords as standalone words/phrases (excluding 'konta' / 'kon' substring collisions)
  if (cancelKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return (regex.test(normalized) || normalized === kw) && !normalized.includes('konta') && !normalized.includes('kon');
  })) {
    return {
      intent: 'ORDER_CANCEL',
      confidence: 0.9,
      extractedEntities: {},
    };
  }

  // Extract Crop Type if any
  for (const [kw, crop] of Object.entries(CROP_KEYWORDS)) {
    if (normalized.includes(kw)) {
      entities.cropType = crop;
      break;
    }
  }

  // Extract Product Type if any
  for (const [kw, prod] of Object.entries(PRODUCT_KEYWORDS)) {
    if (normalized.includes(kw)) {
      entities.productType = prod;
      break;
    }
  }

  // Extract Quantity if any (e.g. 5 bags, ১০ কেজি, 20)
  const qtyMatch = normalized.match(/\b(\d+)\b/);
  if (qtyMatch) {
    entities.quantity = parseInt(qtyMatch[1], 10);
  }

  // 4. Auto Recommend Buy Intent
  const autoKeywords = ['best', 'recommend', 'auto', 'সেরাটা', 'ভালোটা', 'বেছে দাও', 'তুমি বেছে নাও'];
  if (autoKeywords.some((kw) => normalized.includes(kw)) && (entities.productType || entities.cropType)) {
    return {
      intent: 'AUTO_RECOMMEND_BUY',
      confidence: 0.85,
      extractedEntities: entities,
    };
  }

  // 5. Purchase Product Intent
  const buyKeywords = ['buy', 'purchase', 'order', 'want to buy', 'কিনব', 'কিনতে চাই', 'অর্ডার করব', 'দাও', 'নেব'];
  if (buyKeywords.some((kw) => normalized.includes(kw)) && (entities.productType || entities.cropType)) {
    return {
      intent: 'PURCHASE_PRODUCT',
      confidence: 0.85,
      extractedEntities: entities,
    };
  }

  // 6. Navigation Intent
  const goKeywords = ['go to', 'navigate', 'open', 'show me', 'যাও', 'দেখাও', 'নিয়ে যাও', 'খোলো'];
  if (goKeywords.some((kw) => normalized.includes(kw))) {
    for (const [pageKw, route] of Object.entries(PAGE_MAP)) {
      if (normalized.includes(pageKw)) {
        entities.targetPage = route;
        return {
          intent: 'NAVIGATE',
          confidence: 0.95,
          extractedEntities: entities,
        };
      }
    }
  }

  // 7. Product Search Intent
  const searchKeywords = ['search', 'find', 'show', 'look for', 'খুঁজে দাও', 'খুঁজছি', 'দেখাও', 'কোথায়'];
  if (searchKeywords.some((kw) => normalized.includes(kw)) || entities.productType || entities.cropType) {
    return {
      intent: 'PRODUCT_SEARCH',
      confidence: 0.8,
      extractedEntities: entities,
    };
  }

  // 7.5 Weather Query Intent
  const bnWeatherKws = ['আবহাওয়া', 'আবহাওয়ার', 'তাপমাত্রা', 'বৃষ্টি', 'রোদ', 'ঝড়', 'মেঘ', 'গরম', 'ঠান্ডা', 'weather'];
  const enWeatherKws = ['weather', 'temperature', 'rain', 'sunny', 'forecast', 'hot', 'cold', 'humid', 'climate'];
  const weatherKeywords = [...bnWeatherKws, ...enWeatherKws];

  if (weatherKeywords.some((kw) => normalized.includes(kw))) {
    // Extract city name: strip weather keywords and filler words
    const fillers = ['te', 'এ', 'তে', 'in', 'at', 'of', 'কেমন', 'কি', 'ekhon', 'এখন', 'আবহাওয়া', 'আবহাওয়ার', 'আবহাওয়া:', 'weather', 'weather?', 'temperature', 'rain', 'sunny', 'forecast', 'hot', 'cold', 'humid', 'climate', 'kemon', 'kemon?', 'ache', 'achi', 'eikhane', 'eikhaner'];
    let remainingText = normalized;
    for (const filler of fillers) {
      const regex = new RegExp(`\\b${filler}\\b|${filler}`, 'gi');
      remainingText = remainingText.replace(regex, ' ');
    }
    
    // Clean up remaining text to get the city name (first word of what remains)
    const words = remainingText.trim().split(/\s+/).filter(w => w.length > 1);
    if (words.length > 0) {
      entities.cityName = words[0];
    }

    return {
      intent: 'WEATHER_QUERY',
      confidence: 0.9,
      extractedEntities: entities,
    };
  }

  // 8. General Advice / BARI standard questions
  const adviceKeywords = ['bari', 'ph', 'ec', 'temperature', 'fermentation', 'uhi', 'tst', 'standards', 'নিয়ম', 'মানদণ্ড'];
  if (adviceKeywords.some((kw) => normalized.includes(kw))) {
    return {
      intent: 'GENERAL_ADVICE',
      confidence: 0.75,
      extractedEntities: {},
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.0,
    extractedEntities: {},
  };
}
