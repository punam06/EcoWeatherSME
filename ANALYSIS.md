# ClimaLogix AI (ClimateShield / EcoWeatherSME) — Full Project Analysis

## 1. Project Overview

ClimaLogix AI is a **production-ready circular commerce marketplace and decision-intelligence platform** for Bangladesh's heat-sensitive SME product sectors. It combines IoT sensor analytics, neighborhood-specific microclimate modeling (MERM), and a voice-first Bangla RAG assistant to prevent heat-induced transit spoilage and bridge the trust deficit in supply chains.

**The core problem:** In Bangladesh's organic fertilizer sector (BDT 800 Crore annually), less than 3% of products carry verifiable certification. Summer Urban Heat Island (UHI) spikes exceeding 36°C cause up to 40% active compound degradation during transport.

**Three pillars of the solution:**
1. **Verify Batch Quality** at production via IoT parameters (pH, EC, Temp, Fermentation days) mapped to official BARI benchmarks
2. **Verify Transit Viability** at dispatch via the Microclimate Exposure Risk Model (MERM) predicting Thermal Survival Time (TST)
3. **Overcome Adoption Barriers** through a speech-enabled, natural Bangla RAG interface for semi-literate operators

---

## 2. System Architecture

### High-Level Component Map

```
┌─────────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│   Browser (React 18)│────▶│  Express API (port 5001) │────▶│  Supabase PostgreSQL │
│   CDN-loaded SPA    │◀────│  TypeScript 6.0         │◀────│  + pgvector          │
│   No build step     │     │  backend/src/app.ts     │     │  17 tables           │
└─────────────────────┘     └──────────┬──────────────┘     └──────────────────────┘
                                       │
                              ┌────────┴────────┐
                              │  External APIs   │
                              │  OpenWeather     │
                              │  Groq LLM        │
                              │  ip-api.com      │
                              └─────────────────┘
```

### Layer Architecture

The platform is divided into five vertical layers:

| Layer | Responsibility | Key Files |
|-------|---------------|-----------|
| **Commerce Layer** | Marketplace, orders, checkout, spot pricing | `order.route.ts`, `checkout.route.ts`, `spotPricing.route.ts` |
| **Product Trust Layer** | Batch registration, IoT/QA, Trust Score, QR certificates | `trustScore.service.ts`, `qaIngestion.service.ts`, `standardsRegistry.service.ts` |
| **Climate Chain Layer** | Weather, MERM, DVS, route risk | `merm.service.ts`, `dvs.service.ts`, `weather.service.ts`, `routeOptimizer.service.ts` |
| **AI Decision Layer** | RAG agent, recommendations, CostShield, intent classification | `agentOrchestrator.service.ts`, `rag.service.ts`, `intentClassifier.service.ts` |
| **Execution Layer** | Dispatch, confirm, delivery, receipt | `orderExecution.service.ts`, `deliveries.route.ts` |
| **Business Intelligence** | ESG metrics, analytics, AI ROI | `esg.service.ts`, `bi.route.ts`, `aiCostReport.route.ts` |

### Cross-Cutting Concerns

- **Auth/Access Control:** JWT via Supabase Auth + Argon2. Middleware in `backend/src/middleware/authenticateJWT.ts` (authenticateJWT, optionalJWT, requireRole). **Not enforced on most routes** — batch, spotPricing, agent routes have TODOs and fall back to in-memory mock user in development.
- **Rate Limiting:** Global 100 req/15min (`globalRateLimiter`), AI routes get strict 30 req/min (`strictAiRateLimiter`) + per-IP budget of 50 calls/15min (`aiCostShield(50)`).
- **CORS:** Allows localhost, `*.onrender.com`, Vercel, and all origins in `NODE_ENV=development`.

---

## 3. Core Domain Engines (The Math)

These are the pure computational engines — deterministic, stateless, and tested.

### 3.1 MERM — Microclimate Exposure Risk Model

**Purpose:** Predicts how hot a delivery zone will feel based on Urban Heat Island (UHI) offsets, solar loading, and wind cooling.

**Location:** `backend/src/lib/services/merm.service.ts` (also duplicated logic inline in `app.ts` clever-responder endpoint)

**Algorithm:**
```
adjustedTemp = ambientTemp + zone.uhiOffset
solarLoadFactor = 1 + (zone.solarCoefficient - 1) * sin(π * solarScale / 12)
effectiveTemp = adjustedTemp * solarLoadFactor
tstMinutes = max(0, 480 - (effectiveTemp - 30) * 18)
```

