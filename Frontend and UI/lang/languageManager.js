/**
 * EcoSortha Global Language Manager (EcoLang)
 * Handles IP-based fallback, local storage persistence, and component state syncing.
 */
const EcoLang = (function () {
  let currentLanguage = localStorage.getItem('ecoLang') || null;
  let listeners = [];
  let supportedLanguages = {};

  const ISO_TO_SPEECH_CODES = {
    'en': 'en-US', 'bn': 'bn-BD', 'hi': 'hi-IN', 'ar': 'ar-SA',
    'fr': 'fr-FR', 'es': 'es-ES', 'pt': 'pt-BR', 'de': 'de-DE',
    'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR', 'ru': 'ru-RU',
    'tr': 'tr-TR', 'id': 'id-ID', 'ms': 'ms-MY', 'sw': 'sw-KE',
    'th': 'th-TH', 'vi': 'vi-VN', 'it': 'it-IT', 'nl': 'nl-NL',
    'pl': 'pl-PL', 'uk': 'uk-UA'
  };

  function notify() {
    listeners.forEach(fn => fn(currentLanguage));
  }

  return {
    async initialize() {
      try {
        const langRes = await fetch('/api/language/supported-languages');
        const langData = await langRes.json();
        supportedLanguages = langData.languages || {};

        if (!currentLanguage) {
          const locRes = await fetch('/api/language/detect-location');
          const locData = await locRes.json();
          currentLanguage = locData.effectiveLanguage || 'en';
          localStorage.setItem('ecoLang', currentLanguage);
        }
      } catch (err) {
        console.error('Failed to init EcoLang:', err);
        if (!currentLanguage) currentLanguage = 'en';
      }
      return currentLanguage;
    },

    getCurrentLanguage() {
      return currentLanguage || 'en';
    },

    getSpeechCode() {
      const lang = this.getCurrentLanguage();
      return ISO_TO_SPEECH_CODES[lang] || `${lang}-${lang.toUpperCase()}`;
    },

    setLanguage(langCode) {
      if (currentLanguage !== langCode) {
        currentLanguage = langCode;
        localStorage.setItem('ecoLang', langCode);
        notify();
      }
    },

    getSupportedLanguages() {
      return supportedLanguages;
    },

    onLanguageChange(callback) {
      listeners.push(callback);
      return () => {
        listeners = listeners.filter(fn => fn !== callback);
      };
    }
  };
})();

window.EcoLang = EcoLang;
