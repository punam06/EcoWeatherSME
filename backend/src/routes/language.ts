import { Router, Request, Response } from 'express';
import {
  detectLanguageFromText,
  resolveEffectiveLanguage,
  GROQ_SUPPORTED_LANGUAGES
} from '../lib/services/language.service';
import { detectLanguageFromIP } from '../lib/services/geolocation.service';
import { getLanguageFromCountry } from '../lib/services/language.service';

const router = Router();

// Called on app load — detects language from IP or country override header
router.get('/detect-location', async (req: Request, res: Response) => {
  const countryOverride = req.headers['x-country-override'] as string | undefined;

  let countryCode: string | null = countryOverride ?? null;
  let detectedLanguage = 'en';

  if (countryCode) {
    detectedLanguage = getLanguageFromCountry(countryCode);
  } else {
    const ip = (req.headers['x-forwarded-for'] as string)
      ?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? '127.0.0.1';
    const result = await detectLanguageFromIP(ip);
    countryCode = result.countryCode;
    detectedLanguage = result.detectedLanguage;
  }

  const resolved = resolveEffectiveLanguage(detectedLanguage);

  return res.json({
    detectedLanguage,
    countryCode: countryCode ?? 'unknown',
    ...resolved
  });
});

// Called before sending user text to agent — detects language of typed input
router.post('/detect-text', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const detected = detectLanguageFromText(text);
  const resolved = resolveEffectiveLanguage(detected);

  return res.json({
    detectedLanguage: detected ?? 'en',
    ...resolved
  });
});

// Returns full list of Groq-supported languages for the manual selector dropdown
router.get('/supported-languages', (_req: Request, res: Response) => {
  return res.json({ languages: GROQ_SUPPORTED_LANGUAGES });
});

export default router;
