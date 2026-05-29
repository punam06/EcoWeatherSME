/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI (ClimateShield) — EXPRESS BACKEND
 * File: src/app.ts
 *
 * Entry point for the standalone Node.js/Express TypeScript server.
 * Deployment target: Railway or Render
 * Port: 5001 (default, overridable via PORT env var)
 * ═══════════════════════════════════════════════════════════════
 */

import path from 'path';
import fetch from 'node-fetch';

// ── Load environment variables ───────────────────────────────────────────────
// Always try to load .env files — Render will use dashboard vars which override these.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
dotenv.config();                                              // backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') }); // root .env

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// ── Route Imports ─────────────────────────────────────────────────────────────
import trustScoreRouter from './api/routes/trustScore.route';
import climateDVSRouter from './api/routes/climateDVS.route';
import aiRecommendRouter from './api/routes/aiRecommend.route';
import agentRouter from './api/routes/agent.route';
import aiChatRouter from './api/routes/aiChat.route';
import esgRouter from './api/routes/esg.route';
import batchRouter from './api/routes/batch.route';
import { startSessionPruningInterval } from './lib/services/chatSession.service';

// ── Supabase Guard ────────────────────────────────────────────────────────────
import { isSupabaseConfigured } from './lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? '5001', 10);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// JSON body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow frontend origins
const FRONTEND_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://eco-sortha.vercel.app',
  'https://ecosortha.onrender.com',
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
  console.log(`📡 [Incoming Request] ${req.method} ${req.url} - Body:`, req.body);
  next();
});

// ═══════════════════════════════════════════════════════════════
// HEALTH & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      message: 'EcoSortha AI backend is running.',
      version: '2.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      supabaseConfigured: isSupabaseConfigured(),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      timestamp: new Date().toISOString(),
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

app.use('/api/batch/trust-score', trustScoreRouter);
app.use('/api/climate/dvs', climateDVSRouter);
app.use('/api/ai/recommend', aiRecommendRouter);
app.use('/api/agent', agentRouter);
app.use('/api/ai/chat', aiChatRouter);
app.use('/api/batches', batchRouter);
app.use('/api/esg', esgRouter);

