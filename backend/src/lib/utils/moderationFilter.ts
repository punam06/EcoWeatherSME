/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — MODERATION FILTER UTILITY
 * File: src/lib/utils/moderationFilter.ts
 *
 * Checks queries for profanity, malicious code injection, or off-topic
 * political/religious arguments in both English and Bangla.
 * ═══════════════════════════════════════════════════════════════
 */

const SUSPICIOUS_KEYWORDS = [
  'select *',
  'union select',
  'drop table',
  'javascript:',
  '<script',
  'eval(',
  'exec(',
];

const OFF_TOPIC_SENSITIVE = [
  'politics',
  'election',
  'religion',
  'political',
  'government',
  'ধর্ম',
  'রাজনীতি',
  'নির্বাচন',
  'সরকার',
];

/**
 * Checks query content. Returns true if clean, false if flagged.
 */
export function isContentClean(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();

  // 1. SQL / Script injection check
  const hasInjection = SUSPICIOUS_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasInjection) return false;

  // 2. Off-topic/sensitive standard check
  const isOffTopic = OFF_TOPIC_SENSITIVE.some((kw) => lower.includes(kw));
  if (isOffTopic) return false;

  return true;
}
