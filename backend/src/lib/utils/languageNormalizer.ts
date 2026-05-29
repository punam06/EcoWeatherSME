/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — LANGUAGE NORMALIZATION UTILITY
 * File: src/lib/utils/languageNormalizer.ts
 *
 * Handles mixed Bangla-English inputs, phonetic translations,
 * and normalizes special characters/spaces to standard formats.
 * ═══════════════════════════════════════════════════════════════
 */

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

