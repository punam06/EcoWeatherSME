require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// CORS Configuration
// Dynamically reads FRONTEND_URL for production, fallback to local standard ports
const corsOptions = {
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:5000'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// PostgreSQL Pool Client Initialization
// Max 3 connections to optimize for Supabase free-tier limits
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

// Test Route: Server Health
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend server is running.' });
});

// Test Database Route: Verify Supabase Connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW();');
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful.',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to the database.',
      error: error.message
    });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
