# ClimaLogix AI (ClimateShield) — System Architecture

> **Audience:** Developers and AI agents who need to understand, evaluate, or improve the system.
> This document covers the actual implemented architecture, data flows, service boundaries, and guidance for making targeted improvements.

---

## Table of Contents

- [System Overview](#system-overview)
- [Deployment Architecture](#deployment-architecture)
- [Directory Structure](#directory-structure)
- [Data Flow](#data-flow)
  - [Core Transaction Flow](#core-transaction-flow)
  - [QR Verification Flow](#qr-verification-flow)
  - [Voice Agent Flow](#voice-agent-flow)
- [Backend Architecture](#backend-architecture)
  - [Entry Point](#entry-point-express-appts)
  - [Route Inventory](#route-inventory)
  - [Service Layer](#service-layer)
  - [Middleware Stack](#middleware-stack)
- [Frontend Architecture](#frontend-architecture)
- [Database Schema](#database-schema)
- [External Integrations](#external-integrations)
- [Calculation Engines](#calculation-engines)
- [Current State vs. Target State](#current-state-vs-target-state)
- [Improvement Opportunities](#improvement-opportunities)
- [Agent Contribution Guide](#agent-contribution-guide)

---

## System Overview

ClimaLogix AI is a full-stack web platform consisting of:

- **Frontend:** Single-page React 18 application (CDN-loaded, no build step) served as static HTML
- **Backend:** Express.js 4 API server written in TypeScript, hosted on Render
- **Database:** Supabase PostgreSQL 17 with pgvector extension for vector similarity search
- **External APIs:** Groq (LLM), OpenWeather (weather data), ip-api.com (geolocation)

The system follows a layered architecture with 8 conceptual layers: Users, Authentication, Commerce, Product Trust, Climate Supply Chain, AI Decision, Execution, and Business Intelligence.

---

## Deployment Architecture

```
Internet
    │
    ├──► Frontend (Render Static)
    │     https://ecoweathersme.onrender.com
    │     Serves: Frontend and UI/index.html + assets
    │
    └──► Backend API (Render Node)
          https://backsme.onrender.com:5001
          │
          ├──► Supabase PostgreSQL + pgvector
          │     Tables (17) + RLS + 12 migrations
          │
          ├──► Groq API (llama-3 70B)
          │     RAG queries, intent classification, agent chat
          │
          ├──► OpenWeather API
          │     Real-time weather for 6 Dhaka zones
          │
          └──► ip-api.com
                Free geolocation lookup
```

### Infrastructure

| Component | Hosting | Scaling |
|-----------|---------|---------|
| Frontend | Render (static site) | CDN-cached, no server-side rendering |
| Backend | Render (web service) | Single instance, auto-restart on failure |
| Database | Supabase (managed Postgres) | Auto-scaling, connection pooling |
| Edge Functions | Supabase (Deno) | 3 functions: trust-score, ai-processing, climate-dvs |
| CI/CD | GitHub Actions | 2 workflows for frontend + Supabase deploy |

---

## Directory Structure

```
/
├── backend/                          # Express.js TypeScript backend
│   ├── src/
│   │   ├── app.ts                    # Entry point (880 lines) — mounts all routes
│   │   ├── api/
│   │   │   ├── routes/               # 17 route files
│   │   │   ├── controllers/          # ESG controller
│   │   │   ├── schemas.ts            # Zod validation schemas
│   │   │   └── schemas/              # Per-route Zod schemas
│   │   ├── lib/
│   │   │   ├── services/             # 17 domain services
│   │   │   ├── middleware/           # Rate limiter
│   │   │   ├── utils/                # Language normalizer, moderation, error helpers
│   │   │   ├── data/                 # Agronomy glossary
│   │   │   ├── knowledge/            # App help entries
│   │   │   ├── types.ts              # Shared domain types
│   │   │   ├── supabase.ts           # DB client singleton
│   │   │   └── groq.ts               # LLM client singleton
│   │   ├── middleware/               # Auth, role guard, AI cost shield
│   │   ├── adapters/carriers/        # Pathao + Redex delivery adapters
│   │   └── scripts/                  # BARI doc ingestion
│   ├── tests/                        # Integration tests
│   ├── migrations/                   # Database migrations
│   ├── Dockerfile
│   └── package.json
│
├── Frontend and UI/                  # React 18 SPA
│   ├── index.html                    # Main application (~7320 lines)
│   ├── api-integration.js            # API client wrapper
│   ├── supabaseClient.js             # Supabase frontend client
│   ├── AuthPanel.jsx                 # Auth UI component
│   ├── ThreeScene.js                 # 3D visualization
│   ├── components/
│   │   ├── AgentPanel/               # Voice agent UI
│   │   └── LanguageSelector/         # Language selector
│   └── lang/                         # i18n files
│
├── supabase/
│   ├── config.toml                   # Supabase project config
│   ├── migrations/                   # 12 migration files
│   └── functions/                    # 3 Deno edge functions
│
├── db/
│   ├── migrations/                   # Refresh tokens migration
│   └── seeds/                        # 4 seed SQL files
│
├── schema.sql                        # Master schema (17 tables, 287 lines)
├── docs/                             # Documentation
├── scripts/                          # Utility scripts
├── .github/workflows/                # CI/CD
└── docker-compose.yml                # Docker orchestration
```

---

## Data Flow

### Core Transaction Flow

```
1. SME registers a batch
   └─► POST /api/batches → inserts row in `batches` table

2. SME enters IoT sensor readings
   └─► POST /api/batch/trust-score
       ├─► trustScore.service.ts calculates category-aware score (0-100)
       └─► Returns score, grade (A/B/C/F), viability, breakdown

3. SME generates QR certificate
   └─► POST /api/batches/:id/certify
       ├─► provenance.service.ts builds SHA-256 hash chain
       ├─► QR code generated with tracking URL
       └─► Returns downloadable PDF with public verify URL

4. Buyer/SME checks dispatch viability
   └─► POST /api/climate/dvs
       ├─► merm.service.ts calculates zone-adjusted temperature (MERM)
       ├─► TST engine predicts survival time in minutes
       ├─► dvs.service.ts combines trust score (60%) + TST (40%)
       └─► Returns DVS score, approval status, recommendation

5. AI agent assists with decision
   └─► POST /api/agent/message
       ├─► intentClassifier identifies user intent
       ├─► rag.service.ts queries BARI knowledge base (pgvector)
       ├─► Groq LLM generates response with context
       └─► Returns natural language answer + suggested actions

6. Order is dispatched
   └─► POST /api/orders/:id/dispatch
       ├─► orderExecution.service.ts processes the dispatch
       ├─► provenance chain records the event
       └─► Notification sent if configured
```

### QR Verification Flow

```
SME certifies batch
    │
    ▼
QR generated with URL: {FRONTEND_URL}/?tab=tracking&batch={BCH-XXX}
    │
    ▼
Consumer scans QR code
    │
    ├─► GET /api/verify/:batch_id
    │     ├─► Returns trust score, grade, provenance chain
    │     ├─► Logs scan in `qr_scans` table (batch_id, user_agent, ip_hash)
    │     └─► Returns scanCount for analytics
    │
    └─► Frontend parses ?tab=tracking&batch={id}
          ├─► Switches to TrackingView component
          ├─► Fetches batch details + provenance chain + scan history
          └─► Renders journey bar: Registration → Certification → Provenance → Scan
```

### Voice Agent Flow

```
User speaks (Web Speech API / keyboard text input)
    │
    ▼
POST /api/agent/voice-message or /api/agent/message
    │
    ├─► language.service.ts detects Bangla/Banglish/English (franc-min)
    ├─► intentParser.service.ts extracts entities + intent
    │     (order_lookup, product_search, batch_status, general_qa, etc.)
    ├─► agentOrchestrator.service.ts (848 lines) dispatches to:
    │     ├─► rag.service.ts → pgvector similarity search → BARI docs
    │     ├─► orderExecution.service.ts → create/check orders
    │     ├─► productSearch.service.ts → catalog search
    │     └─► dvs.service.ts → delivery viability check
    ├─► Groq LLM generates response with context
    └─► Response returned as text + optional UI actions
```

---

## Backend Architecture

### Entry Point (`backend/src/app.ts`)

The Express server (880 lines) configures:
- **Port:** 5001 (configurable via `PORT` env)
- **Middleware order:** Helmet → Global rate limiter → JSON parser (1mb) → CORS → Logger (dev)
- **Routes:** 25+ route handlers mounted at `/api/`
- **Static serving:** None (frontend is separate)
- **Error handling:** Centralized error middleware at end of chain

### Route Inventory

All routes are mounted in `app.ts` via `app.use('/api/...', router)`. Here is the complete inventory:

| # | Mount Point | Route File | Description |
|---|-------------|------------|-------------|
| 1 | `/api/health` | inline | Health check with DB ping, CORS test, environment info |
| 2 | `/api/dashboard` | inline | Dashboard aggregation: weather, stats, zone data |
| 3 | `/api/test-db` | inline | Database connectivity test |
| 4 | `/api/config` | inline | Exposes SUPABASE_URL + anon key to frontend |
| 5 | `/api/geocode` | inline | IP-based geolocation with zone fallback |
| 6 | `/api/clever-responder` | inline | Legacy endpoint (trust-score + microclimate-metrics) |
| 7 | `/api/calculate-trust-score` | inline | Legacy trust score (pre-v2) |
| 8 | `/api/zones` | inline | Static zone configuration data |
| 9 | `/api/demand-forecast` | inline | Mock demand forecast data |
| 10 | `/api/users` | inline | Legacy user stubs (DB-required) |
| 11 | `/api/weather` | inline | Weather by lat/lon coordinates |
| 12 | `/api/language` | `routes/language.ts` | Language detection |
| 13 | `/api/trust-score` | `api/routes/trustScore.route.ts` | Category-aware trust score v2 |
| 14 | `/api/climate/dvs` | `api/routes/climateDVS.route.ts` | Delivery Viability Score |
| 15 | `/api/ai/recommend` | `api/routes/aiRecommend.route.ts` | AI RAG recommendations |
| 16 | `/api/agent` | `api/routes/agent.route.ts` | Voice/text agent + commerce |
| 17 | `/api/ai/chat` | `api/routes/aiChat.route.ts` | AI chat endpoint |
| 18 | `/api/batches` | `api/routes/batch.route.ts` | Batch CRUD + certify + QR + scans |
| 19 | `/api/orders` | `api/routes/order.route.ts` | Order dispatch/receipt/tracking |
| 20 | `/api/verify` | `api/routes/verify.route.ts` | Public verification + scan logging |
| 21 | `/api/esg` | `api/routes/esg.route.ts` | ESG metrics |
| 22 | `/api/esg/report` | `api/routes/esgReport.route.ts` | ESG reports |
| 23 | `/api/qa` | `api/routes/qa.route.ts` | QA report ingestion |
| 24 | `/api/checkout` | `api/routes/checkout.route.ts` | Checkout |
| 25 | `/api/spot-pricing` | `api/routes/spotPricing.route.ts` | Dynamic clearance pricing |
| 26 | `/api/bi` | `api/routes/bi.route.ts` | Business intelligence aggregation |
| 27 | `/api/notifications` | `api/routes/notifications.route.ts` | Real-time notifications |
| 28 | `/api/ai/cost-report` | `api/routes/aiCostReport.route.ts` | AI budget/cost usage |
| 29 | `/api/route/optimize` | `api/routes/routeOptimize.route.ts` | Route optimization |

### Service Layer (17 services in `backend/src/lib/services/`)

| Service | File | Responsibility |
|---------|------|----------------|
| **agentOrchestrator** | `agentOrchestrator.service.ts` | Main agent dispatch (848 lines) — intent routing, response generation |
| **batchStore** | `batchStore.service.ts` | In-memory batch storage (dev/testing only) |
| **chatSession** | `chatSession.service.ts` | Chat session management |
| **dvs** | `dvs.service.ts` | Delivery Viability Score calculation |
| **esg** | `esg.service.ts` | ESG metrics computation |
| **geolocation** | `geolocation.service.ts` | IP-based city detection |
| **intentClassifier** | `intentClassifier.service.ts` | User intent classification |
| **intentParser** | `intentParser.service.ts` | Entity + intent extraction from text |
| **language** | `language.service.ts` | Language detection (franc-min) |
| **merm** | `merm.service.ts` | Microclimate Exposure Risk Model (192 lines) |
| **notification** | `notification.service.ts` | Real-time notification dispatch |
| **orderExecution** | `orderExecution.service.ts` | Order lifecycle processing |
| **orderLifecycleLog** | `orderLifecycleLog.service.ts` | Order event logging |
| **productSearch** | `productSearch.service.ts` | Product catalog search |
| **provenance** | `provenance.service.ts` | SHA-256 hash chain for tamper detection |
| **qaIngestion** | `qaIngestion.service.ts` | QA report processing |
| **rag** | `rag.service.ts` | RAG query pipeline (320 lines) |
| **routeOptimizer** | `routeOptimizer.service.ts` | Delivery route planning |
| **standardsRegistry** | `standardsRegistry.service.ts` | BARI product standards |
| **trustScore** | `trustScore.service.ts` | Category-aware trust score (177 lines) |
| **weather** | `weather.service.ts` | OpenWeather API wrapper |

### Middleware Stack

| Middleware | File | Purpose |
|------------|------|---------|
| **Helmet** | npm package | Security headers |
| **Rate Limiter (global)** | `lib/middleware/rateLimiter.ts` | 100 requests per 15 minutes per IP |
| **JSON Parser** | express.json() | 1mb body limit |
| **CORS** | npm package | Multiple origins including `*.onrender.com` |
| **Request Logger** | inline | Console logging in dev mode only |
| **JWT Auth** | `middleware/authenticateJWT.ts` | Supabase JWT verification, mock user in dev |
| **Role Guard** | `middleware/roleGuard.ts` | Role-based access control |
| **AI CostShield** | `middleware/aiCostShield.ts` | AI call budget (50 calls/15min/IP), token tracking |
| **Rate Limiter (AI)** | `lib/middleware/rateLimiter.ts` | 20 requests per 15 minutes for AI endpoints |

---

## Frontend Architecture

The frontend is a single-page application built with React 18 loaded via CDN (no build tooling). All code is inline in `Frontend and UI/index.html` (~7320 lines).

### View Components (all in index.html)

| View | Selector | Dependencies |
|------|----------|--------------|
| `DashboardView` | Main dashboard | Weather, batches, stats, activity feed |
| `BatchRegistryView` | Batch management | Batch CRUD, filters, search |
| `IoTForm` | IoT sensor input | pH, EC, temp, EM-1 ratio, fermentation days sliders |
| `BusinessIntelligenceView` | ESG + analytics | `/api/bi` endpoint |
| `MarketplaceView` | Product catalog | Batches listing |
| `TrackingView` | Source-to-consumer tracking | QR scan history, provenance chain |
| `AgentChatView` | Voice/text AI agent | Web Speech API, Groq LLM |
| `ZoneClimateView` | Microclimate analysis | MERM data, zone maps |
| `SettingsView` | User settings | Auth, preferences |
| `DocsView` | Documentation viewer | Markdown rendering |

### Key Files

| File | Size | Purpose |
|------|------|---------|
| `index.html` | ~7320 lines | Entire SPA — all views, state management, routing |
| `api-integration.js` | 251 lines | `APIClient` class wrapping all backend endpoints |
| `climalogix_dashboard.jsx` | ~500 lines | Alternative dashboard component |
| `AuthPanel.jsx` | ~200 lines | Auth UI (login, signup, profile) |
| `supabaseClient.js` | ~50 lines | Supabase frontend client initialization |

### State Management

- React `useState` / `useEffect` hooks (no Redux or Context API)
- State lifted to top-level `App` component, passed as props to views
- Global `window.__QR_PRODUCT__` for QR deep-link communication between views
- URL query parameter parsing (`?tab=`, `?batch=`) for deep linking

### Voice Agent (Web Speech API)

```javascript
const recognition = new webkitSpeechRecognition();
recognition.lang = 'bn-BD';  // Bangla (Bangladesh)
recognition.continuous = false;
recognition.interimResults = false;
```

The voice agent supports:
- Bangla, English, and Banglish (mixed Bangla-English)
- Product search ("খামার দেখাও" / "show farms")
- Batch status ("ব্যাচ BCH-001 এর অবস্থা কী?" / "what is the status of batch BCH-001?")
- Order placement ("২ ব্যাগ বায়োচার অর্ডার করি" / "order 2 bags of biochar")
- Delivery viability ("ঢাকায় ডেলিভারি দেওয়া যাবে?" / "can it be delivered in Dhaka?")

---

## Database Schema

### Tables (17 total)

**Core Business Tables:**
- `users` — Multi-tenant user accounts (roles: processor, buyer, admin, producer, consumer, sme_owner)
- `batches` — Organic material batch registry (status lifecycle: pending → active → certified → dispatched → delivered)
- `iot_readings` — Live IoT sensor intake (pH, EC, temperature, em1_ratio, fermentation_days)
- `products` — Marketplace product listing (price, trust_score, dvs)
- `orders` — Platform orders (status: pending → processing → completed → canceled)
- `refresh_tokens` — JWT token rotation

**Intelligence Tables:**
- `zone_microclimate_profiles` — Zone configs (uhi_offset, building_density, vegetation, wind, thermal_mass)
- `zone_hazard_profiles` — Live hazard data (hazard_class, hazard_multiplier, base_survival_multiplier)
- `microclimate_readings` — Calculated readings (zone, adjusted_temp, thermal_risk)
- `trust_score_logs` — Trust score audit trail
- `dvs_logs` — DVS calculation audit
- `dispatch_exposure_logs` — Dispatch tracking
- `dispatch_schedules` — Dispatch scheduler

**AI & Analytics Tables:**
- `esg_reports` — Monthly ESG metrics
- `esg_metrics` — Granular ESG audit data
- `compliance_knowledge_base` — pgvector vector store for BARI standards (1536-dim embeddings)
- `bari_knowledge_chunks` — Text search knowledge base
- `rag_query_logs` — RAG query audit trail
- `agent_interaction_logs` — Chatbot interaction history
- `community_observations` — Crowd-sourced microclimate data

**QR & Verification Tables:**
- `qr_scans` — Consumer scan analytics (batch_id, user_agent, ip_hash, scanned_at)

### Key Relationships

```
users (1) ──< batches (N)       // processor_id FK
batches (1) ──< iot_readings (N) // batch_id FK
batches (1) ──< products (N)     // batch_id FK
products (1) ──< orders (N)      // product_id FK
batches (1) ──< qr_scans (N)     // batch_id FK
```

### Security

- Row-Level Security (RLS) enabled on `batches`, `iot_readings`, `orders`
- Public read policy for active batches
- 7 database indexes for query performance
- TODO: Add processor-scoped RLS policy (`CREATE POLICY "SME owner select own batches" ON batches FOR SELECT USING (auth.uid() = processor_id)`)

---

## External Integrations

| Service | Library/API | Usage | Rate Limit |
|---------|-------------|-------|------------|
| OpenWeather | REST API (`api.openweathermap.org`) | Real-time weather for 6 Dhaka zones | Free tier: 60 calls/min |
| Groq | `groq-sdk` npm package | LLM inference (llama-3 70B) | Free tier: 30 calls/min |
| ip-api.com | REST API (`ip-api.com/json`) | IP-based geolocation | Free tier: 45 calls/min |
| Supabase | `@supabase/supabase-js` | Database, auth, storage | Per plan |
| Pathao | REST API adapter | Delivery partner integration | Per agreement |
| Redex | REST API adapter | Delivery partner integration | Per agreement |

---

## Calculation Engines

### 1. MERM (Microclimate Exposure Risk Model)

**File:** `backend/src/lib/services/merm.service.ts`

Calculates adjusted temperature for a given zone:

```
T_adjusted = T_base + (UHI_Offset × Solar_Factor) - W_cooling
```

- 50+ Dhaka zones with static profiles
- Zone attributes: UHI offset, hazard class (MODERATE/HIGH/CRITICAL), solar coefficient, vegetation fraction
- Outputs: adjusted temp, thermal risk level, dispatch safety window

### 2. TST (Thermal Survival Time)

Calculated within MERM service:

```
TST = 480 - (effectiveTemp - 30) × 18
```

- Base survival: 480 minutes (8 hours) at 30°C
- Each degree above 30°C reduces survival by 18 minutes
- Floor: 10 minutes minimum
- Used by DVS and spot pricing

### 3. Trust Score Engine

**File:** `backend/src/lib/services/trustScore.service.ts`

Category-aware scoring for 5 product categories:
- `organic`, `retail`, `pharma`, `dairy`, `manufacturing`

Each of 5 parameters (pH, EC, temperature, EM-1 ratio, fermentation days):
1. Normalized to 0-1 sub-score based on BARI ideal ranges
2. Weighted sum using per-category weights
3. Mapped to grade: A (≥80), B (≥60), C (≥40), F (<40)

### 4. DVS (Delivery Viability Score)

**File:** `backend/src/lib/services/dvs.service.ts`

```
DVS = (trustScore × 0.6) + (normalizedTST × 0.4)
```

- Threshold: ≥ 60 → delivery approved
- Generates recommendations based on score range

### 5. ESG Calculator

**File:** `backend/src/lib/services/esg.service.ts`

- Plastic PET offsets (kg) from bulk refill containers
- Carbon sequestration (CO₂e) from pyrolysis modeling
- Prevented spoilage savings (BDT) from smart-dispatch compliance
- Monthly aggregation into ESG reports

---

## Current State vs. Target State

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| **Auth** | JWT middleware exists but not enforced on all routes | Full role-based access on every route |
| **Frontend** | Monolithic 7320-line HTML with inline React | Modular React components with build tooling |
| **Tests** | 1 integration test + 1 smoke test shell script | Comprehensive unit + integration + E2E tests |
| **AI Cost Tracking** | Basic in-memory guard (50 calls/15min) | Persistent AI usage logs, budget policies, ROI tracking |
| **Delivery States** | Ad hoc status strings | Standardized state machine: draft → verified → climate_checked → recommended → confirmed → dispatched → delivered → received |
| **Multi-Tenancy** | None (single-tenant) | Company/tenant IDs on all records |
| **Observability** | Console.log in dev mode | Request IDs, structured logging, error tracking |
| **Audit Logging** | None | Audit log for all sensitive operations |
| **Edge Computing** | None planned | ESP32 offline trust scoring |
| **Cold Chain** | Pathao/Redex adapter stubs | Full reefer van booking API integration |
| **Data Quality** | Manual entry via forms | Automated IoT device ingestion |

---

## Improvement Opportunities

### High Priority (for production hardening)

1. **Enforce JWT authentication on all routes**
   - Search for `TODO` comments in route files
   - Affected: `batch.route.ts`, `agent.route.ts`, `spotPricing.route.ts`
   - Apply `authenticateJWT` middleware consistently

2. **Add AI CostShield as a proper service**
   - Create `backend/src/lib/services/aiCostShield.service.ts`
   - Create `backend/src/api/routes/aiCostShield.route.ts`
   - Add Supabase tables: `ai_usage_logs`, `ai_budget_policies`, `ai_value_outcomes`

3. **Standardize delivery state transitions**
   - Define enum for delivery states
   - Enforce valid transitions in `orderExecution.service.ts`
   - Add validation in route layer

4. **Add audit logging**
   - Log batch verification events
   - Log dispatch confirmations
   - Log AI calls with user context

5. **Add multi-tenant support**
   - Add `company_id` / `tenant_id` to `batches`, `orders`, `products`, `iot_readings`
   - Update RLS policies to scope by tenant
   - Update JWT to include tenant context

### Medium Priority

6. **Improve test coverage**
   - Unit tests for all 21 services
   - Integration tests for all 25+ routes
   - API contract tests for frontend compatibility

7. **Add observability**
   - Request ID middleware (correlation IDs)
   - Structured JSON logging
   - Error tracking integration (Sentry or similar)

8. **Frontend modularization**
   - Extract view components into separate files
   - Add proper React build tooling (Vite or Create React App)
   - Add TypeScript to frontend

9. **Standardize error responses**
   - All endpoints should return consistent `{error: string, code: string, details?: any}` shape
   - Remove inline error handling in favor of error middleware

### Low Priority (Future)

10. **Edge computing for offline scenarios**
    - Port trust score formula to C++ for ESP32
    - Add offline data sync when connectivity returns

11. **Cold chain logistics integration**
    - Full Pathao/Paperfly API integration with reefer van booking
    - Real-time delivery tracking webhooks

12. **Advanced analytics**
    - ML-based demand forecasting (replace mock data)
    - Predictive spoilage modeling
    - Anomaly detection in IoT readings

---

## Agent Contribution Guide

### How to Onboard

1. Read this architecture document
2. Read `backend/src/app.ts` (entry point — see how routes are mounted)
3. Read `backend/src/lib/types.ts` (shared types)
4. Read one route file (e.g., `trustScore.route.ts`) and its corresponding service (`trustScore.service.ts`)
5. Read the frontend API client (`api-integration.js`) to understand the frontend-backend contract
6. Read `schema.sql` to understand the database model

### How to Debug a Bug

1. Check if the route is mounted in `app.ts` (missing mount is the most common bug)
2. Check for silent `catch` blocks that swallow errors
3. Check for hardcoded URLs instead of env vars
4. Check for missing Zod validation in route parameters
5. Run `cd backend && npx tsc --noEmit` for type errors
6. Test the endpoint directly: `curl https://backsme.onrender.com/api/...`

### How to Add a New Feature

1. Create route file in `backend/src/api/routes/` with Zod validation
2. Create service file in `backend/src/lib/services/` with pure business logic
3. Mount route in `backend/src/app.ts` with `app.use('/api/...', router)`
4. Add API client method in `Frontend and UI/api-integration.js`
5. Add database migration in `supabase/migrations/` if needed
6. Verify: `cd backend && npx tsc --noEmit`
7. Verify: Manually test the endpoint

### Code Conventions

- **Services** are stateless (no class instances) — export pure functions
- **Routes** handle HTTP concerns only — delegate logic to services
- **Zod** for request validation — schema defined at top of route file
- **Error handling** — throw with meaningful messages, no silent catch blocks
- **Env vars** — always use `process.env` with fallback defaults
- **Graceful degradation** — when external dependencies fail, return fallback data with a `source` indicator

### Known Issue Patterns

| Pattern | Example | How to Fix |
|---------|---------|------------|
| Silent catch blocks | Weather fallback returned random temp | Log the error, propagate meaningful fallback |
| Hardcoded URLs | QR domain set to `climalogix.build` | Use `process.env.FRONTEND_URL` |
| Missing route mount | New route file created but not imported in `app.ts` | Add `app.use()` in `app.ts` |
| In-memory state | `batchStore.service.ts` | Replace with Supabase queries for persistence |
| Missing auth middleware | Batch routes commented with "TODO: add JWT" | Apply `authenticateJWT` middleware |
| Single file fragility | 7320-line `index.html` | Extract components, use unique anchors for edits |

### Testing Checklist

After any change:
- [ ] `cd backend && npx tsc --noEmit` — TypeScript compiles
- [ ] `npm run test:math` — Math engines produce correct results
- [ ] Backend starts without errors: `cd backend && npm run dev`
- [ ] Frontend loads without console errors
- [ ] Affected API endpoints return expected JSON
- [ ] Graceful degradation works when external APIs are unavailable
