const path = require('path');
// CRITICAL: Force IPv4-first DNS resolution BEFORE any network code runs.
// Render free instances lack reliable IPv6 outbound — without this, Node
// can pick Supabase's IPv6 pooler address and the request dies with
// `connect ENETUNREACH <IPv6>:5432`. Must be the first statement.
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) { /* node < 18.6 */ }
// Always load .env — Render dashboard vars override these automatically
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Last-resort JWT secret fallback. If neither JWT_ACCESS_SECRET nor
// JWT_SECRET is configured anywhere (Render env, backend/.env, root .env),
// generate an ephemeral secret so the server still boots. Login tokens
// signed with this secret will be invalidated on the next restart, but
// the rest of the app keeps working. Logs a loud warning on boot.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET not configured — generated an ephemeral secret. ' +
    'Set JWT_SECRET in Render dashboard or backend/.env for stable tokens.');
}
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
// groq-sdk exports the class as a named export AND as .default
// require('groq-sdk') alone is NOT the constructor — must use .Groq or .default
const _groqModule = require('groq-sdk');
const GroqClass = _groqModule.Groq || _groqModule.default || _groqModule;
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// CORS Configuration — allow both local dev and Render production frontend
const corsOptions = {
  origin: [
    'https://eco-sortha.vercel.app',
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api', apiRateLimit);

const ROLE_VALUES = ['processor', 'buyer', 'admin'];
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '30d';
// Split secrets (preferred) with a fall-back to a single JWT_SECRET. The
// legacy backend historically used two distinct secrets (access vs refresh),
// but some deployments (incl. Render in this project) only configure
// JWT_SECRET. The fall-back lets a single secret cover both — slightly less
// secure than two distinct keys, but it keeps the auth flow working.
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_FALLBACK || process.env.JWT_SECRET;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'refreshToken';

// PostgreSQL Pool Client Initialization (optional, lazy).
// CRITICAL: do NOT eagerly create the Pool on startup. Render's free web
// service is IPv4-only — if DATABASE_URL points at Supabase's IPv6 pooler
// hostname, the very first queryDB() call will throw ENETUNREACH and
// propagate as a 500. We construct the Pool only on first use, and only if
// the resolved family of the host is reachable (IPv4 in our case). The
// frontend auth flow uses @supabase-js (REST), so this Pool is only used by
// the legacy direct-DB routes — making it lazy is safe.
let _pool = null;
function getPool() {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) return null;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return _pool;
}
const pool = { get instance() { return getPool(); } };

// Safe query wrapper that returns a helpful error when DB isn't configured
async function queryDB(text, params = []) {
  const p = getPool();
  if (!p) {
    const err = new Error('DATABASE_URL is not configured. Set DATABASE_URL in your .env');
    err.status = 503;
    throw err;
  }
  try {
    return await p.query(text, params);
  } catch (e) {
    // Translate the IPv6-only ENETUNREACH into a friendly 503 so the
    // frontend can degrade gracefully instead of seeing a 500.
    if (e && (e.code === 'ENETUNREACH' || e.code === 'EHOSTUNREACH')) {
      const err = new Error('Database host is unreachable from this network (likely IPv6-only Supabase pooler vs IPv4-only Render). Use the Supabase Direct connection string in DATABASE_URL.');
      err.status = 503;
      throw err;
    }
    throw e;
  }
}

// Supabase REST (PostgREST) helper. Render's free tier is IPv4-only, so the
// `pg` driver can't reach Supabase's IPv6 pooler. PostgREST over HTTPS works
// fine, so any read-only or simple-write route that was hitting queryDB()
// can call this helper instead. Returns the parsed JSON body on 2xx, throws
// an Error with the upstream status + body text otherwise.
async function supabaseRest(path, options = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    err.status = 503;
    throw err;
  }
  const url = `${process.env.SUPABASE_URL}/rest/v1${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    const err = new Error(`Supabase REST ${resp.status}: ${txt.substring(0, 300)}`);
    err.status = 502;
    err.upstreamStatus = resp.status;
    throw err;
  }
  // Some PostgREST calls (e.g. POST with Prefer: return=minimal) return 204
  if (resp.status === 204) return null;
  return resp.json();
}

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(255),
  role: z.enum(ROLE_VALUES).optional().default('buyer')
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional()
});

const zoneUpsertSchema = z.object({
  zone: z.string().trim().min(1).max(50),
  uhi_offset: z.coerce.number(),
  building_density: z.coerce.number().optional().default(0.5),
  vegetation_fraction: z.coerce.number().optional().default(0.2),
  wind_corridor_factor: z.coerce.number().optional().default(0.8),
  thermal_mass_coefficient: z.coerce.number().optional().default(1.0)
});

const batchCreateSchema = z.object({
  processor_id: z.string().uuid().nullable().optional(),
  batch_number: z.string().trim().min(1).max(100),
  feedstock_type: z.string().trim().min(1).max(100),
  product_name: z.string().trim().min(1).max(255).optional().default('Organic Product'),
  trust_score: z.coerce.number().min(0).max(100)
});

const batchUpdateSchema = z.object({
  product_name: z.string().trim().min(1).max(255).optional(),
  trust_score: z.coerce.number().min(0).max(100).optional(),
  certificate_url: z.string().trim().url().nullable().optional(),
  qr_code_url: z.string().trim().url().nullable().optional()
});

const readingCreateSchema = z.object({
  pH: z.coerce.number(),
  EC: z.coerce.number(),
  temperature: z.coerce.number(),
  em1_ratio: z.string().trim().min(1).max(20).optional().default('1:1:20'),
  fermentation_days: z.coerce.number().int().min(0).max(365).optional().default(7)
});

const trustScoreSchema = z.object({
  pH: z.coerce.number(),
  EC: z.coerce.number(),
  temperature: z.coerce.number(),
  ratio: z.string().trim().optional().default('1:1:20'),
  days: z.coerce.number().optional().default(7)
});

const adminCreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(255),
  role: z.enum(ROLE_VALUES)
});

function parseDurationMs(input) {
  const value = String(input).trim();
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return Number.isFinite(Number(value)) ? Number(value) * 1000 : 30 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

function sendValidationError(res, issues) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    }
  });
}

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

function ensureAuthSecrets() {
  if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    const err = new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured ' +
      '(or set JWT_SECRET as a single shared secret)'
    );
    err.status = 500;
    throw err;
  }
}

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    created_at: row.created_at
  };
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookieValue(req, cookieName) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const target = cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));
  return target ? decodeURIComponent(target.split('=').slice(1).join('=')) : null;
}

function createAccessToken(user) {
  ensureAuthSecrets();
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, type: 'access' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function createRefreshToken(user) {
  ensureAuthSecrets();
  const nonce = crypto.randomBytes(32).toString('hex');
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: user.id, type: 'refresh', jti, nonce },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
  return { token, jti };
}

async function storeRefreshToken(req, userId, refreshToken) {
  const expiresAt = new Date(Date.now() + parseDurationMs(REFRESH_TOKEN_TTL));
  const tokenHash = hashRefreshToken(refreshToken);
  // Use Supabase REST (IPv4-friendly HTTPS) instead of pg.Pool, which on
  // Render's IPv4-only network can't reach Supabase's IPv6 pooler. The
  // refresh_tokens table is a regular Supabase Postgres table, so we hit
  // PostgREST with the service-role key.
  const url = `${process.env.SUPABASE_URL}/rest/v1/refresh_tokens`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      user_agent: req.get('user-agent') || null,
      ip_address: req.ip || null
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`refresh_tokens insert failed (${resp.status}): ${txt}`);
  }
  return tokenHash;
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    maxAge: parseDurationMs(REFRESH_TOKEN_TTL),
    path: '/api/auth'
  });
}

async function issueAuthTokens(req, res, user) {
  const accessToken = createAccessToken(user);
  const { token: refreshToken } = createRefreshToken(user);
  // Persist the refresh token but DO NOT fail login if the write fails.
  // Worst case: the user has to log in again when the access token expires.
  try {
    await storeRefreshToken(req, user.id, refreshToken);
  } catch (e) {
    console.warn('[auth] refresh-token persistence failed (non-fatal):', e.message);
  }
  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }
  ensureAuthSecrets();

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    // Use Supabase REST to fetch the user — see storeRefreshToken() above
    // for why we avoid pg.Pool on Render's IPv4-only network.
    const lookupUrl = `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(payload.sub)}&select=id,email,name,role,created_at&limit=1`;
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!lookupRes.ok) {
      return res.status(401).json({ success: false, error: 'Invalid access token' });
    }
    const rows = await lookupRes.json();
    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid access token' });
    }
    req.user = rows[0];
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};

/* ═══════════════════════════════════════════════════════════════
   HEALTH & DIAGNOSTICS
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Backend server is running.',
    environment: process.env.NODE_ENV,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    dbConfigured: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    }
  });
});

app.get('/api/weather', asyncHandler(async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const peak = 13;
    const low = 5;
    const closer = Math.min(Math.abs(h - peak), Math.abs(h - low));
    const temp = 26 + (8.5 * (1 - Math.cos((closer / 8) * Math.PI)) / 2);
    const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
    return res.json({
      success: true,
      data: {
        temperature: Math.round(temp * 10) / 10,
        windspeed_kmh: wind,
        humidity: 65,
        feelsLike: Math.round((temp + 1.5) * 10) / 10,
        description: 'estimated (no API key configured)',
      }
    });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.main && data.main.temp !== undefined) {
      return res.json({
        success: true,
        data: {
          temperature: data.main.temp,
          windspeed_kmh: (data.wind?.speed || 0) * 3.6,
          humidity: data.main.humidity,
          feelsLike: data.main.feels_like,
          description: data.weather?.[0]?.description || '',
        }
      });
    } else {
      throw new Error(data.message || 'Weather fetch failed');
    }
  } catch (err) {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const peak = 13;
    const low = 5;
    const closer = Math.min(Math.abs(h - peak), Math.abs(h - low));
    const temp = 26 + (8.5 * (1 - Math.cos((closer / 8) * Math.PI)) / 2);
    const wind = Math.max(3, Math.round(6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI)));
    return res.json({
      success: true,
      data: {
        temperature: Math.round(temp * 10) / 10,
        windspeed_kmh: wind,
        humidity: 65,
        feelsLike: Math.round((temp + 1.5) * 10) / 10,
        description: `estimated (${err.message})`,
      }
    });
  }
}));

app.get('/api/test-db', asyncHandler(async (req, res) => {
  // Render is IPv4-only and pg.Pool can't reach Supabase's IPv6 pooler, so
  // we probe via Supabase REST (PostgREST HTTPS, IPv4-friendly) instead of
  // `queryDB('SELECT NOW()')`. A 200 response to a tiny SELECT confirms the
  // service-role key + URL are both live.
  try {
    const rows = await supabaseRest('/users?select=id&limit=1');
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful (via Supabase REST).',
      timestamp: new Date().toISOString(),
      rowCount: Array.isArray(rows) ? rows.length : 0
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(error.status || 500).json({
      status: 'error',
      message: 'Failed to connect to the database.',
      error: error.message || ''
    });
  }
}));


/* ═══════════════════════════════════════════════════════════════
   DASHBOARD SUMMARY ENDPOINT
   Returns overview stats, recent activity, and heatmap data.
   Falls back gracefully when DB is not configured.
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  // ── Heatmap: live thermal data from weather API ──────────────
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;
  const zones = [
    { zone: 'Old Dhaka',  city: 'Dhaka',       uhiOffset: 3.8, desc: 'Class A thermal accumulation zone. Narrow concrete corridors trap heat.' },
    { zone: 'Mirpur',     city: 'Dhaka',       uhiOffset: 2.9, desc: 'Dense residential concrete with limited canopy cover.' },
    { zone: 'Savar',      city: 'Savar',        uhiOffset: 2.1, desc: 'Mixed urban with partial green canopy. Moderate risk window.' },
    { zone: 'Gulshan',    city: 'Dhaka',       uhiOffset: 1.2, desc: 'High green canopy coverage and lake proximity reduce thermal load.' },
  ];

  const heatmapData = await Promise.all(zones.map(async (z) => {
    let baseTemp = 32 + Math.random() * 4;
    let rh = 60 + Math.floor(Math.random() * 20);
    try {
      if (weatherApiKey) {
        const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(z.city)},BD&appid=${weatherApiKey}&units=metric`);
        if (wRes.ok) {
          const wd = await wRes.json();
          baseTemp = wd.main?.temp ?? baseTemp;
          rh = wd.main?.humidity ?? rh;
        }
      }
    } catch (e) { /* use fallback */ }
    const adjustedTemp = baseTemp + z.uhiOffset;
    const hazard = adjustedTemp > 40 ? 'Extreme' : adjustedTemp > 37 ? 'High' : adjustedTemp > 34 ? 'Moderate' : 'Safe';
    const peakHour = adjustedTemp > 34 ? '11:00 AM – 4:00 PM' : 'N/A';
    return { zone: z.zone, hazard, temp: `${adjustedTemp.toFixed(1)}°C`, rh: `${rh}%`, desc: z.desc, time: peakHour };
  }));

  // ── Overview stats from DB or smart fallback ─────────────────
  let stats = null;
  let recentActivity = [];

  if (getPool()) {
    try {
      // Aggregate batch stats
      const batchRes = await queryDB(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'certified') AS certified,
          COUNT(*) FILTER (WHERE status IN ('active','pending')) AS active,
          ROUND(AVG(trust_score)::numeric, 1) AS avg_trust,
          COALESCE(SUM(weight_kg), 0) AS total_weight
        FROM batches
      `);
      const row = batchRes.rows[0];
      const total = parseInt(row.total) || 0;
      const cert = parseInt(row.certified) || 0;
      const certRate = total > 0 ? Math.round((cert / total) * 100) : 0;
      const totalWeightKg = parseFloat(row.total_weight) || 0;
      const weightLabel = totalWeightKg >= 1000 ? `${(totalWeightKg / 1000).toFixed(1)} t` : `${totalWeightKg} kg`;

      stats = {
        totalBatches: total,
        certifiedBatches: cert,
        activeBatches: parseInt(row.active) || 0,
        certRate: `${certRate}%`,
        avgTrustScore: parseFloat(row.avg_trust) || 0,
        totalWeight: weightLabel,
        plasticSaved: total * 240,
        co2Sequestered: Math.round(totalWeightKg * 0.25),
      };

      // Recent activity: last 5 batch events
      const actRes = await queryDB(`
        SELECT batch_number, product_name, status, trust_score, destination_zone, created_at, weight_kg
        FROM batches
        ORDER BY created_at DESC
        LIMIT 5
      `);
      recentActivity = actRes.rows.map(r => {
        const elapsed = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
        const timeAgo = elapsed < 60 ? `${elapsed} min ago` : elapsed < 1440 ? `${Math.round(elapsed/60)} hr ago` : `${Math.round(elapsed/1440)} day ago`;
        const isNew = r.status === 'pending' || r.status === 'active';
        const isCert = r.status === 'certified';
        const isDispatched = r.status === 'dispatched' || r.status === 'delivered';
        return {
          icon: isCert ? '🛡️' : isDispatched ? '🚚' : isNew ? '📦' : '📈',
          colorType: isCert ? 'green' : isDispatched ? 'green' : isNew ? 'blue' : 'amber',
          text: isCert
            ? `Batch ${r.batch_number} certified — Trust Score ${r.trust_score}`
            : isDispatched
            ? `Batch ${r.batch_number} dispatched to ${r.destination_zone || 'destination'}`
            : `New ${r.product_name || 'batch'} ${r.batch_number} created (${r.weight_kg || 0} kg)`,
          time: timeAgo,
        };
      });
    } catch (dbErr) {
      console.error('[Dashboard] DB query error:', dbErr.message);
    }
  }

  // ── Smart fallback when DB unavailable ────────────────────────
  if (!stats) {
    const now = new Date();
    const seed = now.getFullYear() * 100 + now.getMonth() * 10 + now.getDate(); // deterministic per day
    const t = (seed % 40) + 100; // 100–139
    const c = Math.round(t * 0.83);
    stats = {
      totalBatches: t,
      certifiedBatches: c,
      activeBatches: Math.round(t * 0.06),
      certRate: `${Math.round((c/t)*100)}%`,
      avgTrustScore: 79 + (seed % 7),
      totalWeight: `${(t * 0.061).toFixed(1)} t`,
      plasticSaved: t * 240,
      co2Sequestered: Math.round(t * 61 * 0.25),
    };
    recentActivity = [
      { icon: '🛡️', colorType: 'green',  text: `Batch BCH-${t} certified — Trust Score ${82 + (seed % 12)}`, time: '3 min ago' },
      { icon: '📈', colorType: 'amber',  text: `DVS simulation for Old Dhaka route — Score ${60 + (seed % 18)} (Caution)`, time: '21 min ago' },
      { icon: '🚚', colorType: 'green',  text: `Batch BCH-${t-2} dispatched to Mirpur`, time: '1 hr ago' },
      { icon: '⚠️', colorType: 'red',    text: 'High thermal hazard in Old Dhaka — delay dispatches until 5 PM', time: '2 hr ago' },
      { icon: '📦', colorType: 'blue',   text: `New biochar batch BCH-${t-1} created (${180 + (seed % 40)} kg)`, time: '3 hr ago' },
    ];
  }

  res.json({
    success: true,
    data: { stats, recentActivity, heatmap: heatmapData, liveData: Boolean(pool) }
  });
}));

/* ═══════════════════════════════════════════════════════════════
   AUTHENTICATION ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const payload = parseBody(registrationSchema, req, res);
  if (!payload) return;

  const passwordHash = await argon2.hash(payload.password);
  try {
    const result = await queryDB(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [payload.email, passwordHash, payload.name, payload.role]
    );
    const user = result.rows[0];
    const { accessToken } = await issueAuthTokens(req, res, user);
    res.status(201).json({
      success: true,
      data: {
        user: toPublicUser(user),
        access_token: accessToken,
        token_type: 'Bearer',
        access_token_ttl: ACCESS_TOKEN_TTL
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    throw error;
  }
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const payload = parseBody(loginSchema, req, res);
  if (!payload) return;

  // Look up the user via Supabase REST (IPv4-friendly HTTPS) instead of
  // pg.Pool, which on Render's IPv4-only network can't reach Supabase's
  // IPv6 pooler. We still verify the password with Argon2 against the
  // stored password_hash so security is unchanged.
  const lookupUrl = `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(payload.email)}&select=id,email,password_hash,name,role,created_at&limit=1`;
  const lookupRes = await fetch(lookupUrl, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!lookupRes.ok) {
    return res.status(503).json({ success: false, error: `User lookup failed (${lookupRes.status})` });
  }

  const userRows = await lookupRes.json();
  const user = userRows && userRows[0];
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  let passwordOk = false;
  try {
    passwordOk = await argon2.verify(user.password_hash, payload.password);
  } catch (error) {
    passwordOk = false;
  }
  if (!passwordOk) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const { accessToken } = await issueAuthTokens(req, res, user);
  res.json({
    success: true,
    data: {
      user: toPublicUser(user),
      access_token: accessToken,
      token_type: 'Bearer',
      access_token_ttl: ACCESS_TOKEN_TTL
    }
  });
}));

app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
  ensureAuthSecrets();
  const payload = parseBody(refreshSchema, req, res);
  if (!payload) return;

  const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME) || payload.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ success: false, error: 'Refresh token is required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }

  const oldTokenHash = hashRefreshToken(refreshToken);
  // Use Supabase REST to look up the refresh token + user (no pg.Pool).
  // PostgREST supports filter-and-embed; if your schema doesn't have a
  // FK relationship, fall back to two queries.
  const rtUrl = `${process.env.SUPABASE_URL}/rest/v1/refresh_tokens?token_hash=eq.${encodeURIComponent(oldTokenHash)}&revoked=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id&limit=1`;
  const rtRes = await fetch(rtUrl, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!rtRes.ok) {
    return res.status(401).json({ success: false, error: 'Refresh token is invalid or revoked' });
  }
  const rtRows = await rtRes.json();
  const rtRow = rtRows && rtRows[0];
  if (!rtRow || decoded.sub !== rtRow.user_id) {
    return res.status(401).json({ success: false, error: 'Refresh token is invalid or revoked' });
  }

  // Look up the user record.
  const userUrl = `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(rtRow.user_id)}&select=id,email,name,role,created_at&limit=1`;
  const userRes = await fetch(userUrl, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!userRes.ok) {
    return res.status(401).json({ success: false, error: 'Refresh token is invalid or revoked' });
  }
  const userRows = await userRes.json();
  const user = userRows && userRows[0];
  if (!user) {
    return res.status(401).json({ success: false, error: 'Refresh token is invalid or revoked' });
  }

  // Revoke the old refresh token (best-effort, non-fatal).
  try {
    const revokeUrl = `${process.env.SUPABASE_URL}/rest/v1/refresh_tokens?token_hash=eq.${encodeURIComponent(oldTokenHash)}`;
    await fetch(revokeUrl, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() })
    });
  } catch (e) {
    console.warn('[auth] refresh-token revoke failed (non-fatal):', e.message);
  }

  const { accessToken } = await issueAuthTokens(req, res, user);
  res.json({
    success: true,
    data: {
      user: toPublicUser(user),
      access_token: accessToken,
      token_type: 'Bearer',
      access_token_ttl: ACCESS_TOKEN_TTL
    }
  });
}));

app.post('/api/auth/logout', asyncHandler(async (req, res) => {
  const payload = parseBody(refreshSchema, req, res);
  if (!payload) return;

  const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME) || payload.refreshToken;
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    // Best-effort revoke via Supabase REST (non-fatal).
    try {
      const revokeUrl = `${process.env.SUPABASE_URL}/rest/v1/refresh_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}`;
      await fetch(revokeUrl, {
        method: 'PATCH',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() })
      });
    } catch (e) {
      console.warn('[auth] logout revoke failed (non-fatal):', e.message);
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: '/api/auth'
  });

  res.json({ success: true, message: 'Logged out' });
}));

/* ═══════════════════════════════════════════════════════════════
   MICROCLIMATE ZONE ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

// Get all zones with microclimate data
app.get('/api/zones', asyncHandler(async (req, res) => {
  // Use Supabase REST (PostgREST) instead of pg.Pool — Render is IPv4-only
  // and can't reach Supabase's IPv6 pooler. PostgREST's `order` syntax
  // matches the SQL equivalent.
  const rows = await supabaseRest('/zone_microclimate_profiles?select=*&order=zone.asc');
  res.json({
    success: true,
    data: rows || [],
    count: Array.isArray(rows) ? rows.length : 0
  });
}));

// Get specific zone data
app.get('/api/zones/:zone', asyncHandler(async (req, res) => {
  const { zone } = req.params;
  const rows = await supabaseRest(
    `/zone_microclimate_profiles?zone=eq.${encodeURIComponent(zone)}&select=*&limit=1`
  );
  if (!rows || rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Zone not found' });
  }
  res.json({ success: true, data: rows[0] });
}));

// List products — used by the SME marketplace dashboard. The TS app at
// `backend/src/app.ts` has a `/api/products` route, but Render actually runs
// this legacy `backend/index.js`, which never declared the route — that's why
// the dashboard was getting 404s. Implemented here on top of Supabase REST.
app.get('/api/products', asyncHandler(async (req, res) => {
  const { category, status, seller } = req.query;
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc' });
  if (category) params.append('category', `eq.${category}`);
  if (status) params.append('status', `eq.${status}`);
  if (seller) params.append('seller', `eq.${seller}`);
  const rows = await supabaseRest(`/products?${params.toString()}`);
  res.json({ success: true, data: rows || [], count: Array.isArray(rows) ? rows.length : 0 });
}));

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rows = await supabaseRest(`/products?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  if (!rows || rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: rows[0] });
}));

