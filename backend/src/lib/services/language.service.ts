import { franc } from 'franc-min';

// These are the languages Groq llama-3.3-70b-versatile can reply in reliably.
// Agent replies will be generated directly in these languages by Groq at no extra cost.
export const GROQ_SUPPORTED_LANGUAGES: Record<string, string> = {
  'en': 'English',
  'bn': 'Bengali',
  'hi': 'Hindi',
  'ar': 'Arabic',
  'fr': 'French',
  'es': 'Spanish',
  'pt': 'Portuguese',
  'de': 'German',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'tr': 'Turkish',
  'id': 'Indonesian',
  'ms': 'Malay',
  'sw': 'Swahili',
  'ha': 'Hausa',
  'ur': 'Urdu',
  'fa': 'Persian',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'it': 'Italian',
  'nl': 'Dutch',
  'pl': 'Polish',
  'uk': 'Ukrainian'
};

// Map ISO 3166-1 alpha-2 country codes to primary language codes
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'BD': 'bn', 'IN': 'hi', 'PK': 'ur', 'NG': 'ha', 'SA': 'ar',
  'EG': 'ar', 'MA': 'ar', 'DZ': 'ar', 'TN': 'ar', 'LB': 'ar',
  'FR': 'fr', 'SN': 'fr', 'CI': 'fr', 'ML': 'fr', 'CM': 'fr',
  'BF': 'fr', 'NE': 'fr', 'BJ': 'fr', 'TG': 'fr', 'GN': 'fr',
  'ES': 'es', 'MX': 'es', 'CO': 'es', 'AR': 'es', 'PE': 'es',
  'VE': 'es', 'CL': 'es', 'EC': 'es', 'BO': 'es', 'PY': 'es',
  'UY': 'es', 'GT': 'es', 'CU': 'es', 'DO': 'es', 'HN': 'es',
  'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt', 'CV': 'pt',
  'DE': 'de', 'AT': 'de', 'CH': 'de', 'LU': 'de',
  'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'SG': 'zh',
  'JP': 'ja', 'KR': 'ko', 'RU': 'ru', 'BY': 'ru', 'KZ': 'ru',
  'TR': 'tr', 'AZ': 'tr', 'ID': 'id', 'MY': 'ms', 'BN': 'ms',
  'KE': 'sw', 'TZ': 'sw', 'UG': 'sw', 'RW': 'sw',
  'IR': 'fa', 'AF': 'fa', 'VN': 'vi', 'TH': 'th',
  'IT': 'it', 'NL': 'nl', 'BE': 'nl', 'PL': 'pl', 'UA': 'uk',
  'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'NZ': 'en',
  'ZA': 'en', 'GH': 'en', 'ZW': 'en', 'ET': 'en', 'LR': 'en',
  'SL': 'en', 'GM': 'en', 'BW': 'en', 'LS': 'en', 'SZ': 'en'
};

// franc returns ISO 639-3 codes — map to ISO 639-1 for consistency
const FRANC_TO_ISO: Record<string, string> = {
  'eng': 'en', 'ben': 'bn', 'hin': 'hi', 'ara': 'ar', 'fra': 'fr',
  'spa': 'es', 'por': 'pt', 'deu': 'de', 'cmn': 'zh', 'jpn': 'ja',
  'kor': 'ko', 'rus': 'ru', 'tur': 'tr', 'ind': 'id', 'msa': 'ms',
  'swa': 'sw', 'hau': 'ha', 'urd': 'ur', 'pes': 'fa', 'vie': 'vi',
  'tha': 'th', 'ita': 'it', 'nld': 'nl', 'pol': 'pl', 'ukr': 'uk'
};

export function detectLanguageFromText(text: string): string | null {
  if (!text || text.trim().length < 5) return null;
  const detected = franc(text, { minLength: 5 });
  if (detected === 'und') return null;
  return FRANC_TO_ISO[detected] ?? null;
}

export function isGroqSupported(langCode: string): boolean {
  return langCode in GROQ_SUPPORTED_LANGUAGES;
}

export function getLanguageFromCountry(countryCode: string): string {
  return COUNTRY_TO_LANGUAGE[countryCode] ?? 'en';
}

export function resolveEffectiveLanguage(detected: string | null): {
  effectiveLanguage: string;
  isSupported: boolean;
  fallbackNotice: string | null;
} {
  if (!detected || !isGroqSupported(detected)) {
    return {
      effectiveLanguage: 'en',
      isSupported: false,
      fallbackNotice: 'Your language has limited support. Showing English.'
    };
  }
  return {
    effectiveLanguage: detected,
    isSupported: true,
    fallbackNotice: null
  };
}
