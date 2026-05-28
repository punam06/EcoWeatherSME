const path = require('path');
const dotenv = require('dotenv');

// Load local .env first, then fallback to repository root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

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

/* ═══════════════════════════════════════════════════════════════
   HEALTH & DIAGNOSTICS
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Backend server is running.',
    environment: process.env.NODE_ENV,
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
app.post('/api/zones', asyncHandler(async (req, res) => {
  const { zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient } = req.body;
  
  if (!zone || uhi_offset === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const result = await queryDB(`
    INSERT INTO zone_microclimate_profiles 
    (zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (zone) DO UPDATE SET
    uhi_offset = $2, building_density = $3, vegetation_fraction = $4, 
    wind_corridor_factor = $5, thermal_mass_coefficient = $6
    RETURNING *;
  `, [zone, uhi_offset, building_density || 0.5, vegetation_fraction || 0.2, wind_corridor_factor || 0.8, thermal_mass_coefficient || 1.0]);
  
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
app.post('/api/batches', asyncHandler(async (req, res) => {
  const { processor_id, batch_number, feedstock_type, product_name, trust_score } = req.body;
  
  if (!batch_number || !feedstock_type || trust_score === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const result = await queryDB(`
    INSERT INTO batches (processor_id, batch_number, feedstock_type, product_name, trust_score)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `, [processor_id || null, batch_number, feedstock_type, product_name || 'Organic Product', Math.min(100, Math.max(0, trust_score))]);
  
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// Update batch
app.put('/api/batches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { product_name, trust_score, certificate_url, qr_code_url } = req.body;

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
  const { pH, EC, temperature, em1_ratio, fermentation_days } = req.body;

  if (pH === undefined || EC === undefined || temperature === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required IoT parameters' });
  }

  const result = await queryDB(`
    INSERT INTO iot_readings (batch_id, pH, EC, temperature, em1_ratio, fermentation_days)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `, [batch_id, pH, EC, temperature, em1_ratio || '1:1:20', fermentation_days || 7]);
  
  res.status(201).json({ success: true, data: result.rows[0] });
}));

/* ═══════════════════════════════════════════════════════════════
   TRUST SCORE CALCULATION ENDPOINT
   ═══════════════════════════════════════════════════════════════ */

// Calculate trust score
app.post('/api/calculate-trust-score', asyncHandler(async (req, res) => {
  const { pH, EC, temperature, ratio, days } = req.body;

  if (pH === undefined || EC === undefined || temperature === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

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
app.get('/api/users', asyncHandler(async (req, res) => {
  const result = await queryDB(
    'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: result.rows, count: result.rows.length });
}));

// Create user
app.post('/api/users', asyncHandler(async (req, res) => {
  const { email, name, role } = req.body;
  
  if (!email || !name || !role) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // In production, password should be hashed
  const password_hash = 'placeholder'; // TODO: Implement proper password hashing

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