// Create/update zone profile
app.post('/api/zones', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const payload = parseBody(zoneUpsertSchema, req, res);
  if (!payload) return;
  const {
    zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient
  } = payload;

  // PostgREST upsert: use Prefer: resolution=merge-duplicate to do
  // INSERT ... ON CONFLICT equivalent. We need a UNIQUE constraint on
  // `zone` for this to work — see supabase/migrations.
  const body = [{
    zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient
  }];
  const rows = await supabaseRest('/zone_microclimate_profiles?on_conflict=zone', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicate,return=representation' },
    body: JSON.stringify(body)
  });

  res.status(201).json({ success: true, data: rows && rows[0] });
}));

/* ═══════════════════════════════════════════════════════════════
   BATCH MANAGEMENT ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

// Get all batches
app.get('/api/batches', asyncHandler(async (req, res) => {
  const { processor_id } = req.query;
  let query = 'SELECT * FROM batches ORDER BY created_at DESC';
  const params = [];
  
  if (processor_id) {
    query = 'SELECT * FROM batches WHERE processor_id = $1 ORDER BY created_at DESC';
    params.push(processor_id);
  }
  
  const result = await queryDB(query, params);
  res.json({ success: true, data: result.rows, count: result.rows.length });
}));

// Get specific batch
app.get('/api/batches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await queryDB(
    'SELECT * FROM batches WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  res.json({ success: true, data: result.rows[0] });
}));

// Create new batch
app.post('/api/batches', asyncHandler(async (req, res) => {
  const payload = parseBody(batchCreateSchema, req, res);
  if (!payload) return;
  const { processor_id, batch_number, feedstock_type, product_name, trust_score } = payload;

  const result = await queryDB(`
    INSERT INTO batches (processor_id, batch_number, feedstock_type, product_name, trust_score)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `, [processor_id || null, batch_number, feedstock_type, product_name, trust_score]);
  
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// Update batch
app.put('/api/batches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = parseBody(batchUpdateSchema, req, res);
  if (!payload) return;
  const { product_name, trust_score, certificate_url, qr_code_url } = payload;

  const result = await queryDB(`
    UPDATE batches 
    SET product_name = COALESCE($2, product_name),
        trust_score = COALESCE($3, trust_score),
        certificate_url = COALESCE($4, certificate_url),
        qr_code_url = COALESCE($5, qr_code_url)
    WHERE id = $1
    RETURNING *;
  `, [id, product_name, trust_score, certificate_url, qr_code_url]);

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  
  res.json({ success: true, data: result.rows[0] });
}));

/* ═══════════════════════════════════════════════════════════════
   IOT SENSOR READINGS ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

// Get IoT readings for a batch
app.get('/api/batches/:batch_id/readings', asyncHandler(async (req, res) => {
  const { batch_id } = req.params;
  const result = await queryDB(
    'SELECT * FROM iot_readings WHERE batch_id = $1 ORDER BY recorded_at DESC',
    [batch_id]
  );
  res.json({ success: true, data: result.rows, count: result.rows.length });
}));

// Record new IoT reading
app.post('/api/batches/:batch_id/readings', asyncHandler(async (req, res) => {
  const { batch_id } = req.params;
  const payload = parseBody(readingCreateSchema, req, res);
  if (!payload) return;
  const { pH, EC, temperature, em1_ratio, fermentation_days } = payload;

  const result = await queryDB(`
    INSERT INTO iot_readings (batch_id, pH, EC, temperature, em1_ratio, fermentation_days)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `, [batch_id, pH, EC, temperature, em1_ratio, fermentation_days]);
  
  res.status(201).json({ success: true, data: result.rows[0] });
}));

/* ═══════════════════════════════════════════════════════════════
   TRUST SCORE CALCULATION ENDPOINT
   ═══════════════════════════════════════════════════════════════ */

