/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI (ClimateShield) — EXPRESS BACKEND
 * File: src/app.ts
 *
 * Entry point for the standalone Node.js/Express TypeScript server.
 * Deployment target: Railway or Render
 * Port: 5001 (default, overridable via PORT env var)
 * ═══════════════════════════════════════════════════════════════
 */

import path from 'path';
import fetch from 'node-fetch';
import { z } from 'zod';

// ── Load environment variables ───────────────────────────────────────────────
// Always try to load .env files — Render will use dashboard vars which override these.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
dotenv.config();                                              // backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') }); // root .env

// Environment variable startup check
const checkEnvVars = () => {
  const required = ['GROQ_API_KEY', 'OPENWEATHER_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`❌ CRITICAL STARTUP ERROR: Missing required environment variables in production: ${missing.join(', ')}`);
      process.exit(1);
    } else {
      console.warn(`⚠️ WARNING: Missing environment variables for full functionality: ${missing.join(', ')}`);
    }
  }
};
checkEnvVars();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalRateLimiter } from './lib/middleware/rateLimiter';

// ── Route Imports ─────────────────────────────────────────────────────────────
import trustScoreRouter from './api/routes/trustScore.route';
import climateDVSRouter from './api/routes/climateDVS.route';
import aiRecommendRouter from './api/routes/aiRecommend.route';
import agentRouter from './api/routes/agent.route';
import aiChatRouter from './api/routes/aiChat.route';
import esgRouter from './api/routes/esg.route';
import esgReportRouter from './api/routes/esgReport.route';
import qaRouter from './api/routes/qa.route';
import verifyRouter from './api/routes/verify.route';
import batchRouter from './api/routes/batch.route';
import checkoutRouter from './api/routes/checkout.route';
import spotPricingRouter from './api/routes/spotPricing.route';
import orderRouter from './api/routes/order.route';
import languageRouter from './routes/language';
import biRouter from './api/routes/bi.route';
import weatherRouter from './api/routes/weather.route';
import { startSessionPruningInterval } from './lib/services/chatSession.service';
import { authenticateJWT, optionalJWT } from './middleware/authenticateJWT';

// ── New Feature Module Imports (Tasks 1-8) ────────────────────────────────────
import notificationsRouter from './api/routes/notifications.route';
import aiCostReportRouter from './api/routes/aiCostReport.route';
import routeOptimizeRouter from './api/routes/routeOptimize.route';
import { aiCostShield } from './middleware/aiCostShield';
import { strictAiRateLimiter } from './lib/middleware/rateLimiter';

// ── Supabase Guard ────────────────────────────────────────────────────────────
import { isSupabaseConfigured } from './lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? '5001', 10);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Apply helmet security headers
app.use(helmet());

// Apply global rate limiting
app.use(globalRateLimiter);