**Zone Registry:** Static in-memory dictionary of 50+ Dhaka neighborhoods with three hazard classes:
- **CRITICAL** (Old Dhaka, Motijheel): UHI offset 3.0–3.5, solar coefficient 1.18–1.23
- **HIGH** (Mirpur, Mohammadpur, Savar): UHI offset 2.0–2.9, solar coefficient 1.13–1.18
- **MODERATE** (Gulshan, Banani, Uttara): UHI offset 0.8–1.7, solar coefficient 1.05–1.12

**Output:** `TST minutes`, effective temperature, exposure risk level (LOW/MEDIUM/HIGH/EXTREME), dispatch window recommendation.

### 3.2 TST — Thermal Survival Time

**Purpose:** Predicts how many minutes a product batch can survive in-transit before quality degrades unacceptably.

**Two implementations exist:**
1. **MERM-based** (`merm.service.ts`): Pure function of ambient temperature + zone profile + solar hour
2. **Clever-Responder** (inline in `app.ts` ~line 700): Factors in trust score, packaging type, route duration

### 3.3 Trust Score Engine (Category-Aware)

**Purpose:** Scores product quality (0–100) from IoT sensor readings against BARI/BSTI/DGDA regulatory standards.

**Location:** `backend/src/lib/services/trustScore.service.ts`

**Algorithm:** Five sub-scores (pH, EC, temp, microbial ratio, fermentation days), each normalized 0–1 based on distance from optimal range defined in `standardsRegistry.service.ts`. Weighted sum → score → grade (A≥85, B≥70, C≥55, F<55).

**Five product categories:**
| Category | Key Standards | BSTI Required |
|----------|--------------|---------------|
| `organic` | pH 6.5–7.5, EC 1.5–3.5, temp 25–35°C | No |
| `retail` | pH 5.0–8.0, EC 0.5–2.0, temp 15–30°C | No |
| `pharma` | pH 5.5–7.5, EC 0.1–1.0, temp 2–8°C | Yes |
| `dairy` | pH 6.4–6.8, EC 2.0–5.0, temp 0–4°C | Yes |
| `manufacturing` | pH 5.5–8.5, EC 0.5–3.0, temp 10–40°C | No |

### 3.4 DVS — Delivery Viability Score

**Purpose:** Combines Trust Score (60% weight) and climate/TST (40% weight) into a single dispatch recommendation.

**Formula:** `DVS = (trustScore × 0.6) + (tstMinutes / 480 × 100 × 0.4)`

**Threshold:** DVS ≥ 60 → delivery approved. Also produces human-readable dispatch advice.

### 3.5 ESG Engine

**Purpose:** Calculates environmental impact metrics — plastic offset (each batch saves ~240g plastic), carbon sequestration (0.25 kg CO₂e per kg of product), spoilage prevented.

**Location:** `lib/services/esg.service.ts` (shared library) and `backend/src/lib/services/esg.service.ts`

---

## 4. Backend System

### 4.1 Entrypoint: `backend/src/app.ts`

This 939-line file is the Express server entrypoint. It:
1. Loads environment variables (backend/.env first, then root .env)
2. Checks required env vars (GROQ_API_KEY, OPENWEATHER_API_KEY — warns in dev, exits in prod)
3. Configures middleware stack: helmet → globalRateLimiter → JSON body parser → CORS → request logger
4. Mounts **all route modules** (every route must be explicitly registered here)
5. Defines inline endpoints: `/api/health`, `/api/config`, `/api/test-db`, `/api/dashboard`, `/api/geocode`, `/api/weather`, `/api/clever-responder`, `/api/zones`, `/api/demand-forecast`, `/api/calculate-trust-score`
6. Contains global error handler + 404 catch-all
7. Starts the server on PORT (default 5001)

### 4.2 Route Mounting Pattern

Every new route requires two steps:
1. Create file in `backend/src/api/routes/<name>.route.ts`
2. Register in `app.ts`: `app.use('/api/<path>', router)`

**Route groups and their middleware:**

