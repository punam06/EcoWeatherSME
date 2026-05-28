# 🚀 EcoSortha AI - Complete Integration & Setup Guide

## 📋 Project Structure Overview

This is a **full-stack circular commerce platform** for organic agriculture with:
- **Frontend**: React 18 (browser-based, no build step)
- **Backend**: Express.js + PostgreSQL 
- **Database**: Supabase (PostgreSQL with pgvector, RLS)
- **AI**: Claude 3.5 Sonnet (RAG-grounded recommendations)

---

## 🔧 Quick Start (5 Minutes)

### Step 1: Install Backend Dependencies
```bash
# From project root
cd backend
npm install
cd ..
```

### Step 2: Configure Environment
```bash
# Copy template and update with your credentials
cp .env.template .env

# Edit .env with:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY  
# - DATABASE_URL (or leave as template for now)
# - ANTHROPIC_API_KEY
```

### Step 3: Start Backend Server
```bash
# Terminal 1 - Backend on port 5001
cd backend
PORT=5001 npm start

# You should see:
# ✅ Server is running on port 5001
# 📡 API Base URL: http://localhost:5001
# 🏥 Health check: http://localhost:5001/api/health
```

### Step 4: Start Frontend Server
```bash
# Terminal 2 - Frontend on port 3000
cd "Frontend and UI"
python3 -m http.server 3000

# Open: http://localhost:3000/index.html
```

### Step 5: Verify Integration
```bash
# Test backend health
curl http://localhost:5001/api/health

# Test trust score calculation
curl -X POST http://localhost:5001/api/calculate-trust-score \
  -H "Content-Type: application/json" \
  -d '{"pH": 4.0, "EC": 3.5, "temperature": 28, "ratio": "1:1:20", "days": 7}'

# Expected: { "success": true, "data": { "trust_score": 100, ... } }
```

---

## 📦 API Endpoints

### Health & Diagnostics
- `GET /api/health` - Server health check ✅ (working)
- `GET /api/test-db` - Database connectivity test (requires DB configured)

### Zone Management
- `GET /api/zones` - List all microclimate zones
- `GET /api/zones/:zone` - Get specific zone data
- `POST /api/zones` - Create/update zone profile

### Batch Management
- `GET /api/batches` - List all batches
- `GET /api/batches?processor_id=<id>` - Filter by processor
- `GET /api/batches/:id` - Get specific batch
- `POST /api/batches` - Create new batch
- `PUT /api/batches/:id` - Update batch

### IoT Sensor Readings
- `GET /api/batches/:batch_id/readings` - Get batch readings
- `POST /api/batches/:batch_id/readings` - Record new reading

### Trust Score
- `POST /api/calculate-trust-score` - Calculate batch trust score ✅ (working)

### Forecasting
- `GET /api/demand-forecast` - Get 30-day demand/temp forecast ✅ (working)

### User Management
- `GET /api/users` - List all users (requires DB)
- `POST /api/users` - Create new user (requires DB)

---

## 🗄️ Database Setup (Optional)

### For Local Development (PostgreSQL)

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15
   ```

2. **Create Database**:
   ```bash
   createdb ecosortha
   psql ecosortha < schema.sql
   ```

3. **Update .env**:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/ecosortha
   ```

### For Production (Supabase)

1. Create Supabase project: https://supabase.com
2. Get credentials from dashboard
3. Update .env:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   DATABASE_URL=postgresql://postgres:your-password@db.supabase.co:5432/postgres
   ```

---

## 🎨 Frontend Integration

### API Client Usage
The frontend has a built-in API client (`APIClient`) that's automatically loaded:

```javascript
// All endpoints use: window.APIClient.method()

// Health check
await window.APIClient.health();

// Trust score
await window.APIClient.calculateTrustScore({
  pH: 4.0,
  EC: 3.5,
  temperature: 28,
  ratio: "1:1:20",
  days: 7
});

// Demand forecast
await window.APIClient.getDemandForecast();

// Zones
await window.APIClient.getZones();
```

### File Structure
```
Frontend and UI/
├── index.html              # Main dashboard (React 18 JSX)
├── api-integration.js      # API client layer (auto-loaded)
├── ecosortha_dashboard.jsx # Alternative component view
└── UI update/             # Additional UI components
```

---

## 🧪 Testing Endpoints

### 1. Test Health (Always Works)
```bash
curl http://localhost:5001/api/health
```

### 2. Test Trust Score (No DB Needed)
```bash
curl -X POST http://localhost:5001/api/calculate-trust-score \
  -H "Content-Type: application/json" \
  -d '{
    "pH": 4.0,
    "EC": 3.5,
    "temperature": 28,
    "ratio": "1:1:20",
    "days": 7
  }'
```

### 3. Test Demand Forecast (No DB Needed)
```bash
curl http://localhost:5001/api/demand-forecast | jq .
```

### 4. Test DB Connection (Requires Database)
```bash
curl http://localhost:5001/api/test-db
```

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 5001 is in use
lsof -i :5001

# Kill existing process
kill -9 <PID>

# Or use different port
PORT=5002 npm start
```

### "DATABASE_URL is not configured" Error
This is **expected** if you haven't set up a database. The API still works for:
- `/api/health` ✅
- `/api/calculate-trust-score` ✅
- `/api/demand-forecast` ✅

All database-dependent endpoints will fail gracefully with helpful error messages.

### CORS Errors in Frontend
Make sure backend is running on port 5001 and frontend makes requests to `http://localhost:5001/api/*`

---

## 📝 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Backend port | `5001` |
| `NODE_ENV` | Environment | `development` |
| `BACKEND_API_URL` | Frontend points to this | `http://localhost:5001` |
| `FRONTEND_URL` | CORS origin | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `SUPABASE_URL` | Supabase API endpoint | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase public key | `eyJ...` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |

---

## 🚀 Deployment

### Backend (Express on Railway/Render)
```bash
# Deploy backend folder
npm install
PORT=5000 npm start
```

### Frontend (Static on Vercel/Netlify)
```bash
# Deploy "Frontend and UI" folder as static site
# Set environment variable for backend URL
```

---

## 📚 Key Features

✅ **Trust Score Calculator** - Deterministic pH/EC/Temp scoring  
✅ **Microclimate Modeling** - MERM (Microclimate Exposure Risk Model)  
✅ **Thermal Survival Time** - Predict product transit viability  
✅ **Demand Forecasting** - 30-day seasonal patterns  
✅ **IoT Integration** - Record pH, EC, temperature, fermentation days  
✅ **Multi-tenant** - Processor, buyer, admin roles  
✅ **QR Verification** - Cryptographic batch tracking  
✅ **Voice RAG Assistant** - Natural Bangla language interface  

---

## 📖 Documentation

- See [README.md](README.md) for product overview
- See [contexts/plan.md](contexts/plan.md) for architecture details
- See [schema.sql](schema.sql) for database schema

---

## ✨ Next Steps

1. **Configure Database**: Update `DATABASE_URL` in `.env`
2. **Add Supabase Credentials**: Set `SUPABASE_URL` and keys
3. **Deploy Backend**: Push to Railway or Render
4. **Deploy Frontend**: Push to Vercel or Netlify
5. **Setup CI/CD**: Configure GitHub Actions

---

**Last Updated**: 28 May 2026  
**Status**: ✅ Integration Complete
