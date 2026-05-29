/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — INTENT CLASSIFIER SERVICE
 * File: src/lib/services/intentClassifier.service.ts
 *
 * Implements regex-based, ultra-low latency intent classification
 * and city name suffix normalization.
 * ═══════════════════════════════════════════════════════════════
 */

export type IntentType =
  | 'order_intent'
  | 'weather_intent'
  | 'product_search_intent'
  | 'bari_advice_intent'
  | 'general_rag_intent';

/**
 * Normalizes city names from raw user queries (e.g. "dhakar" -> "Dhaka", "dhakaer" -> "Dhaka").
 * Strips Bangla and English suffixes and maps known variations to canonical forms.
 */
export function cityNameNormalizer(input: string): string {
  if (!input) return '';

  // Clean fillers
  const fillers = ['weather', 'forecast', 'climate', 'show', 'me', 'temperature', 'rain', 'আবহাওয়া', 'জলবায়ু', 'তাপমাত্রা', 'বৃষ্টি', 'ki', 'kি', 'kemon', 'কেমন', 'in', 'at', 'of', 'te', 'এ', 'তে'];
  let clean = input.toLowerCase().trim();
  for (const filler of fillers) {
    const regex = new RegExp(`\\b${filler}\\b|${filler}`, 'gi');
    clean = clean.replace(regex, ' ');
  }

  // Strip suffixes: "এর", "র", "তে", "এ"
  clean = clean.replace(/(?:এর|র|তে|এ)$/gi, '').trim();
  clean = clean.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?।'"\\]/g, '').trim();

  // Mapping
  const cityMapping: Record<string, string> = {
    'dhaka': 'Dhaka',
    'dhakaa': 'Dhaka',
    'ঢাকায়': 'Dhaka',
    'ঢাকা': 'Dhaka',
    'ঢাকার': 'Dhaka',
    'ঢাকায়': 'Dhaka',
    'chittagong': 'Chittagong',
    'chittaganger': 'Chittagong',
    'চট্টগ্রাম': 'Chittagong',
    'চট্টগ্রামের': 'Chittagong',
    'sylhet': 'Sylhet',
    'sylheter': 'Sylhet',
    'সিলেট': 'Sylhet',
    'সিলেটের': 'Sylhet',
    'khulna': 'Khulna',
    'খুলনা': 'Khulna',
    'rajshahi': 'Rajshahi',
    'রাজশাহী': 'Rajshahi',
    'barisal': 'Barisal',
    'বরিশাল': 'Barisal',
    'rangpur': 'Rangpur',
    'রংপুর': 'Rangpur',
  };

  return cityMapping[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
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