| Base Path | Router File | Middleware |
|-----------|-------------|------------|
| `/api/batch/trust-score` | `trustScore.route.ts` | none |
| `/api/climate/dvs` | `climateDVS.route.ts` | none |
| `/api/ai/recommend` | `aiRecommend.route.ts` | strictAiRateLimiter, aiCostShield(50) |
| `/api/agent` | `agent.route.ts` | strictAiRateLimiter, aiCostShield(50) |
| `/api/ai/chat` | `aiChat.route.ts` | strictAiRateLimiter, aiCostShield(50) |
| `/api/ai/cost-report` | `aiCostReport.route.ts` | none |
| `/api/batches` | `batch.route.ts` | none (JWT TODO) |
| `/api/orders` | `order.route.ts` | authenticateJWT |
| `/api/spot-pricing` | `spotPricing.route.ts` | none (JWT TODO) |
| `/api/esg` | `esg.route.ts` | none |
| `/api/esg/report` | `esgReport.route.ts` | none |
| `/api/weather` | `weather.route.ts` | none |
| `/api/verify` | `verify.route.ts` | none |
| `/api/language` | `language.ts` (in `routes/`) | none |
| `/api/checkout` | `checkout.route.ts` | none |
| `/api/bi` | `bi.route.ts` | none |
| `/api/qa` | `qa.route.ts` | none |
| `/api/products` | `products.route.ts` | none |
| `/api/profile` | `profile.route.ts` | authenticateJWT |
| `/api/deliveries` | `deliveries.route.ts` | authenticateJWT |
| `/api/notifications` | `notifications.route.ts` | none |
| `/api/route` | `routeOptimize.route.ts` | none |
| `/api/zones` | inline in app.ts | none |

### 4.3 Backend Services

**21 services** in `backend/src/lib/services/`:

| Service | Purpose |
|---------|---------|
| `merm.service.ts` | MERM engine — zone profiles, TST calculation, exposure evaluation |
| `trustScore.service.ts` | Category-aware trust score calculation |
| `standardsRegistry.service.ts` | Product standards database for 5 categories |
| `dvs.service.ts` | Delivery Viability Score (combines trust + climate) |
| `esg.service.ts` | ESG metric calculations |
| `weather.service.ts` | OpenWeather API wrapper with caching |
| `rag.service.ts` | Groq-powered RAG grounded in BARI knowledge base |
| `agentOrchestrator.service.ts` | Multi-intent agent dispatcher (weather, navigate, order, product search, bari advice) — 848 lines |
| `chatSession.service.ts` | In-memory session management for agent conversations |
| `intentClassifier.service.ts` | NLP intent classification for agent queries |
| `intentParser.service.ts` | Parses structured intents from agent responses |
| `language.service.ts` | Language detection using franc-min |
| `orderExecution.service.ts` | Order lifecycle (initiate, confirm, dispatch, complete) |
| `orderLifecycleLog.service.ts` | Order event logging |
| `productSearch.service.ts` | Product search across marketplace |
| `qaIngestion.service.ts` | QA report ingestion with signature verification |
| `provenance.service.ts` | SHA-256 chain for batch lifecycle event tamper detection |
| `routeOptimizer.service.ts` | Delivery route planning with zone hazard awareness |
| `notification.service.ts` | Real-time notification generation |
| `geolocation.service.ts` | IP-based geolocation |
| `batchStore.service.ts` | In-memory batch CRUD store (dev only, lost on restart) |

### 4.4 Middleware Files

| Middleware | Location | Purpose |
|------------|----------|---------|
| `authenticateJWT.ts` | `backend/src/middleware/` | Supabase Auth JWT verification, role guard |
| `aiCostShield.ts` | `backend/src/middleware/` | Per-IP budget tracking for Groq API calls |
| `roleGuard.ts` | `backend/src/middleware/` | Role-based access control |
| `rateLimiter.ts` | `backend/src/lib/middleware/` | Global (100/15min), AI (20/15min), strict AI (30/min) rate limiters |
| `auth.middleware.ts` | `backend/src/lib/middleware/` | Additional auth middleware |

### 4.5 Adapters

| Adapter | Location | Purpose |
|---------|----------|---------|
| `pathao.adapter.ts` | `backend/src/adapters/carriers/` | Pathao delivery API integration stub |
| `redx.adapter.ts` | `backend/src/adapters/carriers/` | Redex delivery API integration stub |

---

## 5. Database Schema

