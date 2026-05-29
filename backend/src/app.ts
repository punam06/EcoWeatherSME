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

// ── Load environment variables ───────────────────────────────────────────────
// In non-production, load .env from: backend/.env → root ../.env
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// ── Route Imports ─────────────────────────────────────────────────────────────
import trustScoreRouter from './api/routes/trustScore.route';
import climateDVSRouter from './api/routes/climateDVS.route';
import aiRecommendRouter from './api/routes/aiRecommend.route';

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
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, Railway health check)
      if (!origin) return callback(null, true);
      if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
      // Allow in development
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);

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