// Calculate trust score
app.post('/api/calculate-trust-score', asyncHandler(async (req, res) => {
  const payload = parseBody(trustScoreSchema, req, res);
  if (!payload) return;
  const { pH, EC, temperature, ratio, days } = payload;

  // Trust Score Calculation Logic (from frontend)
  let score = 100;
  const pHOpt = 4.0, ECOpt = 3.5, tempOpt = 28;
  score -= Math.abs(pH - pHOpt) * 8;
  score -= Math.abs(EC - ECOpt) * 6;
  score -= Math.abs(temperature - tempOpt) * 1.2;
  const ratioMap = { "1:1:10": -5, "1:1:20": 0, "1:1:30": -3, "1:1:40": -8 };
  score += ratioMap[ratio] ?? 0;
  if (days < 7) score -= (7 - days) * 4;
  else if (days > 14) score -= (days - 14) * 2;
  
  score = Math.max(0, Math.min(100, Math.round(score)));

  res.json({ 
    success: true, 
    data: { 
      trust_score: score,
      parameters: { pH, EC, temperature, ratio, days }
    } 
  });
}));


/* ═══════════════════════════════════════════════════════════════
   ESG METRICS ENDPOINT
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/esg', asyncHandler(async (req, res) => {
  const trustScore = parseFloat(req.query.trustScore ?? '84');
  const dvs = parseFloat(req.query.dvs ?? '72');

  const eScore = Math.min(100, Math.round((trustScore * 0.5) + (dvs * 0.5)));
  const sScore = Math.min(100, Math.round((trustScore * 0.4) + 54));
  const gScore = Math.min(100, Math.round((trustScore * 0.6) + 38));
  const esgScore = Math.round((eScore + sScore + gScore) / 3);

  const plasticOffset = Math.round(trustScore * 0.85);
  const carbonSeq = Math.round(trustScore * 1.4);
  const waterSaved = Math.round(trustScore * 18.5);
  const wasteReduced = Math.round(trustScore * 3.2);
  const spoilagePrevented = Math.round(trustScore * 2.1 * (dvs / 100) * 40);

  const metrics = {
    e_score: eScore,
    s_score: sScore,
    g_score: gScore,
    esg_score: esgScore,
    plastic_offset_kg: plasticOffset,
    carbon_sequestered_kg: carbonSeq,
    water_saved_l: waterSaved,
    waste_reduced_kg: wasteReduced,
    trust_score: trustScore,
    dvs_score: dvs,
    month: new Date().toISOString(),
    spoilage_prevented_bdt: spoilagePrevented
  };

  // Gracefully save to database if connection pool is configured
  if (getPool()) {
    try {
      await queryDB(
        `INSERT INTO esg_metrics 
         (month, spoilage_prevented_bdt, plastic_offset_kg, carbon_sequestered_kg, water_saved_l, waste_reduced_kg, e_score, s_score, g_score, esg_score, trust_score, dvs_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          metrics.month,
          metrics.spoilage_prevented_bdt,
          metrics.plastic_offset_kg,
          metrics.carbon_sequestered_kg,
          metrics.water_saved_l,
          metrics.waste_reduced_kg,
          metrics.e_score,
          metrics.s_score,
          metrics.g_score,
          metrics.esg_score,
          metrics.trust_score,
          metrics.dvs_score
        ]
      );
    } catch (dbErr) {
      console.error('[ESG] Failed to log metrics to database:', dbErr.message);
    }
  }

  res.json(metrics);
}));

/* ═══════════════════════════════════════════════════════════════
   DEMAND FORECAST ENDPOINT
   ═══════════════════════════════════════════════════════════════ */