### 17 Tables (defined in `schema.sql` + 12 Supabase migrations)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Authentication & roles | id, email, password_hash, role (processor/buyer/admin/producer/consumer) |
| `refresh_tokens` | JWT rotation | user_id, token_hash, expires_at |
| `batches` | Core product batches | processor_id, batch_number, feedstock_type, product_name, weight_kg, packaging_type, destination_zone, status, trust_score, certificate_url, qr_code_url |
| `iot_readings` | Sensor data per batch | batch_id, pH, EC, temperature, em1_ratio, fermentation_days |
| `zone_microclimate_profiles` | Static zone data | zone, uhi_offset, building_density, vegetation_fraction, wind_corridor_factor, thermal_mass_coefficient |
| `zone_hazard_profiles` | Hazard classifications | zone, hazard_class, hazard_multiplier, base_survival_multiplier |
| `microclimate_readings` | Calculated readings | zone, base_temp, wind_speed, solar_factor, adjusted_temp, thermal_risk |
| `community_observations` | Crowdsourced reports | observer_id, zone, reported_condition, validated |
| `products` | Marketplace listings | batch_id, name, description, price_bdt, quantity, trust_score, dvs |
| `orders` | Platform orders | buyer_id, product_id, quantity, total_bdt, status (pending/processing/completed/canceled) |
| `dispatch_exposure_logs` | Transit tracking | batch_id, zone, packaging_type, estimated_duration_minutes, calculated_survival_time_minutes, exposure_risk_level |
| `dispatch_schedules` | Schedule planner | batch_id, zone, dvs_score, recommended_window, risk_level, ai_advice |
| `esg_reports` | Monthly ESG reports | processor_id, month, spoilage_prevented_bdt, plastic_offset_kg, carbon_sequestered_kg |
| `esg_metrics` | Granular ESG data | processor_id, e_score, s_score, g_score, esg_score, plastic_offset_kg, carbon_sequestered_kg, water_saved_l, waste_reduced_kg, spoilage_prevented_bdt |
| `trust_score_logs` | Score calculation audit | pH, EC, temperature, em1_ratio, fermentation_days, score, grade, is_viable |
| `dvs_logs` | DVS calculation audit | zone, ambient_temperature, solar_hour, trust_score, dvs_score, delivery_approved, tst_minutes |
| `rag_query_logs` | AI query tracking | query, language, answer, tokens_used |
| `agent_interaction_logs` | Agent chat history | session_id, farmer_id, message, intent, response_type, language |
| `compliance_knowledge_base` | BARI vector embeddings | standard_name, document_chunk, embedding (vector(1536)) |
| `bari_knowledge_chunks` | BARI text knowledge | content, category |
| `qr_scans` | Consumer QR tracking | batch_id, user_agent, ip_hash, scanned_at |

**RLS enabled on:** batches, iot_readings, orders (but currently permissive — `Allow public read access to active batches` policy allows all SELECT).

---

## 6. Frontend

### 6.1 Structure

The frontend is a **React 18 SPA** with **no build step** — loaded directly as a single HTML file with CDN scripts:

`Frontend and UI/index.html` — ~9058 lines, ~7320 lines of inline JSX

**CDN dependencies loaded in-browser:**
- React 18 + ReactDOM (UMD builds)
- Babel standalone (compiles JSX at runtime)
- Chart.js (dashboard charts)
- Supabase JS client

**Supporting JS files (also loaded as scripts in the HTML):**
- `api-integration.js` — API client wrapper (251 lines)
- `api-client.js` — Additional API helpers
- `climalogix_dashboard.js` — Dashboard component logic
- `AuthPanel.js` / `AuthPanel.jsx` — Authentication UI
- `ErrorBoundary.jsx` — Error boundary component
- `ThreeScene.js` / `ThreeScene.compiled.js` — 3D visualizations
- `toast.js` — Notification toast component
- `supabaseClient.js` — Supabase client configuration
- `lang/` — Language/i18n support

**Authoring note:** JSX is compiled at build time via `scripts/compile-frontend.js` (uses Babel). The compiled output is what gets served. However, the CDN Babel standalone also compiles at runtime in development. This dual compilation pathway is fragile — edits must target the source `.jsx` files, not the compiled output.

### 6.2 Frontend Views (inferred from HTML structure)

The SPA implements a tab-based dashboard with views for:
- **Dashboard** — Stats, heatmap, recent activity
- **Batch Management** — Register, list, certify batches
- **IoT Sensor Entry** — Record pH, EC, temperature readings
- **Trust Score Calculator** — Interactive trust score form
- **Climate/DVS** — MERM zone map, DVS calculator
- **Marketplace** — Product listings, orders
- **ESG Dashboard** — Environmental metrics
- **AI Agent Chat** — Voice-first Bangla RAG assistant
- **QR Verification** — Public batch verification page
- **Admin/Settings** — User management, configuration

