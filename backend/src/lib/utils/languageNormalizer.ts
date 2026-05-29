/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — LANGUAGE NORMALIZATION UTILITY
 * File: src/lib/utils/languageNormalizer.ts
 *
 * Handles mixed Bangla-English inputs, phonetic translations,
 * dialect/accent normalizations, and space cleanups.
 * ═══════════════════════════════════════════════════════════════
 */

// Dictionary mapping common regional dialect/accent terms to standard Bangla
const DIALECT_MAP: Record<string, string> = {
  // Chittagonian phonetic variants
  'হঁত্তে': 'কোথা থেকে',
  'আঁই': 'আমি',
  'আঁরে': 'আমাকে',
  'উয়ার': 'উপরে',
  'বেয়াগ্গিন': 'সবকিছু',
  'অন': 'আপনি',
  'গইরগুম': 'করব',
  'গম': 'ভালো',
  'হন': 'কোন',
  'কিত্তাল': 'কেন',
  'হতি': 'ক্ষতি',
  'হাল': 'খাল',
  'হাতা': 'পাতা',
  
  // Sylheti phonetic variants
  'খইবা': 'বলবেন',
  'খৈন': 'বলেন',
  'মাতইন': 'কথা বলেন',
  'হুরু': 'ছোট',
  'লাখান': 'মত',
  'কিতাবইন্যা': 'কেমন',
  'খানি': 'খাবার',
  'আফনে': 'আপনি',
  'আফনার': 'আপনার',
  'বাফ': 'বাবা',
  'মাতো': 'কথা বলো',
  'হউ': 'সব',

  // North Bengal (Rangpur/Rajshahi) phonetic variants
  'হামার': 'আমার',
  'হামাক': 'আমাকে',
  'মোরে': 'আমাকে',
  'তুহিন': 'তুমি',
  'লেঙ্গুর': 'লেজ',
  'কুনঠে': 'কোথায়',
  'ক্যাংকরি': 'কেমন করে',
  'ক্যাংকরে': 'কেমন করে',
  'ব্যামো': 'অসুখ',
  'আঁটি': 'বীজ',
};

/**
 * Normalizes input text to simplify search/matching.
 * Removes extra whitespace, punctuation, and maps common variations.
 */
export function normalizeLanguage(text: string): string {
  if (!text) return '';
  
  let normalized = text.toLowerCase().trim();

  // Remove common punctuation that doesn't help keyword matching
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?।'"\\]/g, ' ');

  // Replace multiple spaces with a single space
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
}

/**
 * Auto-detects language from raw message text.
 * Returns 'bn' if Bangla characters or 2+ Romanized Bangla keywords are found, otherwise 'en'.
 */
export function detectLanguageFromText(text: string): 'bn' | 'en' {
  if (!text) return 'en';

  // 1. Check for Unicode Bangla characters (\u0980 to \u09FF)
  if (/[\u0980-\u09FF]/.test(text)) {
    return 'bn';
  }

  // 2. Check for Romanized Bangla indicators
  const romanizedWords = [
    'ami', 'amar', 'achi', 'kemon', 'ekhon', 'ki', 'koi', 'boro', 'choto',
    'bhalo', 'kharap', 'bogura', 'dhaka', 'sylhet', 'khulna', 'chittagong'
  ];

  const lower = text.toLowerCase();
  // Find all words in the input text and check how many are Romanized Bangla words
  const words = lower.match(/\b\w+\b/g) || [];
  
  let matchCount = 0;
  for (const word of words) {
    if (romanizedWords.includes(word)) {
      matchCount++;
      if (matchCount >= 2) {
        return 'bn';
      }
    }
  }

  return 'en';
}

/**
 * Normalizes regional dialects and accents (Chittagonian, Sylheti, North Bengal)
 * into standard Bangla terms to ensure proper intent parsing and RAG retrieval accuracy.
 */
export function dialectNormalizer(transcript: string, detectedLocale?: string): string {
  if (!transcript) return '';

  let normalized = transcript;

  // Swap known dialect variants with standard Bangla
  for (const [dialectWord, standardWord] of Object.entries(DIALECT_MAP)) {
    const regex = new RegExp(`(?<=^|\\s)${dialectWord}(?=\\s|$|[.,।!?])`, 'g');
    normalized = normalized.replace(regex, standardWord);
  }

  return normalized;
}
