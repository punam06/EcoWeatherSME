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