// JSON body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow frontend origins
const FRONTEND_ORIGINS = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  'https://eco-sortha.vercel.app',
  'https://climalogix.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5001',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, Railway health check)
      if (!origin) return callback(null, true);
      if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
      // Allow ALL *.onrender.com subdomains
      if (origin.endsWith('.onrender.com')) return callback(null, true);
      // Allow localhost on any port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
      // Allow in development
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use((req, res, next) => {
  // Wrap req.body logging to prevent printout of sensitive fields if they ever occur
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📡 [Incoming Request] ${req.method} ${req.url} - Body:`, req.body);
  }
  next();
});

// Zod query schemas for input validation
const GeocodeQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

const WeatherQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const CleverResponderTrustScoreSchema = z.object({
  action: z.literal('trust-score'),
  pH: z.coerce.number().min(0).max(14).default(4.0),
  EC: z.coerce.number().min(0).max(20).default(3.5),
  temp: z.coerce.number().min(-50).max(100).default(28),
  ratio: z.string().min(1).max(50).default('1:1:20'),
  days: z.coerce.number().int().min(0).max(365).default(9),
}).strict();

const CleverResponderMicroclimateSchema = z.object({
  action: z.literal('microclimate-metrics'),
  trustScore: z.coerce.number().min(0).max(100).default(80),
  zone: z.string().min(1).max(100).default('Mirpur'),
  packaging: z.string().min(1).max(100).default('standard'),
  hour: z.coerce.number().int().min(0).max(23).default(12),
  baseTemp: z.coerce.number().min(-10).max(60).default(31),
  windSpeed: z.coerce.number().min(0).max(200).default(8),
  routeDuration: z.coerce.number().min(0).max(10080).default(90),
}).strict();

// ═══════════════════════════════════════════════════════════════
// HEALTH & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      message: 'ClimaLogix AI backend is running.',
      version: '2.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      supabaseConfigured: isSupabaseConfigured(),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      weatherConfigured: Boolean(process.env.OPENWEATHER_API_KEY),
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/api/config', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  });
});

app.get('/api/test-db', async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
    });
    return;
  }

  try {
    const { getSupabaseClient } = await import('./lib/supabase');
    const supabase = getSupabaseClient();
    // Lightweight query to test connectivity
    const { error } = await supabase.from('trust_score_logs').select('id').limit(1);

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: error.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        status: 'connected',
        message: 'Supabase database connection successful.',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// NEW TYPED API ROUTES (TypeScript, Zod-validated)
// ═══════════════════════════════════════════════════════════════

// Removed custom authRouter, using Supabase Auth
// app.use('/api/auth', authRouter);
app.use('/api/batch/trust-score', trustScoreRouter);
app.use('/api/climate/dvs', climateDVSRouter);

// AI routes — wrapped with cost shield + strict per-minute rate limit (Task 2)
app.use('/api/ai/recommend', strictAiRateLimiter, aiCostShield(50), aiRecommendRouter);
app.post('/api/orders/voice', authenticateJWT, (req, res, next) => {
  req.url = '/orders/voice';
  agentRouter(req, res, next);
});
app.use('/api/orders', orderRouter);

app.use('/api/agent', strictAiRateLimiter, aiCostShield(50), agentRouter);
app.use('/api/ai/chat', strictAiRateLimiter, aiCostShield(50), aiChatRouter);
app.use('/api/batches', batchRouter);
app.use('/api/esg', esgRouter);
app.use('/api/esg/report', esgReportRouter);
app.use('/api/qa', qaRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/language', languageRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/spot-pricing', spotPricingRouter);
app.use('/api/bi', biRouter);
app.use('/api/weather', weatherRouter);

// ── New Feature Module Routes ────────────────────────────────────────────────
// Task 1: Real-Time Notifications
app.use('/api/notifications', notificationsRouter);

// Task 2: AI Cost Report
app.use('/api/ai/cost-report', aiCostReportRouter);

// Task 3: Route Optimizer
app.use('/api/route', routeOptimizeRouter);

// ── In-memory weather cache (5 min TTL) ─────────────────────────────────
const weatherCache = new Map<string, { data: { temp: number; rh: number; description: string; city: string }; ts: number }>();
const WEATHER_TTL_MS = 5 * 60 * 1000;

async function fetchWeatherWithCache(city: string, apiKey: string | undefined) {
  const cached = weatherCache.get(city);
  if (cached && Date.now() - cached.ts < WEATHER_TTL_MS) return cached.data;
  if (!apiKey) {
    console.warn(`[WeatherCache] Cannot fetch weather for ${city}: OPENWEATHER_API_KEY is not configured.`);
    return null;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},BD&appid=${apiKey}&units=metric`;
    const wRes = await fetch(url);
    if (wRes.ok) {
      const wd: any = await wRes.json();
      if (wd?.main) {
        const data = {
          temp: Number(wd.main.temp) || 0,
          rh: Number(wd.main.humidity) || 0,
          description: wd.weather?.[0]?.description || '',
          city: wd.name || city,
        };
        weatherCache.set(city, { data, ts: Date.now() });
        return data;
      }
    } else {
      const errBody = await wRes.text().catch(() => '');
      console.error(`[WeatherCache] OpenWeather API returned error status ${wRes.status} for ${city}. Body: ${errBody}`);
    }
  } catch (e) {
    console.error(`[WeatherCache] Network error fetching weather for ${city}:`, e);
  }
  return null;
}

