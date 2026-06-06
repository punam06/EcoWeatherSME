/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — AGRONOMY GLOSSARY
 * File: src/lib/data/agronomy_glossary.ts
 *
 * Bilingual Banglish ↔ Standard English glossary for agronomy
 * and climate terms used in Bangladesh. Used by the RAG pipeline
 * to normalise mixed-language queries before Groq completion.
 *
 * Each entry maps one or more Banglish/transliteration variants
 * to a canonical English term for keyword matching.
 * ═══════════════════════════════════════════════════════════════
 */

export interface GlossaryEntry {
  /** Canonical English term used in BARI knowledge chunks */
  canonical: string;
  /** Bangla script variant(s) */
  bangla: string[];
  /** Common Banglish / transliteration variants */
  banglish: string[];
}

export const AGRONOMY_GLOSSARY: ReadonlyArray<GlossaryEntry> = [
  {
    canonical: 'compost',
    bangla: ['কম্পোস্ট', 'সার'],
    banglish: ['compost', 'komposter', 'jaibosar', 'jibo sar', 'organic sar'],
  },
  {
    canonical: 'pH',
    bangla: ['পিএইচ'],
    banglish: ['ph', 'pee ach', 'p h', 'acidity', 'ashidity'],
  },
  {
    canonical: 'electrical conductivity',
    bangla: ['তড়িৎ পরিবাহিতা', 'ইসি'],
    banglish: ['ec', 'e c', 'conductivity', 'loanity', 'lonota', 'toadit'],
  },
  {
    canonical: 'fermentation',
    bangla: ['গাঁজন', 'গ্যাঁজন', 'ফারমেন্টেশন'],
    banglish: ['fermentation', 'gajno', 'gajan', 'fargmentation'],
  },
  {
    canonical: 'temperature',
    bangla: ['তাপমাত্রা'],
    banglish: ['temp', 'temperature', 'taap', 'taapmatra', 'garam'],
  },
  {
    canonical: 'trust score',
    bangla: ['বিশ্বাস স্কোর', 'ট্রাস্ট স্কোর'],
    banglish: ['trust score', 'trust', 'biswash', 'bishshash score', 'quality score'],
  },
  {
    canonical: 'delivery viability score',
    bangla: ['ডেলিভারি স্কোর', 'ডিভিএস'],
    banglish: ['dvs', 'd v s', 'delivery score', 'delivery viability', 'delibhary score'],
  },
  {
    canonical: 'biochar',
    bangla: ['বায়োচার'],
    banglish: ['biochar', 'bio char', 'baio char', 'baiochar'],
  },
  {
    canonical: 'EM-1 microbial inoculant',
    bangla: ['ইএম-১', 'কার্যকর অণুজীব'],
    banglish: ['em-1', 'em1', 'effective microorganism', 'inoculant', 'inokulan', 'emone'],
  },
  {
    canonical: 'fertilizer',
    bangla: ['সার', 'রাসায়নিক সার'],
    banglish: ['fertilizer', 'fertiliser', 'sar', 'jobosar', 'rasaynik sar', 'khabar'],
  },
  {
    canonical: 'Urban Heat Island',
    bangla: ['শহুরে তাপ দ্বীপ'],
    banglish: ['uhi', 'u h i', 'urban heat', 'shahor garam', 'heat island', 'city heat'],
  },
  {
    canonical: 'thermal risk',
    bangla: ['তাপীয় ঝুঁকি'],
    banglish: ['thermal risk', 'heat risk', 'garam jokhom', 'tapiya jokhom'],
  },
  {
    canonical: 'packaging',
    bangla: ['প্যাকেজিং', 'মোড়ক'],
    banglish: ['packaging', 'package', 'pack', 'morok', 'morak'],
  },
  {
    canonical: 'dispatch',
    bangla: ['প্রেরণ', 'পাঠানো'],
    banglish: ['dispatch', 'send', 'pathano', 'deliver', 'peron'],
  },
  {
    canonical: 'organic',
    bangla: ['জৈব', 'অর্গানিক'],
    banglish: ['organic', 'joibo', 'jaibok', 'natural', 'prithibo'],
  },
  {
    canonical: 'BARI',
    bangla: ['বারি', 'বাংলাদেশ কৃষি গবেষণা ইনস্টিটিউট'],
    banglish: ['bari', 'bangladesh agriculture', 'krishi institute', 'research institute'],
  },
  {
    canonical: 'crop',
    bangla: ['ফসল', 'শস্য'],
    banglish: ['crop', 'fosol', 'shosho', 'fields', 'dhan', 'wheat'],
  },
  {
    canonical: 'soil',
    bangla: ['মাটি'],
    banglish: ['soil', 'mati', 'ground', 'bhumi'],
  },
  {
    canonical: 'salinity',
    bangla: ['লবণাক্ততা'],
    banglish: ['salinity', 'salt', 'lobonakta', 'lona mati'],
  },
  {
    canonical: 'batch certification',
    bangla: ['ব্যাচ সার্টিফিকেশন', 'প্রত্যয়ন'],
    banglish: ['certification', 'certify', 'certifcation', 'batch cert', 'certified'],
  },
];

/**
 * Normalises a query string by expanding Banglish / Bangla terms
 * to their canonical English equivalents. The original text is
 * preserved; canonical terms are appended for broader matching.
 *
 * Example:
 *   "jaibosar er ph koto hobe?" →
 *   "jaibosar er ph koto hobe? compost pH"
 */
export function normalizeBanglishQuery(query: string): string {
  const lower = query.toLowerCase();
  const expansions: string[] = [];

  for (const entry of AGRONOMY_GLOSSARY) {
    const variants = [
      ...entry.bangla.map((v) => v.toLowerCase()),
      ...entry.banglish.map((v) => v.toLowerCase()),
    ];

    const matched = variants.some((v) => lower.includes(v));
    if (matched && !lower.includes(entry.canonical.toLowerCase())) {
      expansions.push(entry.canonical);
    }
  }

  if (expansions.length === 0) return query;
  return `${query} ${expansions.join(' ')}`;
}

/**
 * Detects whether a query contains significant Banglish content
 * (romanised Bangla words mixed with English). Returns true if 2+
 * Banglish variants from the glossary are detected.
 */
export function isBanglishQuery(query: string): boolean {
  const lower = query.toLowerCase();
  let banglishHits = 0;

  for (const entry of AGRONOMY_GLOSSARY) {
    const hasBanglish = entry.banglish.some((v) => lower.includes(v.toLowerCase()));
    if (hasBanglish) {
      banglishHits++;
      if (banglishHits >= 2) return true;
    }
  }

  return false;
}