// ── Geocoding Endpoint ──────────────────────────────────────────────────
app.get('/api/geocode', async (req: Request, res: Response) => {
  const query = req.query.q;
  if (!query) {
    res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    return;
  }
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Weather API key is not configured on backend' });
    return;
  }
  try {
    const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query as string)},BD&limit=1&appid=${apiKey}`;
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
      const cleanQuery = String(query).toLowerCase().trim();
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

// ── Weather Endpoint ─────────────────────────────────────────────────────
app.get('/api/weather', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    res.status(400).json({ success: false, error: 'lat and lon query parameters are required' });
    return;
  }
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Weather API key is not configured on backend' });
    return;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    const data: any = await response.json();
    if (data && data.main) {
      res.json({
        success: true,
        data: {
          temperature: data.main.temp,
          windspeed_kmh: (data.wind?.speed || 0) * 3.6, // m/s to km/h
          humidity: data.main.humidity,
          feelsLike: data.main.feels_like,
          description: data.weather?.[0]?.description || ''
        }
      });
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
    const { pH, EC, temp, ratio, days } = req.body;
    const parsedPH = parseFloat(pH ?? '4.0');
    const parsedEC = parseFloat(EC ?? '3.5');
    const parsedTemp = parseFloat(temp ?? '28');
    const parsedDays = parseInt(days ?? '9', 10);
    const parsedRatio = ratio ?? '1:1:20';

    let score = 100;
    const pHOpt = 4.0, ECOpt = 3.5, tempOpt = 28;
    score -= Math.abs(parsedPH - pHOpt) * 8;
    score -= Math.abs(parsedEC - ECOpt) * 6;
    score -= Math.abs(parsedTemp - tempOpt) * 1.2;
    const ratioMap: Record<string, number> = { "1:1:10": -5, "1:1:20": 0, "1:1:30": -3, "1:1:40": -8 };
    score += ratioMap[parsedRatio] ?? 0;
    if (parsedDays < 7) {
      score -= (7 - parsedDays) * 4;
    } else if (parsedDays > 14) {
      score -= (parsedDays - 14) * 2;
    }
    const trustScore = Math.max(0, Math.min(100, Math.round(score)));

    res.json({
      success: true,
      trustScore
    });
    return;
  }

  if (action === 'microclimate-metrics') {
    const { trustScore, zone, packaging, hour, baseTemp, windSpeed, routeDuration } = req.body;
    const parsedTS = parseFloat(trustScore ?? '80');
    const parsedBaseTemp = parseFloat(baseTemp ?? '31');
    const parsedHour = parseInt(hour ?? '12', 10);
    const parsedWindSpeed = parseFloat(windSpeed ?? '8');
    const parsedRouteDuration = parseFloat(routeDuration ?? '90');
    const selectedZone = zone ?? 'Mirpur';
    const selectedPkg = packaging ?? 'standard';

    const { getZoneProfile } = require('./lib/services/merm.service');
    const zoneProfile = getZoneProfile(selectedZone);
    
    const getSolarFactor = (h: number) => {
      if (h >= 11 && h < 15) return 1.0;
      if ((h >= 8 && h < 11) || (h >= 15 && h < 18)) return 0.6;
      return 0.2;
    };
    const solarFactor = getSolarFactor(parsedHour);
    const windCooling = parsedWindSpeed * 0.08;
    
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
    const offset = uhiOffsets[selectedZone] ?? zoneProfile.uhiOffset;
    const adjustedTemp = parsedBaseTemp + (offset * solarFactor) - windCooling;

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
    const dvsBase = Math.round(parsedTS * (1 - trf * 0.42));

    const pkgFactor = selectedPkg === "thermal" ? 4.0 : selectedPkg === "insulated" ? 2.0 : 1.0;
    const getSolarHourMultiplier = (h: number) => {
      if (h >= 11 && h < 15) return 1.5;
      if ((h >= 8 && h < 11) || (h >= 15 && h < 18)) return 1.0;
      return 0.4;
    };
    const solarMulti = getSolarHourMultiplier(parsedHour);
    
    const hazardMultiplierMap: Record<string, number> = {
      'CRITICAL': 1.8,
      'HIGH': 1.4,
      'MODERATE': 1.1
    };
    const hazardMultiplier = hazardMultiplierMap[zoneProfile.hazardClass] || 1.1;
    
    const baseSurvivals: Record<string, number> = {
      "Old Dhaka": 0.90, "Mirpur": 1.02, "Savar": 1.00, "Gulshan": 1.20
    };
    const baseSurvival = baseSurvivals[selectedZone] ?? (zoneProfile.hazardClass === 'CRITICAL' ? 0.9 : zoneProfile.hazardClass === 'HIGH' ? 1.0 : 1.2);

    const tempFactor = Math.max(0.3, (adjustedTemp - 18) / 10);
    const tstRaw = (parsedTS * pkgFactor * baseSurvival * 1.8) / (hazardMultiplier * solarMulti * tempFactor);
    const tst = Math.max(10, Math.round(tstRaw));

    // Deduct DVS penalty continuously based on route duration
    const penalty = Math.round((parsedRouteDuration / tst) * 12 + (parsedRouteDuration > tst ? (parsedRouteDuration - tst) * 0.4 : 0));
    const dvs = Math.max(0, Math.min(100, dvsBase - penalty));
    const deliveryTrustScore = Math.max(0, Math.min(100, Math.round(parsedTS * (1 - trf * 0.25) - (parsedRouteDuration > tst ? (parsedRouteDuration - tst) * 0.15 : 0))));

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

  res.status(400).json({ success: false, error: 'Unknown action' });
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

app.get('/api/batches', dbRequiredMiddleware);
app.post('/api/batches', dbRequiredMiddleware);
app.get('/api/batches/:id', dbRequiredMiddleware);
app.put('/api/batches/:id', dbRequiredMiddleware);
app.post('/api/batches/:id/readings', dbRequiredMiddleware);
app.get('/api/batches/:id/readings', dbRequiredMiddleware);
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

// 404 catch-all
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ═══════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════

// Start session pruning interval on boot
startSessionPruningInterval();

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       EcoSortha AI — ClimateShield Backend v2.0          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n✅  Server running on port ${PORT}`);
  console.log(`📡  API Base URL:          http://localhost:${PORT}/api`);
  console.log(`🏥  Health check:          http://localhost:${PORT}/api/health`);
  console.log(`🌡️   Trust Score:           POST /api/batch/trust-score`);
  console.log(`🚚  Delivery Viability:    POST /api/climate/dvs`);
  console.log(`🤖  AI Recommend (RAG):    POST /api/ai/recommend`);
  console.log(`\n🗄️   Supabase:             ${isSupabaseConfigured() ? '✅ Connected' : '⚠️  Not configured'}`);
  console.log(`🔑  Groq AI:               ${process.env.GROQ_API_KEY ? '✅ Key set' : '⚠️  GROQ_API_KEY missing'}`);
  console.log('\n');
});

export default app;