// ── Dashboard Summary Endpoint ────────────────────────────────────────────
app.get('/api/dashboard', async (req: Request, res: Response) => {
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;

  // Heatmap zones with UHI offsets (aligned to fetch base weather from major cities to avoid 404/401 rate limits)
  const zones = [
    { zone: 'Old Dhaka',  city: 'Dhaka',        uhiOffset: 3.8, desc: 'Class A thermal accumulation zone. Narrow concrete corridors trap heat.' },
    { zone: 'Mirpur',     city: 'Dhaka',        uhiOffset: 2.9, desc: 'Dense residential concrete with limited canopy cover.' },
    { zone: 'Savar',      city: 'Savar',        uhiOffset: 2.1, desc: 'Mixed urban with partial green canopy. Moderate risk window.' },
    { zone: 'Gulshan',    city: 'Dhaka',        uhiOffset: 1.2, desc: 'High green canopy coverage and lake proximity reduce thermal load.' },
  ];

  const heatmap = await Promise.all(zones.map(async (z) => {
    const live = await fetchWeatherWithCache(z.city, weatherApiKey);
    const baseTemp = live ? live.temp : 32 + Math.random() * 4;
    const rh = live ? live.rh : 60 + Math.floor(Math.random() * 20);
    const adjustedTemp = baseTemp + z.uhiOffset;
    const hazard = adjustedTemp > 40 ? 'Extreme' : adjustedTemp > 37 ? 'High' : adjustedTemp > 34 ? 'Moderate' : 'Safe';
    return {
      zone: z.zone,
      hazard,
      temp: `${adjustedTemp.toFixed(1)}°C`,
      rh: `${rh}%`,
      desc: z.desc,
      time: adjustedTemp > 34 ? '11:00 AM – 4:00 PM' : 'N/A',
      live: live !== null,
      liveTempC: live ? Number(baseTemp.toFixed(1)) : null,
      city: z.city,
    };
  }));

  // Stats — try Supabase first, fall back to daily-seeded data
  let stats: any = null;
  let recentActivity: any[] = [];
  let liveData = false;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseClient } = await import('./lib/supabase');
      const supabase = getSupabaseClient();
      const { data: batches, error } = await supabase
        .from('batches')
        .select('id, batch_number, product_name, status, trust_score, destination_zone, weight_kg, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && batches) {
        liveData = true;
        const total = batches.length;
        const certified = batches.filter((b: any) => b.status === 'certified').length;
        const active = batches.filter((b: any) => ['active','pending'].includes(b.status)).length;
        const avgTrust = total > 0 ? Math.round(batches.reduce((a: number, b: any) => a + (b.trust_score || 0), 0) / total * 10) / 10 : 0;
        const totalWeightKg = batches.reduce((a: number, b: any) => a + (b.weight_kg || 0), 0);
        const weightLabel = totalWeightKg >= 1000 ? `${(totalWeightKg / 1000).toFixed(1)} t` : `${totalWeightKg} kg`;
        stats = {
          totalBatches: total, certifiedBatches: certified, activeBatches: active,
          certRate: total > 0 ? `${Math.round((certified / total) * 100)}%` : '0%',
          avgTrustScore: avgTrust, totalWeight: weightLabel,
          plasticSaved: total * 240, co2Sequestered: Math.round(totalWeightKg * 0.25),
        };
        recentActivity = batches.slice(0, 5).map((r: any) => {
          const elapsed = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
          const timeAgo = elapsed < 60 ? `${elapsed} min ago` : elapsed < 1440 ? `${Math.round(elapsed / 60)} hr ago` : `${Math.round(elapsed / 1440)} day ago`;
          const isCert = r.status === 'certified';
          const isDispatched = ['dispatched', 'delivered'].includes(r.status);
          return {
            icon: isCert ? '🛡️' : isDispatched ? '🚚' : '📦',
            colorType: isCert ? 'green' : isDispatched ? 'green' : 'blue',
            text: isCert ? `Batch ${r.batch_number} certified — Trust Score ${r.trust_score}` : isDispatched ? `Batch ${r.batch_number} dispatched to ${r.destination_zone || 'destination'}` : `New ${r.product_name || 'batch'} ${r.batch_number} created (${r.weight_kg || 0} kg)`,
            time: timeAgo,
          };
        });
      }
    } catch (_e) { /* fall through */ }
  }

  if (!stats) {
    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth() * 10 + now.getDate();
    const t = (seed % 40) + 100;
    const c = Math.round(t * 0.83);
    stats = {
      totalBatches: t, certifiedBatches: c, activeBatches: Math.round(t * 0.06),
      certRate: `${Math.round((c / t) * 100)}%`, avgTrustScore: 79 + (seed % 7),
      totalWeight: `${(t * 0.061).toFixed(1)} t`, plasticSaved: t * 240,
      co2Sequestered: Math.round(t * 61 * 0.25),
    };
    recentActivity = [
      { icon: '🛡️', colorType: 'green', text: `Batch BCH-${t} certified — Trust Score ${82 + (seed % 12)}`, time: '3 min ago' },
      { icon: '📈', colorType: 'amber', text: `DVS simulation for Old Dhaka route — Score ${60 + (seed % 18)} (Caution)`, time: '21 min ago' },
      { icon: '🚚', colorType: 'green', text: `Batch BCH-${t - 2} dispatched to Mirpur`, time: '1 hr ago' },
      { icon: '⚠️', colorType: 'red',   text: 'High thermal hazard in Old Dhaka — delay dispatches until 5 PM', time: '2 hr ago' },
      { icon: '📦', colorType: 'blue',  text: `New biochar batch BCH-${t - 1} created (${180 + (seed % 40)} kg)`, time: '3 hr ago' },
    ];
  }

  res.json({ success: true, data: { stats, recentActivity, heatmap, liveData, weatherUpdatedAt: new Date().toISOString() } });
});