### 6.3 API Client Contract

All backend calls go through `Frontend and UI/api-integration.js`, which provides:
- `APIClient.request(endpoint, options)` — generic fetch wrapper with auth header injection
- Response envelope: `{success: boolean, data: any}` (some endpoints return flat payloads — handled via `unwrap()`)
- Auth token sourced from `window.SUPABASE_SESSION_TOKEN`

---

## 7. AI Integration

### 7.1 Groq LLM

**Client:** `backend/src/lib/groq.ts`
- SDK: `groq-sdk` v0.33.0
- Model: `llama-3.3-70b-versatile`
- Configured via `GROQ_API_KEY` env var

### 7.2 AI CostShield

**Purpose:** Prevent runaway API costs from Groq calls.

**Implementation:** `backend/src/middleware/aiCostShield.ts`
- Per-IP/user budget: default 50 calls per 15-minute window
- In-memory usage ledger (lost on restart)
- Tracks input/output tokens, estimates cost at $0.59/1M input, $0.79/1M output tokens
- Returns 429 with retry-after when budget exhausted
- Exposes `getUsageReport()` and `getAggregateStats()` for the cost report route

### 7.3 Agent Orchestrator

**Service:** `backend/src/lib/services/agentOrchestrator.service.ts` (848 lines)

**Purpose:** Multi-intent conversational agent that processes natural language queries (Bangla/Banglish/English) and dispatches to the appropriate handler.

**Supported intents:**
| Intent | Handler |
|--------|---------|
| `weather` | Current weather for a city |
| `order_product` | Search products + initiate order flow |
| `navigate` | Route/direction lookup |
| `bari_advice` | RAG-grounded BARI agronomy advice |
| `product_search` | Marketplace product search |
| `greeting` | Greeting response |
| `app_help` | App feature explanation |
| `product_explain` | Product details explanation |

**Flow:** User text → language detection (franc-min) → Groq intent classification → structured JSON output → intent handler → response formatting

### 7.4 RAG Service

**Service:** `backend/src/lib/services/rag.service.ts`

**Flow:** Query → normalize Banglish → Supabase text search on `bari_knowledge_chunks` (keyword fallback if no Supabase) → Groq generates answer grounded in BARI context → return with sources.

**Fallback:** 15 hardcoded BARI knowledge chunks covering pH, EC, temperature, fermentation, pathogen control, packaging, and storage standards.

---

## 8. Key Data Flows

### 8.1 Batch Registration → Certification → Dispatch Flow

```
1. SME Register Batch
   POST /api/batches  →  batches table  →  QR code generation
   
2. Record IoT Readings
   POST /api/batches/:id/readings  →  iot_readings table
   
3. Calculate Trust Score
   POST /api/batch/trust-score  →  trustScore.service  →  Grade A/B/C/F
   
4. Certify Batch
   POST /api/batches/certify  →  PDF certificate + QR URL generated
   
5. Check Climate Viability
   POST /api/climate/dvs  →  merm.service + dvs.service  →  DVS score
   
6. List in Marketplace
   products table listing  →  visible to buyers
   
7. Order → Dispatch → Deliver → Receipt
   POST /api/orders/:id/dispatch  →  orderExecution.service
   POST /api/orders/:id/receipt   →  orderLifecycleLog.service
   
8. Consumer Verification
   Scan QR → GET /api/verify/:batch_id  →  provenance chain
```

### 8.2 Voice RAG Flow

```
1. User speaks Bangla in browser
2. Web Speech API → text
3. POST /api/agent/voice-message  →  agent route
4. agentOrchestrator.service processes message:
   a. Detect language (franc-min)
   b. Normalize Banglish dialect
   c. Classify intent via Groq
   d. Execute intent handler:
      - BARI advice → rag.service (Supabase text search + Groq)
      - Weather → weather.service (OpenWeather + cache)
      - Order → orderExecution.service
      - Navigation → geolocation.service
   e. Format response
5. Response rendered in UI (text + optional action buttons)
```

### 8.3 Weather Data Flow

```
1. Request: GET /api/weather?lat=...&lon=...
2. Check 60s in-memory coordinate cache → return if fresh
3. If cache miss: call OpenWeather API
4. On success: cache response, return with `cached: false`
5. On 401 (invalid key): return time-of-day temperature estimate
6. On network error: return error response
7. Dashboard also has 5-min city-based weather cache
```

