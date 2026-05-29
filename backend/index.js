const path = require('path');
// Always load .env — Render dashboard vars override these automatically
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// CORS Configuration — allow both local dev and Render production frontend
const corsOptions = {
  origin: [
    'https://ecoweathersme.onrender.com',
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
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'refreshToken';

// PostgreSQL Pool Client Initialization (optional)
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  : null;

// Safe query wrapper that returns a helpful error when DB isn't configured
async function queryDB(text, params = []) {
  if (!pool) {
    const err = new Error('DATABASE_URL is not configured. Set DATABASE_URL in your .env');
    err.status = 503;
    throw err;
  }
  return pool.query(text, params);
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
    const err = new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
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
  await queryDB(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, req.get('user-agent') || null, req.ip || null]
  );
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
  await storeRefreshToken(req, user.id, refreshToken);
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
    const result = await queryDB(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid access token' });
    }
    req.user = result.rows[0];
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

app.get('/api/test-db', asyncHandler(async (req, res) => {
  try {
    const result = await queryDB('SELECT NOW();');
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful.',
      timestamp: result.rows[0].now
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

  const result = await queryDB(
    'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1 LIMIT 1',
    [payload.email]
  );
  const user = result.rows[0];
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
  const result = await queryDB(
    `SELECT rt.id, rt.user_id, u.email, u.name, u.role, u.created_at
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()
     LIMIT 1`,
    [oldTokenHash]
  );

  if (result.rows.length === 0 || decoded.sub !== result.rows[0].user_id) {
    return res.status(401).json({ success: false, error: 'Refresh token is invalid or revoked' });
  }

  await queryDB(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1',
    [oldTokenHash]
  );

  const user = {
    id: result.rows[0].user_id,
    email: result.rows[0].email,
    name: result.rows[0].name,
    role: result.rows[0].role,
    created_at: result.rows[0].created_at
  };
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
    await queryDB(
      'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
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
  const result = await queryDB(`
    SELECT * FROM zone_microclimate_profiles 
    ORDER BY zone ASC;
  `);
  res.json({ 
    success: true, 
    data: result.rows,
    count: result.rows.length 
  });
}));

// Get specific zone data
app.get('/api/zones/:zone', asyncHandler(async (req, res) => {
  const { zone } = req.params;
  const result = await queryDB(
    'SELECT * FROM zone_microclimate_profiles WHERE zone = $1',
    [zone]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Zone not found' });
  }
  res.json({ success: true, data: result.rows[0] });
}));

// Create/update zone profile
app.post('/api/zones', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const payload = parseBody(zoneUpsertSchema, req, res);
  if (!payload) return;
  const {
    zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient
  } = payload;

  const result = await queryDB(`
    INSERT INTO zone_microclimate_profiles 
    (zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (zone) DO UPDATE SET
    uhi_offset = $2, building_density = $3, vegetation_fraction = $4, 
    wind_corridor_factor = $5, thermal_mass_coefficient = $6
    RETURNING *;
  `, [zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient]);
  
  res.status(201).json({ success: true, data: result.rows[0] });
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
app.post('/api/batches', requireAuth, requireRole('processor', 'admin'), asyncHandler(async (req, res) => {
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
app.put('/api/batches/:id', requireAuth, requireRole('processor', 'admin'), asyncHandler(async (req, res) => {
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
app.post('/api/batches/:batch_id/readings', requireAuth, requireRole('processor', 'admin'), asyncHandler(async (req, res) => {
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

const AGENT_SYSTEM_PROMPT = `You are EcoSortha AI, an intelligent agricultural commerce assistant for Bangladesh's organic farming sector. You understand Bangla, English, and Banglish naturally.

You help farmers with: weather/climate data, BARI agricultural guidelines, product browsing, placing orders, and navigating the platform.

For every user message, respond with a JSON object in this exact format:
{"intent": "weather" | "navigate" | "order" | "product_search" | "bari_advice" | "general_chat", "language": "bn" | "en" | "mixed", "extractedData": {"city": "string or null", "page": null, "productName": null, "quantity": null, "unit": null, "cropContext": null}, "replyMessage": "Your natural response in the same language the user used"}

Rules:
- Always respond in the same language the user wrote in (Bangla, English, or mixed)
- If the assistant previously asked for a city name/location and the user responds with a city name (e.g. "Dhaka", "Sylhet", "dhakar"), set the intent to "weather" and extract the city into extractedData.city
- If the user asks about weather, temperature, আবহাওয়া — set intent to "weather" and extract the city name into extractedData.city
- replyMessage must be warm and conversational — never robotic
- Never say "I cannot help with that"
- IMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks.`;

// Groq client — uses official SDK so auth works reliably on all environments
let groqClient = null;
function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    groqClient = new Groq({ apiKey });
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
    const { query, language, sessionId } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const session = getOrCreateSession(sessionId);
    const lang = language === 'bn' ? 'bn' : 'en';

    // Build conversation history for context
    const history = session.history.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const messages = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: query },
    ];

    // Call Groq
    let parsed = null;
    try {
      const raw = await callGroq(messages);
      let cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[Agent] Groq/parse failed:', e.message);
    }

    session.history.push({ role: 'user', content: query });

    let responseMessage;
    let responseType = 'TEXT';

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
      if (parsed.intent === 'navigate') responseType = 'NAVIGATION';
      if (parsed.intent === 'order') responseType = 'ORDER_CONFIRM_PROMPT';
    } else {
      // Groq parsed OK but returned no replyMessage — use a safe fallback
      responseMessage = lang === 'bn'
        ? 'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।'
        : 'Sorry, I could not understand that. Could you rephrase your question?';
    }

    session.history.push({ role: 'assistant', content: responseMessage });

    res.json({
      success: true,
      data: {
        type: responseType,
        message: responseMessage,
        language: lang,
        sessionId: session.sessionId,
      }
    });
  } catch (err) {
    console.error('[Agent] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

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