// ── Geocoding Endpoint ──────────────────────────────────────────────────
app.get('/api/geocode', async (req: Request, res: Response) => {
  const parsed = GeocodeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
    return;
  }
  const { q: query } = parsed.data;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Weather API key is not configured on backend' });
    return;
  }
  try {
    const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)},BD&limit=1&appid=${apiKey}`;
    const response = await fetch(url);
    const data: any = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      res.json({
        success: true,
        data: {
          lat: data[0].lat,
          lon: data[0].lon,
          name: data[0].name
        }
      });
    } else {
      // Fallback for Dhaka zones if not found by API
      const fallbackZones: Record<string, {lat: number, lon: number}> = {
        'mirpur': { lat: 23.8041, lon: 90.3625 },
        'gulshan': { lat: 23.7925, lon: 90.4078 },
        'dhanmondi': { lat: 23.7461, lon: 90.3742 },
        'banani': { lat: 23.7940, lon: 90.4043 },
        'uttara': { lat: 23.8759, lon: 90.3795 },
        'motijheel': { lat: 23.7330, lon: 90.4172 },
        'tejgaon': { lat: 23.7612, lon: 90.3994 },
        'old dhaka': { lat: 23.7083, lon: 90.4075 }
      };
      const cleanQuery = query.toLowerCase().trim();
      const fallback = fallbackZones[cleanQuery] || { lat: 23.8103, lon: 90.4125 };
      res.json({
        success: true,
        data: fallback
      });
    }
  } catch (err) {
    console.error('Geocoding error:', err);
    res.status(500).json({ success: false, error: 'Failed to geocode location' });
  }
});

// ── Weather Endpoint (60s in-memory cache) ──────────────────────────────
const weatherByCoordsCache = new Map<string, { data: any; ts: number }>();
const WEATHER_COORDS_TTL_MS = 60 * 1000;

app.get('/api/weather', async (req: Request, res: Response) => {
  const parsed = WeatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
    return;
  }
  const { lat, lon } = parsed.data;
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = weatherByCoordsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WEATHER_COORDS_TTL_MS) {
    res.json({ success: true, data: cached.data, cached: true });
    return;
  }
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // No key configured — return a deterministic time-of-day estimate so the
    // UI never freezes on stale data.
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const peak = 13;
    const low = 5;
    const closer = Math.min(Math.abs(h - peak), Math.abs(h - low));
    const temp = 26 + (8.5 * (1 - Math.cos((closer / 8) * Math.PI)) / 2);
    const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
    const data = {
      temperature: Math.round(temp * 10) / 10,
      windspeed_kmh: wind,
      humidity: 65,
      feelsLike: Math.round((temp + 1.5) * 10) / 10,
      description: 'estimated (no API key configured)',
    };
    res.json({ success: true, data, estimated: true });
    return;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    const data: any = await response.json();
    if (data && data.main && data.main.temp !== undefined) {
      const payload = {
        temperature: data.main.temp,
        windspeed_kmh: (data.wind?.speed || 0) * 3.6, // m/s to km/h
        humidity: data.main.humidity,
        feelsLike: data.main.feels_like,
        description: data.weather?.[0]?.description || '',
      };
      weatherByCoordsCache.set(cacheKey, { data: payload, ts: Date.now() });
      res.json({ success: true, data: payload, cached: false });
    } else if (data && data.cod === 401) {
      // Invalid/expired key — return time-of-day estimate, don't 404
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      const peak = 13;
      const low = 5;
      const closer = Math.min(Math.abs(h - peak), Math.abs(h - low));
      const temp = 26 + (8.5 * (1 - Math.cos((closer / 8) * Math.PI)) / 2);
      const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
      const payload = {
        temperature: Math.round(temp * 10) / 10,
        windspeed_kmh: wind,
        humidity: 65,
        feelsLike: Math.round((temp + 1.5) * 10) / 10,
        description: 'estimated (API key unauthorized)',
      };
      res.json({ success: true, data: payload, estimated: true });
    } else {
      res.status(404).json({ success: false, error: 'Weather data not found for coordinates' });
    }
  } catch (err) {
    console.error('Weather fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch weather data' });
  }
});

// ── Clever Responder Endpoint ────────────────────────────────────────────
app.post('/api/clever-responder', async (req: Request, res: Response) => {
  const { action } = req.body;

  if (action === 'trust-score') {
    const parsed = CleverResponderTrustScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const { pH, EC, temp, ratio, days } = parsed.data;

    let score = 100;
    const pHOpt = 4.0, ECOpt = 3.5, tempOpt = 28;
    score -= Math.abs(pH - pHOpt) * 8;
    score -= Math.abs(EC - ECOpt) * 6;
    score -= Math.abs(temp - tempOpt) * 1.2;
    const ratioMap: Record<string, number> = { "1:1:10": -5, "1:1:20": 0, "1:1:30": -3, "1:1:40": -8 };
    score += ratioMap[ratio] ?? 0;
    if (days < 7) {
      score -= (7 - days) * 4;
    } else if (days > 14) {
      score -= (days - 14) * 2;
    }
    const trustScore = Math.max(0, Math.min(100, Math.round(score)));

    res.json({
      success: true,
      trustScore
    });
    return;
  }

  if (action === 'microclimate-metrics') {
    const parsed = CleverResponderMicroclimateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const { trustScore, zone, packaging, hour, baseTemp, windSpeed, routeDuration } = parsed.data;

    const { getZoneProfile } = require('./lib/services/merm.service');
    const zoneProfile = getZoneProfile(zone);
    
    const getSolarFactor = (h: number) => {
      if (h >= 11 && h < 15) return 1.0;
      if ((h >= 8 && h < 11) || (h >= 15 && h < 18)) return 0.6;
      return 0.2;
    };
    const solarFactor = getSolarFactor(hour);
    const windCooling = windSpeed * 0.08;
    
    const uhiOffsets: Record<string, number> = {
      "Old Dhaka": 3.4,
      "Motijheel": 3.1,
      "Tejgaon": 3.2,
      "Hazaribagh": 3.5,
      "Kamrangirchar": 3.3,
      "Chowkbazar": 3.4,
      "Lalbagh": 3.2,
      "Jatrabari": 3.3,
      "Sutrapur": 3.1,
      "Bangshal": 3.3,
      "Kotwali": 3.4,
      "Mirpur": 2.1,
      "Mohammadpur": 2.3,
      "Badda": 2.5,
      "Rampura": 2.6,
      "Malibagh": 2.8,
      "Khilgaon": 2.7,
      "Moghbazar": 2.9,
      "Azimpur": 2.4,
      "Shantinagar": 2.8,
      "Kakrail": 2.7,
      "Paltan": 3.0,
      "Mugda": 2.6,
      "Sabujbagh": 2.5,
      "Demra": 2.4,
      "Kadamtali": 2.6,
      "Shyampur": 2.7,
      "Gendaria": 2.8,
      "Mohakhali": 2.8,
      "Pallabi": 2.0,
      "Rupnagar": 2.1,
      "Shah Ali": 2.2,
      "Darus Salam": 2.3,
      "Adabor": 2.2,
      "Kalabagan": 2.5,
      "New Market": 2.9,
      "Shahbagh": 2.6,
      "Ramna": 2.5,
      "Shahjahanpur": 2.7,
      "Bhatara": 2.4,
      "Bhashantek": 2.2,
      "Kafrul": 2.3,
      "Sher-e-Bangla": 2.0,
      "Dhanmondi": 2.2,
      "Gulshan": 1.3,
      "Banani": 1.5,
      "Baridhara": 1.2,
      "Niketan": 1.6,
      "Uttara": 1.8,
      "Bashundhara RA": 1.4,
      "Purbachal": 0.8,
      "Cantonment": 1.0,
      "Turag": 1.5,
      "Khilkhet": 1.7,
      "Bimanbandar": 1.6,
      "Uttar Khan": 1.4,
      "Dakshinkhan": 1.5,
      "Savar": 2.8,
      "Gazipur": 2.4
    };
    const offset = uhiOffsets[zone] ?? zoneProfile.uhiOffset;
    const adjustedTemp = baseTemp + (offset * solarFactor) - windCooling;

    let thermalRiskValue = 0.1;
    let thermalRiskLabel = 'Low';
    let thermalRiskColor = '#10B981';
    if (adjustedTemp > 35) {
      thermalRiskValue = 1.0;
      thermalRiskLabel = 'Critical';
      thermalRiskColor = '#EF4444';
    } else if (adjustedTemp > 32) {
      thermalRiskValue = 0.5;
      thermalRiskLabel = 'Moderate';
      thermalRiskColor = '#F59E0B';
    }

    const trf = Math.max(0.05, Math.min(1.0, (adjustedTemp - 22) / 18));
    const dvsBase = Math.round(trustScore * (1 - trf * 0.42));

    const pkgFactor = packaging === "thermal" ? 4.0 : packaging === "insulated" ? 2.0 : 1.0;
    const getSolarHourMultiplier = (h: number) => {
      if (h >= 11 && h < 15) return 1.5;
      if ((h >= 8 && h < 11) || (h >= 15 && h < 18)) return 1.0;
      return 0.4;
    };
    const solarMulti = getSolarHourMultiplier(hour);
    
    const hazardMultiplierMap: Record<string, number> = {
      'CRITICAL': 1.8,
      'HIGH': 1.4,
      'MODERATE': 1.1
    };
    const hazardMultiplier = hazardMultiplierMap[zoneProfile.hazardClass] || 1.1;
    
    const baseSurvivals: Record<string, number> = {
      "Old Dhaka": 0.90, "Mirpur": 1.02, "Savar": 1.00, "Gulshan": 1.20
    };
    const baseSurvival = baseSurvivals[zone] ?? (zoneProfile.hazardClass === 'CRITICAL' ? 0.9 : zoneProfile.hazardClass === 'HIGH' ? 1.0 : 1.2);

    const tempFactor = Math.max(0.3, (adjustedTemp - 18) / 10);
    const tstRaw = (trustScore * pkgFactor * baseSurvival * 1.8) / (hazardMultiplier * solarMulti * tempFactor);
    const tst = Math.max(10, Math.round(tstRaw));

    // Deduct DVS penalty continuously based on route duration
    const penalty = Math.round((routeDuration / tst) * 12 + (routeDuration > tst ? (routeDuration - tst) * 0.4 : 0));
    const dvs = Math.max(0, Math.min(100, dvsBase - penalty));
    const deliveryTrustScore = Math.max(0, Math.min(100, Math.round(trustScore * (1 - trf * 0.25) - (routeDuration > tst ? (routeDuration - tst) * 0.15 : 0))));

    res.json({
      success: true,
      dvs,
      tst,
      adjustedTemp,
      trustScore: deliveryTrustScore,
      thermalRisk: {
        value: thermalRiskValue,
        label: thermalRiskLabel,
        color: thermalRiskColor
      }
    });
    return;
  }

  res.status(400).json({ success: false, error: 'Unknown action or invalid body parameters' });
});

// ═══════════════════════════════════════════════════════════════
// LEGACY ROUTES (keep compatibility with existing frontend JS client)
// ═══════════════════════════════════════════════════════════════

/**
 * Legacy: GET /api/zones — returns static zone data (no DB needed)
 */
app.get('/api/zones', (_req: Request, res: Response) => {
  const { DHAKA_ZONES } = require('./lib/services/merm.service');
  const zones = Object.entries(DHAKA_ZONES).map(([name, profile]) => ({
    zone: name,
    ...(profile as object),
  }));
  res.json({ success: true, data: zones, count: zones.length });
});

/**
 * Legacy: GET /api/zones/:zone — returns a single zone
 */
app.get('/api/zones/:zone', (req: Request, res: Response) => {
  const { DHAKA_ZONES } = require('./lib/services/merm.service');
  const zoneName = req.params.zone;
  const profile = DHAKA_ZONES[zoneName];
  if (!profile) {
    res.status(404).json({ success: false, error: `Zone '${zoneName}' not found` });
    return;
  }
  res.json({ success: true, data: { zone: zoneName, ...profile } });
});

/**
 * Legacy: GET /api/demand-forecast — returns mock 30-day demand forecast
 */
app.get('/api/demand-forecast', (req: Request, res: Response) => {
  try {
    // Resolve from project root: ../../public/demand-forecast-mock.json
    const forecastPath = path.resolve(__dirname, '..', '..', '..', 'public', 'demand-forecast-mock.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const forecast = require(forecastPath);
    res.json({ success: true, data: forecast });
  } catch {
    res.status(500).json({ success: false, error: 'Could not load forecast data' });
  }
});

/**
 * Legacy: POST /api/calculate-trust-score — forwards to the new trust score engine
 * Keeps backward compat with the old frontend API client shape.
 */
app.post('/api/calculate-trust-score', (req: Request, res: Response) => {
  const { pH, EC, temperature, ratio, days } = req.body as {
    pH?: number;
    EC?: number;
    temperature?: number;
    ratio?: string;
    days?: number;
  };

  if (pH === undefined || EC === undefined || temperature === undefined) {
    res.status(400).json({ success: false, error: 'Missing required parameters: pH, EC, temperature' });
    return;
  }

  // Apply legacy formula (frontend JS compatible)
  let score = 100;
  const pHOpt = 4.0, ECOpt = 3.5, tempOpt = 28;
  score -= Math.abs(pH - pHOpt) * 8;
  score -= Math.abs(EC - ECOpt) * 6;
  score -= Math.abs(temperature - tempOpt) * 1.2;
  const ratioMap: Record<string, number> = { '1:1:10': -5, '1:1:20': 0, '1:1:30': -3, '1:1:40': -8 };
  score += ratioMap[ratio ?? '1:1:20'] ?? 0;
  const d = days ?? 9;
  if (d < 7) score -= (7 - d) * 4;
  else if (d > 14) score -= (d - 14) * 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  res.json({
    success: true,
    data: { trust_score: score, parameters: { pH, EC, temperature, ratio, days } },
  });
});

/**
 * Legacy stubs for batches, users, IoT readings (require Supabase)
 * These return a helpful message when DB is not configured.
 */
const dbRequiredMiddleware = (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: 'Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      hint: 'These endpoints require Supabase. Use /api/batch/trust-score, /api/climate/dvs, /api/ai/recommend without a database.',
    });
    return;
  }
  res.status(501).json({
    success: false,
    error: 'This legacy endpoint requires full Supabase setup.',
  });
};

app.get('/api/users', dbRequiredMiddleware);
app.post('/api/users', dbRequiredMiddleware);
app.post('/api/zones', dbRequiredMiddleware);

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[GlobalError]', err.stack ?? err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// GET /docs redirect to frontend docs tab
app.get('/docs', (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://ecoweathersme.onrender.com';
  res.redirect(`${frontendUrl}/?tab=docs`);
});

// 404 catch-all
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});


// ═══════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════

startSessionPruningInterval();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║       ClimaLogix AI — ClimateShield Backend v2.0          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n✅  Server running on port ${PORT}`);
    console.log(`📡  API Base URL:          http://localhost:${PORT}/api`);
    console.log(`🏥  Health check:          http://localhost:${PORT}/api/health`);
    console.log(`🌡️   Trust Score:           POST /api/batch/trust-score`);
    console.log(`🚚  Delivery Viability:    POST /api/climate/dvs`);
    console.log(`🤖  AI Recommend (RAG):    POST /api/ai/recommend`);
    console.log(`📦  Order dispatch:        POST /api/orders/:id/dispatch`);
    console.log(`📦  Order receipt:         POST /api/orders/:id/receipt`);
    console.log(`🔔  Notifications:         GET  /api/notifications`);
    console.log(`💰  AI Cost Report:        GET  /api/ai/cost-report`);
    console.log(`🗺️   Route Optimizer:       POST /api/route/optimize`);
    console.log(`🚛  Order Tracking:        GET  /api/orders/:id/tracking`);
    console.log(`\n🗄️   Supabase:             ${isSupabaseConfigured() ? '✅ Connected' : '⚠️  Not configured'}`);
    console.log(`🔑  Groq AI:               ${process.env.GROQ_API_KEY ? '✅ Key set' : '⚠️  GROQ_API_KEY missing'}`);
    console.log('\n');
  });
}

export default app;
