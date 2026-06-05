import axios from 'axios';
import { getLanguageFromCountry } from './language.service';

export async function getCountryFromIP(ip: string): Promise<string | null> {
  const cleanIP = (ip === '::1' || ip === '127.0.0.1') ? null : ip;
  if (!cleanIP) return null;
  try {
    // ip-api.com: completely free, no API key required, 45 requests/minute
    const response = await axios.get(
      `http://ip-api.com/json/${cleanIP}?fields=countryCode`,
      { timeout: 3000 }
    );
    return response.data?.countryCode ?? null;
  } catch {
    return null;
  }
}

export async function detectLanguageFromIP(ip: string): Promise<{
  countryCode: string | null;
  detectedLanguage: string;
}> {
  const countryCode = await getCountryFromIP(ip);
  const detectedLanguage = countryCode
    ? getLanguageFromCountry(countryCode)
    : 'en';
  return { countryCode, detectedLanguage };
}
