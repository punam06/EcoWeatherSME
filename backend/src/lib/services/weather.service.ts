/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — WEATHER SERVICE
 * File: src/lib/services/weather.service.ts
 *
 * Integrates with OpenWeatherMap Free API to retrieve real-time regional
 * weather in Bangla and English.
 * ═══════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch';

export interface WeatherResult {
  city: string;
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  found: boolean;
}

/**
 * Fetches real-time weather for a city name.
 * Natively supports English ('en') and Bangla ('bn') weather descriptions.
 */
export async function getWeatherByCity(cityName: string, language: 'bn' | 'en'): Promise<WeatherResult> {
  const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('[WeatherService] WEATHER_API_KEY/OPENWEATHER_API_KEY is missing in environment variables.');
    return {
      city: cityName,
      temperature: 0,
      feelsLike: 0,
      description: 'API key missing',
      humidity: 0,
      windSpeed: 0,
      found: false,
    };
  }

  try {
    const lang = language === 'bn' ? 'bn' : 'en';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric&lang=${lang}`;
    
    const response = await fetch(url);
    const data: any = await response.json();

    if (String(data.cod) !== '200' || !data.main) {
      return {
        city: cityName,
        temperature: 0,
        feelsLike: 0,
        description: data.message || 'City not found',
        humidity: 0,
        windSpeed: 0,
        found: false,
      };
    }

    return {
      city: data.name || cityName,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather?.[0]?.description || '',
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
      found: true,
    };
  } catch (error) {
    console.error('[WeatherService] Weather fetch exception:', error);
    return {
      city: cityName,
      temperature: 0,
      feelsLike: 0,
      description: 'Request failed',
      humidity: 0,
      windSpeed: 0,
      found: false,
    };
  }
}
