/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — INTENT CLASSIFIER SERVICE
 * File: src/lib/services/intentClassifier.service.ts
 *
 * Implements regex-based intent classification and comprehensive 
 * city name normalization to strip Bangla geographic suffixes.
 * ═══════════════════════════════════════════════════════════════
 */

export type IntentType =
  | 'order_intent'
  | 'weather_intent'
  | 'product_search_intent'
  | 'bari_advice_intent'
  | 'general_rag_intent';

const NOISE_TOKENS = new Set([
  // Weather keywords
  'weather', 'forecast', 'climate', 'temperature', 'আবহাওয়া', 'তাপমাত্রা', 'বৃষ্টি',
  // Geographic noise words
  'sohorer', 'sohor', 'shohorer', 'shohor', 'city', 'district', 'division', 'jela', 'জেলা', 'শহর',
  // Question/filler particles
  'ki', 'kি', 'kemon', 'ache', 'আছে', 'কি', 'কেমন', 'বলুন', 'জানাও', 'দেখাও',
  // Prepositions
  'er', 'র', 'এর', 'te', 'তে', 'e', 'এ', 'ke', 'কে', 'r',
]);

const SUFFIX_PATTERNS = [
  /sohorer$/i, /shohor$/i, /sohor$/i,
  /er$/i, /র$/, /এর$/,
  /te$/i, /তে$/,
  /ke$/i, /কে$/,
  /thi$/i,
];

const CITY_MAP: Record<string, string> = {
  // Barisal variants
  'borishal': 'Barisal', 'barisal': 'Barisal', 'barishal': 'Barisal',
  'barsal': 'Barisal', 'borisol': 'Barisal',
  // Bogra variants  
  'bogura': 'Bogra', 'bogra': 'Bogra', 'bogora': 'Bogra',
  // Dhaka variants
  'dhaka': 'Dhaka', 'dhakar': 'Dhaka', 'dacca': 'Dhaka',
  // Chittagong variants
  'chittagong': 'Chittagong', 'chattogram': 'Chittagong', 'chittagon': 'Chittagong',
  // Sylhet variants
  'sylhet': 'Sylhet', 'silhet': 'Sylhet',
  // Rajshahi variants
  'rajshahi': 'Rajshahi', 'rajsahi': 'Rajshahi',
  // Khulna variants
  'khulna': 'Khulna', 'kulna': 'Khulna',
  // Rangpur variants
  'rangpur': 'Rangpur', 'rangpour': 'Rangpur',
  // Mymensingh variants
  'mymensingh': 'Mymensingh', 'mymensing': 'Mymensingh', 'maimansingh': 'Mymensingh',
  // Comilla variants
  'comilla': 'Comilla', 'cumilla': 'Comilla',
  // Cox's Bazar variants
  'coxsbazar': "Cox's Bazar", 'coxbazar': "Cox's Bazar", 'cox': "Cox's Bazar",
  // Jessore variants
  'jessore': 'Jessore', 'jashore': 'Jessore',
  // Narayanganj
  'narayanganj': 'Narayanganj', 'narayangonj': 'Narayanganj',
  // Gazipur
  'gazipur': 'Gazipur', 'gajipur': 'Gazipur',
};

export function cityNameNormalizer(input: string): string | null {
  if (!input) return null;
  const tokens = input.toLowerCase().trim().split(/\s+/);

  for (const rawToken of tokens) {
    // Skip known noise tokens
    if (NOISE_TOKENS.has(rawToken)) continue;

    // Try direct map lookup first
    if (CITY_MAP[rawToken]) return CITY_MAP[rawToken];

    // Strip suffixes and try again
    let stripped = rawToken;
    for (const pattern of SUFFIX_PATTERNS) {
      const candidate = stripped.replace(pattern, '');
      if (candidate.length > 2 && CITY_MAP[candidate]) {
        return CITY_MAP[candidate];
      }
      if (candidate.length > 2) stripped = candidate;
    }

    // Try stripped token after all suffix removal
    if (stripped.length > 2 && CITY_MAP[stripped]) {
      return CITY_MAP[stripped];
    }
  }

  return null; // No city found
}

/**
 * Classifies query intent strictly in the requested priority order.
 */
export function classifyIntent(message: string, lang: string = 'bn'): IntentType {
  const text = message.toLowerCase().trim();

  // 1. ORDER INTENT
  if (/(order|অর্ডার|কিনতে|buy|purchase|bag|কেজি|kg|পরিমাণ).*(fertilizer|সার|compost|কম্পোস্ট|product|পণ্য)/i.test(text) ||
      /(fertilizer|সার|compost|কম্পোস্ট).*(order|কিনতে|buy)/i.test(text)) {
    return 'order_intent';
  }

  // 2. WEATHER / CLIMATE INTENT
  if (/(weather|আবহাওয়া|climate|জলবায়ু|forecast|তাপমাত্রা|temperature|বৃষ্টি|rain|dispatch|dvs|microclimate)/i.test(text)) {
    return 'weather_intent';
  }

  // 3. PRODUCT SEARCH INTENT — only when explicitly searching
  if (/(show|find|search|খুঁজ|দেখাও|আছে কি|available|stock).*(product|fertilizer|সার|compost|item|পণ্য)/i.test(text) ||
      /^(fertilizer|সার|compost|কম্পোস্ট|product|পণ্য)$/.test(text)) {
    return 'product_search_intent';
  }

  // 4. BARI / AGRICULTURAL ADVICE
  if (/(bari|বারি|organic|জৈব|ph|ec|trust score|fermentation|গাঁজন|guideline|advice|পরামর্শ)/i.test(text)) {
    return 'bari_advice_intent';
  }

  // 5. DEFAULT — send to Claude RAG for general response
  return 'general_rag_intent';
}