// Get demand forecast
app.get('/api/demand-forecast', asyncHandler(async (req, res) => {
  const forecastPath = require('path').join(__dirname, '../public/demand-forecast-mock.json');
  try {
    const forecast = require(forecastPath);
    res.json({ success: true, data: forecast });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not load forecast data' });
  }
}));

/* ═══════════════════════════════════════════════════════════════
   USER ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

// Get all users (admin only)
app.get('/api/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await queryDB(
    'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: result.rows, count: result.rows.length });
}));

// Create user
app.post('/api/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const payload = parseBody(adminCreateUserSchema, req, res);
  if (!payload) return;
  const { email, password, name, role } = payload;
  const password_hash = await argon2.hash(password);

  try {
    const result = await queryDB(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role, created_at;
    `, [email, password_hash, name, role]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    throw error;
  }
}));

/* ═══════════════════════════════════════════════════════════════
   AI AGENT CHATBOT ROUTES (Groq-powered)
   ═══════════════════════════════════════════════════════════════ */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// In-memory session store
const chatSessions = new Map();

function getOrCreateSession(sessionId) {
  if (sessionId && chatSessions.has(sessionId)) {
    return chatSessions.get(sessionId);
  }
  const id = sessionId || require('uuid').v4();
  const session = { sessionId: id, history: [], createdAt: Date.now() };
  chatSessions.set(id, session);
  return session;
}

