import { Router, Request, Response } from 'express';
import { getWeatherByCity } from '../../lib/services/weather.service';

const router = Router();

// In-memory weather cache (10 minutes TTL)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const weatherCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

router.get('/:city', async (req: Request, res: Response) => {
  const { city } = req.params;
  const lang = (req.query.lang as 'bn' | 'en') || 'en';
  const cacheKey = `${city.toLowerCase()}:${lang}`;

  // Check cache first
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (process.env.WEATHER_DEBUG === '1') {
      console.log(`[WeatherRoute] Cache HIT for ${city} (lang: ${lang})`);
    }
    return res.json({
      success: true,
      source: 'cache',
      data: cached.data,
      cachedAt: new Date(cached.timestamp).toISOString(),
    });
  }

  if (process.env.WEATHER_DEBUG === '1') {
    console.log(`[WeatherRoute] Cache MISS/EXPIRED for ${city} (lang: ${lang}), calling OpenWeather...`);
  }

  // Fetch from OpenWeather
  const result = await getWeatherByCity(city, lang);

  if (result.found) {
    const payload = {
      temperature: result.temperature,
      feelsLike: result.feelsLike,
      description: result.description,
      humidity: result.humidity,
      windSpeed: result.windSpeed,
      city: result.city,
    };
    weatherCache.set(cacheKey, {
      data: payload,
      timestamp: Date.now(),
    });
    return res.json({
      success: true,
      source: 'live',
      data: payload,
    });
  }

  // If fetch failed (missing API key, rate limit, invalid city), return fallback diurnal estimate
  if (process.env.WEATHER_DEBUG === '1') {
    console.warn(`[WeatherRoute] OpenWeather query failed for ${city}: ${result.description}. Using fallback estimate.`);
  }

  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const peak = 13;
  const low = 5;
  const closer = Math.min(Math.abs(h - peak), Math.abs(h - low));
  const temp = 26 + (8.5 * (1 - Math.cos((closer / 8) * Math.PI)) / 2);
  const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
  
  const fallbackPayload = {
    temperature: Math.round((temp + (Math.random() * 2 - 1)) * 10) / 10,
    feelsLike: Math.round((temp + 1.5) * 10) / 10,
    description: lang === 'bn' ? 'আংশিক মেঘলা (আনুমানিক)' : 'Partly cloudy (Estimated fallback)',
    humidity: 65,
    windSpeed: wind,
    city: city,
  };

  return res.json({
    success: true,
    source: 'fallback',
    errorDetails: result.description,
    data: fallbackPayload,
  });
});

export default router;