---

## 9. Development Workflow

### 9.1 Setup

```bash
git clone https://github.com/punam06/EcoWeatherSME.git
cd EcoWeatherSME
npm run setup          # npm install + cd backend && npm install
cp .env.template .env  # fill in credentials
npm run dev            # backend :5001 + frontend :3000
```

**Required env vars for full functionality:**
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (DB operations)
- `GROQ_API_KEY` (AI features)
- `OPENWEATHER_API_KEY` (live weather)

The app runs without Supabase or Groq — it degrades gracefully with demo/mock data, but many features require them.

### 9.2 Important Scripts

| Script | What It Does | Location |
|--------|-------------|----------|
| `npm run setup` | Install all dependencies | Root `package.json` |
| `npm run dev` | Start backend + frontend concurrently | Root `package.json` |
| `npm run build` | TypeScript compile + Babel frontend compile | Root `package.json` |
| `npm run test:math` | Run math engine tests (MERM, TST, ESG, Trust Score) | `scripts/test-math.ts` |
| `cd backend && npm test` | Run integration tests (order lifecycle) | `backend/tests/order.integration.test.ts` |
| `cd backend && npm run lint` | TypeScript type check (`tsc --noEmit --ignoreDeprecations 6.0`) | `backend/package.json` |
| `bash scripts/smoke-trust-layer-v2.sh` | Offline smoke test for Trust Layer v2 endpoints | `scripts/smoke-trust-layer-v2.sh` |
| `npm run db:seed:all` | Seed zones + users + batches + IoT readings | Root `package.json` |
| `npm run demo:microclimate` | Interactive MERM CLI demo | Root `package.json` |
| `cd backend && npm run dev:watch` | Backend with hot-reload via ts-node-dev | `backend/package.json` |

### 9.3 Verification Checklist

Before submitting changes, run:
1. `cd backend && npm run lint` — TypeScript type checking
2. `npm run test:math` — Core math engine correctness
3. `bash scripts/smoke-trust-layer-v2.sh` — API endpoint smoke tests

### 9.4 Testing Quirks

- **Frontend:** No test framework. Manual testing only.
- **Backend:** 1 integration test (`order.integration.test.ts`) covering order lifecycle with in-memory store.
- **Math:** `scripts/test-math.ts` runs as ts-node, no assertion framework — logs pass/fail to console.
- **Smoke:** `scripts/smoke-trust-layer-v2.sh` starts a real backend on port 4799, curls endpoints, asserts response shapes. Needs no Supabase/Groq — runs fully offline with demo data.

---

## 10. TypeScript Configuration (Dual System)

### Root `tsconfig.json` (node16 module)
- **Target:** `lib/` and `scripts/` — shared domain library
- **Module:** `node16`
- **OutDir:** `./dist`
- **Include:** `lib/**/*`, `scripts/**/*`
- Does NOT include backend code

### Backend `backend/tsconfig.json` (commonjs)
- **Target:** `backend/src/` — Express server
- **Module:** `commonjs`
- **OutDir:** `./dist`
- **Include:** `src/**/*`
- **Special flag:** `ignoreDeprecations: "6.0"` (needed by TypeScript 6.0)
- **Declaration files:** enabled

### Type System Divergence

There are **two partially overlapping type systems**:
1. `lib/types.ts` — Root shared types (older, simpler)
2. `backend/src/lib/types.ts` — Backend-specific types (newer, more detailed, Trust Layer v2)

Both define similar interfaces (`MicroclimateProfile`, `ESGMetrics`, `ProductCategory`, etc.) but with different structures. An agent must check which one a given file imports.

---

## 11. Database Migrations