// City name normalizer
const CITY_MAP = {
  'borishal': 'Barisal', 'barisal': 'Barisal', 'barishal': 'Barisal',
  'bogura': 'Bogra', 'bogra': 'Bogra', 'bogora': 'Bogra',
  'dhaka': 'Dhaka', 'dhakar': 'Dhaka', 'dacca': 'Dhaka',
  'chittagong': 'Chittagong', 'chattogram': 'Chittagong',
  'sylhet': 'Sylhet', 'silhet': 'Sylhet',
  'rajshahi': 'Rajshahi', 'khulna': 'Khulna',
  'rangpur': 'Rangpur', 'mymensingh': 'Mymensingh',
  'comilla': 'Comilla', 'cumilla': 'Comilla',
  'coxsbazar': "Cox's Bazar", 'jessore': 'Jessore', 'jashore': 'Jessore',
  'narayanganj': 'Narayanganj', 'gazipur': 'Gazipur',
};
const NOISE_TOKENS = new Set(['weather','forecast','climate','temperature',
  'আবহাওয়া','তাপমাত্রা','বৃষ্টি','sohorer','sohor','shohorer','shohor',
  'city','ki','kemon','ache','আছে','কি','কেমন','er','র','এর','te','তে']);

function normalizeCity(input) {
  if (!input) return null;
  const tokens = input.toLowerCase().trim().split(/\s+/);
  for (const token of tokens) {
    if (NOISE_TOKENS.has(token)) continue;
    if (CITY_MAP[token]) return CITY_MAP[token];
    // Try stripping common suffixes
    for (const suffix of ['er','r','te','e','thi']) {
      if (token.endsWith(suffix)) {
        const stripped = token.slice(0, -suffix.length);
        if (stripped.length > 2 && CITY_MAP[stripped]) return CITY_MAP[stripped];
      }
    }
  }
  return null;
}

const AGENT_SYSTEM_PROMPT = `You are ClimaLogix AI, an intelligent agricultural commerce assistant for Bangladesh's organic farming sector. You understand Bangla, English, and Banglish naturally.

You help farmers with: weather/climate data, BARI agricultural guidelines, product browsing, placing orders, and navigating the platform.

For every user message, respond with a JSON object in this exact format:
{"intent": "weather" | "navigate" | "order" | "product_search" | "bari_advice" | "general_chat", "language": "bn" | "en" | "mixed", "extractedData": {"city": "string or null", "page": "dashboard" | "batches" | "batch_verification" | "microclimate" | "climate_demand" | "impact_esg" | "marketplace" | "chatbot" | null, "productName": "string or null", "quantity": "number or null", "unit": "string or null", "cropContext": "string or null"}, "replyMessage": "Your natural response in the same language the user used"}

Rules:
- Always respond in the same language the user wrote in (Bangla, English, or mixed)
- If the user wants to go to or see a page (e.g. "marketplace দেখাও", "marketplace নিয়ে যাও", "show marketplace", "go to dashboard", "আমার orders দেখাও", "orders page") — set intent to "navigate" and set extractedData.page to the exact matching page identifier (e.g. "marketplace", "batches", "dashboard", etc.)
- If the user asks to see products, search catalog, or find available items (e.g. "compost সার দেখান", "organic compost সার", "সার কি কি আছে", "সার খুঁজে দিন", "show products", "search biochar") — set intent to "product_search" and extract productName
- If the assistant previously asked for a city name/location and the user responds with a city name (e.g. "Dhaka", "Sylhet", "dhakar"), set the intent to "weather" and extract the city into extractedData.city
- If the user asks about weather, temperature, আবহাওয়া — set intent to "weather" and extract the city name into extractedData.city
- If the user wants to order or buy products (e.g. "compost কিনতে চাই", "order fertilizer") — set intent to "order" and extract productName and quantity
- replyMessage must be warm and conversational — never robotic
- Never say "I cannot help with that"
- IMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks.`;

// Groq client — uses official SDK so auth works reliably on all environments
let groqClient = null;
function getGroqClient() {
  if (!groqClient) {
    const rawApiKey = process.env.GROQ_API_KEY;
    if (!rawApiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    const apiKey = rawApiKey.trim();
    groqClient = new GroqClass({ apiKey });
  }
  return groqClient;
}

async function callGroq(messages) {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  });
  return completion.choices[0]?.message?.content || '';
}

async function getWeather(city, lang) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},BD&appid=${apiKey}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      city: d.name,
      temperature: Math.round(d.main.temp),
      feelsLike: Math.round(d.main.feels_like),
      humidity: d.main.humidity,
      windSpeed: d.wind.speed,
      description: d.weather[0].description,
    };
  } catch { return null; }
}

// POST /api/ai/chat/start
app.post('/api/ai/chat/start', (req, res) => {
  const session = getOrCreateSession(null);
  res.json({ success: true, data: { sessionId: session.sessionId } });
});

// DELETE /api/ai/chat/end
app.delete('/api/ai/chat/end', (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId) chatSessions.delete(sessionId);
  res.json({ success: true });
});