**12 Supabase migrations** in `supabase/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `001_initial_schema.sql` | Core tables (users, batches, iot_readings, zones) |
| `002_pgvector_setup.sql` | Vector extension + compliance knowledge base |
| `004_orders_agent_log.sql` | Orders + agent interaction logs |
| `005_esg_metrics.sql` | ESG metrics table |
| `006_create_checkout_orders.sql` | Checkout flow tables |
| `007_create_orders.sql` | Orders refinement |
| `008_order_lifecycle_logs.sql` | Order lifecycle event logging |
| `009_trust_layer_v2.sql` | Category-aware trust scoring (new columns) |
| `010_qa_reports_column_alignment.sql` | QA report schema alignment |
| `011_provenance_event_types_alignment.sql` | Provenance event types standardization |
| `012_qr_scans.sql` | QR scan tracking table |
| `20260602194600_add_base_price_to_batches.sql` | Base price column for batches |

**Policy:** All database changes go through migrations — no raw SQL in production. The `schema.sql` at root is the master reference but migrations are the source of truth for the deployed database.

---

## 12. Supabase Edge Functions

3 Deno-based edge functions in `supabase/functions/`:

| Function | Purpose | Config |
|----------|---------|--------|
| `trust-score` | Serverless trust score calculation | verify_jwt = false |
| `ai-processing` | AI processing pipeline | verify_jwt = false |
| `climate-dvs` | DVS calculation | verify_jwt = false |

All share `supabase/functions/_shared/` for common utilities. Deployed via CI/CD workflow or manually with `supabase functions deploy <name>`.

---

## 13. CI/CD Pipeline

### `deploy-frontend.yml`
- **Trigger:** Push to `main` affecting `Frontend and UI/**`
- **Action:** Calls Render deploy API for the frontend service
- **Needs secrets:** `RENDER_API_KEY`, `RENDER_SERVICE_ID`

### `deploy-supabase.yml`
- **Trigger:** Push to `main` affecting `supabase/**`, `backend/**`, or `lib/**`
- **Action:** Deploys each edge function via Supabase CLI
- **Needs secrets:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
- Skips gracefully if secrets missing

### Infrastructure
- **Frontend hosting:** Render (static site) — `https://ecoweathersme.onrender.com`
- **Backend hosting:** Render (Node) — `https://backsme.onrender.com`
- **Database:** Supabase project `pdeskdcdyhbldwfgbowz`
- **Container:** Docker Compose available (`docker-compose up --build`) for local deployment with nginx frontend + Node backend

---

## 14. In-Memory State & Volatility

Several components use in-memory state that is **lost on server restart**:

| Component | What It Stores | TTL / Impact |
|-----------|---------------|--------------|
| `weatherCache` (app.ts) | Weather data keyed by city | 5 min TTL |
| `weatherByCoordsCache` (app.ts) | Weather data keyed by lat/lon | 60s TTL |
| `usageStore` (aiCostShield.ts) | AI call budget per IP/user | 15 min window |
| `batchStore.service.ts` | Batch CRUD operations | Dev only — not for production |
| `chatSession.service.ts` | Agent conversation sessions | Until server restart |

---

## 15. Known Issues & Gotchas

1. **JWT not enforced:** Batch, spotPricing, and agent routes have TODO comments for JWT middleware. In development, an in-memory mock user is used instead.

2. **Dual .env loading:** Backend loads `backend/.env` first, then `../../.env` (root). Backend values take precedence — this can cause confusion if the same variable is set in both.

3. **Frontend fragility:** Single 7320-line HTML file. No build step in development (Babel standalone compiles JSX in-browser). Production uses Babel pre-compilation. Editing requires finding unique anchors (component IDs, function names) to avoid breaking unrelated parts.

4. **Two type systems:** `lib/types.ts` and `backend/src/lib/types.ts` overlap partially but are not aligned. Always check which one a file imports.

5. **Error handling inconsistency:** Some routes return `{error: string}`, others use Zod validation errors, others throw HTTP errors via Express. No standardized error envelope across the API.

6. **OpenWeather rate limits:** Free tier is heavily rate-limited. The 5-min cache mitigates this for the dashboard, but the cache is in-memory per-server-instance.

7. **Tests are minimal:** 1 integration test, 1 smoke test script, 1 math test script. No unit tests for services, no frontend tests.

8. **Hardcoded URLs:** Some endpoints have hardcoded URLs (e.g., QR domain, zone fallback coordinates) instead of env vars.

9. **Code duplication:** The clever-responder endpoint in `app.ts` duplicates the MERM and Trust Score logic rather than importing from services.

10. **Missing routes registration hazard:** New routes will silently 404 if not registered in `app.ts` — this is the most common new-contributor mistake.

11. **Frontend CDN scripts:** The HTML loads React, Babel, Chart.js, and Supabase from CDNs. If these CDNs are unavailable or change URLs, the app breaks entirely.

12. **Legacy compatibility:** Multiple backward-compatible endpoints exist (`/api/calculate-trust-score`, `/api/clever-responder`) with duplicated logic.