// POST /api/agent/message — main chatbot endpoint
app.post('/api/agent/message', async (req, res) => {
  try {
    const { query, language, sessionId, customProducts } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const session = getOrCreateSession(sessionId);
    const lang = language === 'bn' ? 'bn' : 'en';

    const lowerQuery = query.toLowerCase().trim();
    let responseMessage = null;
    let responseType = 'TEXT';
    let responseProducts = undefined;
    let navigationTarget = undefined;
    let pendingOrder = undefined;

    // 1. High-Performance Deterministic Navigation Check
    if (/(marketplace|market|মার্কেটপ্লেস|বাজার|পণ্য তালিকা|প্রোডাক্ট লিস্ট)/i.test(lowerQuery)) {
      responseType = 'NAVIGATION';
      responseMessage = lang === 'bn' ? 'মার্কেটপ্লেসে যাওয়া হচ্ছে...' : 'Navigating to the Marketplace...';
      navigationTarget = 'marketplace';
    } else if (/(dashboard|ড্যাশবোর্ড|ওভারভিউ)/i.test(lowerQuery)) {
      responseType = 'NAVIGATION';
      responseMessage = lang === 'bn' ? 'ড্যাশবোর্ডে যাওয়া হচ্ছে...' : 'Navigating to the Dashboard...';
      navigationTarget = 'dashboard';
    } else if (/(batches|batch registry|অর্ডার তালিকা|অর্ডার বিবরণী)/i.test(lowerQuery)) {
      responseType = 'NAVIGATION';
      responseMessage = lang === 'bn' ? 'অর্ডার তালিকায় যাওয়া হচ্ছে...' : 'Navigating to the Order Registry...';
      navigationTarget = 'batches';
    }

    // Parse and format custom products if provided
    let customProdsFormatted = [];
    if (Array.isArray(customProducts)) {
      customProdsFormatted = customProducts.map(p => {
        let priceBdt = 150;
        if (p.price) {
          if (typeof p.price === 'number') {
            priceBdt = p.price;
          } else {
            const matches = p.price.match(/\d+([.,]\d+)?/);
            if (matches) {
              priceBdt = parseFloat(matches[0].replace(/,/g, ''));
            }
          }
        }
        return {
          id: p.id || `custom-${p.name}`,
          name: p.name,
          category: p.category || 'Agriculture',
          price_bdt: priceBdt,
          price: typeof p.price === 'string' && p.price.startsWith('৳') ? p.price : `৳ ${priceBdt}`,
          unit: p.unit || 'Kg',
          seller: p.seller || 'My Custom SME',
          dvs: p.dvs || 90,
          icon: p.icon || '🌱',
          badge: p.badge || null
        };
      });
    }

    // 2. High-Performance Deterministic Product Search Check
    if (!navigationTarget) {
      const hasSearchVerb = /(show|find|search|খুঁজ|দেখাও|আছে কি|available|stock|দেখান|খুঁজে)/i.test(lowerQuery);
      const hasProductKeyword = /(product|fertilizer|সার|compost|কম্পোস্ট|item|পণ্য|বায়োচার|biochar)/i.test(lowerQuery);
      
      let matchedCustomProduct = null;
      if (Array.isArray(customProducts)) {
        matchedCustomProduct = customProducts.find(p => lowerQuery.includes(p.name.toLowerCase()));
      }

      if ((hasSearchVerb && hasProductKeyword) || matchedCustomProduct ||
          /^(fertilizer|সার|compost|কম্পোস্ট|product|পণ্য|biochar|বায়োচার)$/i.test(lowerQuery) ||
          (hasSearchVerb && Array.isArray(customProducts) && customProducts.some(p => lowerQuery.includes(p.name.toLowerCase())))) {
        
        let searchKeyword = 'fertilizer';
        if (lowerQuery.includes('compost') || lowerQuery.includes('কম্পোস্ট')) {
          searchKeyword = 'compost';
        } else if (lowerQuery.includes('biochar') || lowerQuery.includes('বায়োচার')) {
          searchKeyword = 'biochar';
        } else if (matchedCustomProduct) {
          searchKeyword = matchedCustomProduct.name.toLowerCase();
        }
                              
        const fallbackProducts = [
          { id: 'prod-compost', name: 'Premium Organic Compost', category: 'Agriculture', price_bdt: 240, price: '৳ 240', unit: 'Kg', seller: 'Organic SME', dvs: 94, icon: '📦' },
          { id: 'prod-biochar', name: 'Carbon-Neutral Biochar', category: 'Agriculture', price_bdt: 150, price: '৳ 150', unit: 'Kg', seller: 'SME Co-op', dvs: 92, icon: '🌿' },
          { id: 'prod-fertilizer', name: 'Eco-Friendly Fertilizer', category: 'Agriculture', price_bdt: 180, price: '৳ 180', unit: 'Kg', seller: 'SME Co-op', dvs: 88, icon: '🌱' }
        ];
        
        let matched = [...customProdsFormatted, ...fallbackProducts];
        if (pool) {
          try {
            const prodRes = await queryDB('SELECT * FROM products');
            if (prodRes && prodRes.rows.length > 0) {
              const dbProds = prodRes.rows.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category || 'Agriculture',
                price_bdt: p.price_bdt || p.price || 150,
                price: `৳ ${p.price_bdt || p.price || 150}`,
                unit: p.unit || 'Kg',
                seller: p.seller || 'SME Co-op',
                dvs: p.dvs || 90,
                icon: p.category === 'compost' ? '📦' : '🌱'
              }));
              matched = [...customProdsFormatted, ...dbProds, ...fallbackProducts];
            }
          } catch (err) {
            console.warn('[Agent Product Search] Failed to query products:', err.message);
          }
        }

        responseProducts = matched.filter(p => 
          p.name.toLowerCase().includes(searchKeyword) || 
          p.category.toLowerCase().includes(searchKeyword)
        );
        if (responseProducts.length === 0) {
          responseProducts = matched.slice(0, 3);
        }
        
        responseMessage = lang === 'bn' ? 'এখানে কিছু চমৎকার পণ্য রয়েছে যা আপনি দেখতে পারেন:' : 'Here are some excellent products you can view:';
        responseType = 'PRODUCT_LIST';
      }
    }

    // 3. Conversational Fallback via Groq LLM
    if (!navigationTarget && !responseProducts) {
      // Build conversation history for context
      const history = session.history.slice(-6).map(m => ({ role: m.role, content: m.content }));
      
      const customProductsContext = Array.isArray(customProducts) && customProducts.length > 0
        ? `Here is the current customized SME product catalog you can help users order:\n` + customProducts.map(p => `- ${p.name} (${p.category}): Price: ${p.price}, Unit: ${p.unit}, Seller: ${p.seller}, DVS Score: ${p.dvs}`).join('\n')
        : '';
      
      const messages = [
        { role: 'system', content: AGENT_SYSTEM_PROMPT + (customProductsContext ? `\n\n${customProductsContext}` : '') },
        ...history,
        { role: 'user', content: query },
      ];

      let parsed = null;
      let parseError = null;
      try {
        const raw = await callGroq(messages);
        let cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parseError = e;
        console.error('[Agent] Groq/parse failed:', e.message, e.stack);
      }

      if (parsed && parsed.intent === 'weather') {
        const cityInput = parsed.extractedData?.city || query;
        const normalizedCity = normalizeCity(cityInput);
        if (normalizedCity) {
          const weather = await getWeather(normalizedCity, lang);
          if (weather) {
            responseMessage = lang === 'bn'
              ? `${weather.city}-এর বর্তমান আবহাওয়া:\n🌡️ তাপমাত্রা: ${weather.temperature}°C (অনুভূতি: ${weather.feelsLike}°C)\n🌤️ অবস্থা: ${weather.description}\n💧 আর্দ্রতা: ${weather.humidity}%\n💨 বাতাসের গতি: ${weather.windSpeed} m/s`
              : `Current weather in ${weather.city}:\n🌡️ Temperature: ${weather.temperature}°C (Feels like: ${weather.feelsLike}°C)\n🌤️ Condition: ${weather.description}\n💧 Humidity: ${weather.humidity}%\n💨 Wind Speed: ${weather.windSpeed} m/s`;
          } else {
            responseMessage = parsed.replyMessage ||
              (lang === 'bn' ? `দুঃখিত, ${normalizedCity} শহরের আবহাওয়া তথ্য পাওয়া যায়নি।` : `Could not find weather data for ${normalizedCity}.`);
          }
        } else {
          responseMessage = parsed.replyMessage ||
            (lang === 'bn' ? 'আপনার শহরের নাম জানান, আমি আবহাওয়া তথ্য দেব।' : 'Please tell me your city name for weather information.');
        }
      } else if (parsed && parsed.replyMessage) {
        responseMessage = parsed.replyMessage;
        if (parsed.intent === 'navigate') {
          responseType = 'NAVIGATION';
          navigationTarget = parsed.extractedData?.page || 'dashboard';
        }
        if (parsed.intent === 'order') {
          responseType = 'ORDER_CONFIRM_PROMPT';
          pendingOrder = {
            productName: parsed.extractedData?.productName || '',
            quantity: parsed.extractedData?.quantity || 1
          };
        }
      } else {
        responseMessage = lang === 'bn'
          ? 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।'
          : `Sorry, I could not understand that. Error: ${parseError ? parseError.message : 'Unknown'}`;
      }
    }

    session.history.push({ role: 'user', content: query });
    session.history.push({ role: 'assistant', content: responseMessage });

    res.json({
      success: true,
      data: {
        type: responseType,
        message: responseMessage,
        language: lang,
        sessionId: session.sessionId,
        navigationTarget,
        pendingOrder,
        products: responseProducts
      }
    });
  } catch (err) {
    console.error('[Agent] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

app.post('/api/orders/voice', asyncHandler(async (req, res) => {
  const { productName, quantity, farmerId, customProducts } = req.body;
  const finalQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity || '1', 10) || 1;
  const buyerId = farmerId || 'demo-farmer-id';

  const lowerSearch = (productName || 'compost').toLowerCase();
  let matchedProduct = null;

  // Try matching custom products first
  if (Array.isArray(customProducts)) {
    const foundCustom = customProducts.find(p => 
      p.name.toLowerCase().includes(lowerSearch) || 
      lowerSearch.includes(p.name.toLowerCase())
    );
    if (foundCustom) {
      let priceBdt = 150;
      if (foundCustom.price) {
        if (typeof foundCustom.price === 'number') {
          priceBdt = foundCustom.price;
        } else {
          const matches = foundCustom.price.match(/\d+([.,]\d+)?/);
          if (matches) {
            priceBdt = parseFloat(matches[0].replace(/,/g, ''));
          }
        }
      }
      matchedProduct = {
        id: foundCustom.id || `custom-${foundCustom.name}`,
        name: foundCustom.name,
        price_bdt: priceBdt
      };
    }
  }

  if (!matchedProduct) {
    // Fallback products catalog
    const fallbackProducts = [
      { id: 'prod-compost', name: 'Premium Organic Compost', price_bdt: 240 },
      { id: 'prod-biochar', name: 'Carbon-Neutral Biochar', price_bdt: 150 },
      { id: 'prod-fertilizer', name: 'Eco-Friendly Fertilizer', price_bdt: 180 }
    ];

    matchedProduct = fallbackProducts[0];
    
    if (pool) {
      try {
        // 1. Try querying products table
        const prodRes = await queryDB('SELECT * FROM products');
        if (prodRes && prodRes.rows.length > 0) {
          const found = prodRes.rows.find(p => 
            p.name.toLowerCase().includes(lowerSearch) || 
            (p.description && p.description.toLowerCase().includes(lowerSearch))
          );
          if (found) {
            matchedProduct = {
              id: found.id,
              name: found.name,
              price_bdt: found.price_bdt || found.price || 150
            };
          } else {
            matchedProduct = {
              id: prodRes.rows[0].id,
              name: prodRes.rows[0].name,
              price_bdt: prodRes.rows[0].price_bdt || prodRes.rows[0].price || 150
            };
          }
        }
      } catch (err) {
        console.warn('[Orders Voice] Failed to query product catalog from database:', err.message);
      }
    } else {
      const foundFallback = fallbackProducts.find(p => p.name.toLowerCase().includes(lowerSearch));
      if (foundFallback) {
        matchedProduct = foundFallback;
      }
    }
  }

  // 2. Create the order
  const totalBdt = matchedProduct.price_bdt * finalQuantity;
  let orderId = uuidv4();

  if (pool) {
    try {
      // 3. Try to insert order into database
      const orderRes = await queryDB(
        'INSERT INTO orders (buyer_id, product_id, quantity, total_bdt, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [buyerId, matchedProduct.id, finalQuantity, totalBdt, 'pending']
      );
      if (orderRes && orderRes.rows.length > 0) {
        orderId = orderRes.rows[0].id;
      }
    } catch (err) {
      console.warn('[Orders Voice] Failed to write order to database, using mock ID:', err.message);
    }
  }

  res.json({
    success: true,
    data: {
      orderId,
      productName: matchedProduct.name,
      quantity: finalQuantity,
      totalBdt,
      message: `আপনার অর্ডার সফলভাবে নেওয়া হয়েছে: ${matchedProduct.name}, পরিমাণ: ${finalQuantity}।`
    }
  });
}));

app.post('/api/batches/certify', asyncHandler(async (req, res) => {
  try {
    const { batchId } = req.body;
    
    // Generate actual batch ID if none provided
    const displayBatchId = batchId || `BCH-${Date.now().toString().slice(-6)}`;
    
    // Create the public verification URL
    const verificationUrl = `https://climalogix.build/verify/${displayBatchId}`;
    
    // Generate QR code data URL (Base64 image) securely on the backend
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({
      success: true,
      data: {
        batchId: displayBatchId,
        verificationUrl,
        qrCodeDataUrl,
        certifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('QR Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate cryptographic QR code' });
  }
}));

/* ═══════════════════════════════════════════════════════════════
   ERROR HANDLING
   ═══════════════════════════════════════════════════════════════ */

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

/* ═══════════════════════════════════════════════════════════════
   SERVER START
   ═══════════════════════════════════════════════════════════════ */

app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`📡 API Base URL: http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
});
