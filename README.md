# ClimaLogix AI (ClimateShield)

**Enterprise-Grade PaaS for Climate-Resilient Circular Commerce & Heat-Sensitive SME Logistics**

[![Live Demo](https://img.shields.io/badge/Live-Frontend-blue?style=flat-square)](https://ecoweathersme.onrender.com)
[![Backend](https://img.shields.io/badge/API-Backend-green?style=flat-square)](https://backsme.onrender.com)
[![Stack](https://img.shields.io/badge/Stack-Express%20%7C%20React%20%7C%20Supabase%20%7C%20Groq-ff69b4?style=flat-square)]()

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Development](#development)
- [Deployment](#deployment)
- [Project Status](#project-status)
- [For AI Agents — Improvement & Contribution Guide](#for-ai-agents--improvement--contribution-guide)
- [Team](#team)
- [License](#license)

---

## Overview

ClimaLogix AI (ClimateShield) is a production-ready circular commerce marketplace and decision-intelligence platform that protects Bangladesh's heat-sensitive SME product sectors. The platform combines IoT parameter analytics, neighborhood-specific microclimate modeling (MERM), and a voice-first Bangla RAG assistant to bridge the trust deficit in supply chains and prevent heat-induced transit spoilage.

**Bangladesh's Challenge:** In the organic fertilizer sector alone (valued at BDT 800 Crore annually), less than 3% of products carry verifiable certification. Summer Urban Heat Island (UHI) spikes exceeding 36°C cause up to 40% active compound degradation during transport.

**The Solution:**
1. **Verify Batch Quality** at production via IoT parameters (pH, EC, Temp, Fermentation days) mapped to official BARI benchmarks.
2. **Verify Transit Viability** at dispatch via the Microclimate Exposure Risk Model (MERM) predicting Thermal Survival Time (TST).
3. **Overcome Adoption Barriers** through a speech-enabled, natural Bangla RAG interface for semi-literate operators.

---

## Features

### Implemented (Production)

| Feature | Description | Status |
|---------|-------------|--------|
| **MERM Engine** | Microclimate Exposure Risk Model for 50+ Dhaka zones with UHI offsets, hazard classes, and solar coefficients | ✅ Live |
| **TST Calculator** | Thermal Survival Time prediction in minutes based on packaging, zone hazard, solar hour, and trust score | ✅ Live |
| **Trust Score Engine** | Category-aware scoring (0-100) for organic, retail, pharma, dairy, manufacturing using IoT sensor data vs BARI standards | ✅ Live |
| **Delivery Viability Score (DVS)** | Weighted combination of Trust Score (60%) and normalized TST (40%) with dispatch recommendations | ✅ Live |
| **IoT Sensor Ingestion** | pH, EC, temperature, EM-1 ratio, fermentation days input via forms | ✅ Live |
| **QR Certificate Generation** | Downloadable PDF certificates with public verification URLs showing unalterable production histories | ✅ Live |
| **QR Scan Tracking** | Consumer scan logging with batch_id, user_agent, IP hash, timestamps | ✅ Live |
| **Source-to-Consumer Tracking** | Full provenance chain from registration through certification to consumer scan | ✅ Live |
| **Voice-First Bangla RAG** | Browser speech portal translating natural spoken Bangla queries into LLM prompts grounded in BARI scientific guidelines | ✅ Live |
| **AI Agentic Commerce** | Voice/text agent for product search, order placement, and dispatch decisions | ✅ Live |
| **Business Intelligence** | ESG metrics, carbon sequestration, plastic offsets, spoilage prevented, trust score distribution | ✅ Live |
| **Dynamic Spot Pricing** | 10%/30% clearance pricing based on TST risk windows | ✅ Live |
| **Weather Integration** | Real-time OpenWeather data with 5-min cache, live/cache/fallback source tracking | ✅ Live |
| **Route Optimization** | Delivery route planning with zone hazard awareness | ✅ Live |
| **Provenance Chain** | SHA-256 hash chain for batch lifecycle event tamper detection | ✅ Live |
| **ESG Impact Tracker** | Monthly ESG reports with plastic PET offsets, carbon sequestration (CO₂e), prevented spoilage savings (BDT) | ✅ Live |
| **Authentication** | JWT-based auth with Argon2 password hashing and role-based access | ✅ Live |
| **Delivery Partner Adapters** | Pathao and Redex carrier API integration stubs | ✅ Live |
| **Language Detection** | Automatic Bangla/Banglish/English detection via franc-min | ✅ Live |
| **Rate Limiting & AI CostShield** | Global rate limiting (100/15min), AI budget guard (50 calls/15min/IP), token tracking | ✅ Live |

### Planned / In Progress

| Feature | Priority | Notes |
|---------|----------|-------|
| Supabase RLS policy for processor-only batch queries | Medium | Post-deployment; run `CREATE POLICY "SME owner select own batches" ON batches FOR SELECT USING (auth.uid() = processor_id)` |
| Multi-tenant support (tenant/company IDs) | High | Required for SaaS readiness; add `company_id` to major tables |
| Delivery state standardization | Medium | `draft -> verified -> climate_checked -> recommended -> confirmed -> dispatched -> delivered -> received` |
| AI CostShield service & route | High | Separate `aiCostShield.service.ts` for budget, token, ROI tracking |
| Audit logging for sensitive actions | High | Batch verification, dispatch confirmation, AI calls |
| Observability (request IDs, error tracking) | Medium | Structured logging, request tracing |
| Comprehensive test suite | High | Currently only 1 integration test + 1 smoke test |
| Frontend component modularization | Low | Monolithic 7320-line SPA — refactor into proper React components |
| Offline ESP32 trust scoring | Future | Edge computing for rural cellular blackouts |
| Cold-chain logistics integration | Future | Pathao/Paperfly reefer van booking API |

---

## Architecture

### System Context Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser     │────▶│  Express API     │────▶│  Supabase        │
│  (React SPA) │     │  (Port 5001)     │     │  PostgreSQL      │
│  CDN-loaded  │◀────│  TypeScript      │◀────│  + pgvector      │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │  External APIs  │
                    │  OpenWeather    │
                    │  Groq LLM       │
                    │  ip-api.com     │
                    └─────────────────┘
```

### Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Users & Actors                          │
│  SME Owner | Buyer | Warehouse | Delivery Partner | Admin │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│              Authentication & Access Control               │
│       JWT (Argon2) | Role Guard | Rate Limiter             │
└─────────────────────────┬────────────────────────────────┘
                          │
┌───────────┬─────────────┼─────────────┬───────────────────┐
│           │             │             │                   │
│  ┌────────▼───┐  ┌──────▼──────┐  ┌──▼──────────┐  ┌────▼───────────┐
│  │  Commerce  │  │Product Trust│  │Climate Chain│  │  AI Decision   │
│  │  Layer     │  │  Layer      │  │  Layer      │  │  Layer         │
│  │            │  │            │  │            │  │                │
│  │•Marketplace│  │•Batch Reg  │  │•Weather    │  │•RAG Agent      │
│  │•Orders     │  │•IoT/QA     │  │•MERM       │  │•Recommendation │
│  │•Checkout   │  │•Trust Score│  │•DVS        │  │•CostShield     │
│  │•Spot Pricing│  │•QR/Cert   │  │•Route Risk │  │•Intent Classify │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘
│           │             │             │                   │
│           └─────────────┼─────────────┼───────────────────┘
│                          │             │
│                 ┌────────▼─────────────▼──┐
│                 │    Execution Layer       │
│                 │  Dispatch | Confirm      │
│                 │  Delivery | Receipt      │
│                 └────────┬────────────────┘
│                          │
│                 ┌────────▼────────────────┐
│                 │ Business Intelligence    │
│                 │  ESG | Analytics | AI ROI│
│                 └─────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full architecture document with data flow diagrams, route inventory, service descriptions, and detailed guidance for AI agents.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 (CDN-loaded, no build step), Vanilla CSS, Chart.js, Web Speech API |
| **Backend** | Node.js, Express 4, TypeScript 6.0 |
| **Database** | Supabase (PostgreSQL 17 + pgvector) |
| **AI/LLM** | Groq SDK (llama-3 70B) |
| **Auth** | Argon2, JSON Web Tokens |
| **Security** | Helmet, CORS, express-rate-limit, Zod schemas |
| **Delivery** | Pathao API adapter, Redex API adapter |
| **Infrastructure** | Render (hosting), GitHub Actions (CI/CD), Docker |

---

## Quick Start

### Prerequisites

- Node.js v18+
- npm v9+
- Supabase project (free tier works)
- Groq API key (free)
- OpenWeather API key (free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/punam06/EcoWeatherSME.git
cd EcoWeatherSME

# Install all dependencies (root + backend)
npm run setup

# Configure environment
cp .env.template .env
# Edit .env with your credentials:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   GROQ_API_KEY
#   OPENWEATHER_API_KEY
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 5001) |
| `NODE_ENV` | No | `development` or `production` |
| `SUPABASE_URL` | **Yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key (server-side only) |
| `GROQ_API_KEY` | **Yes** | Groq LLM API key |
| `OPENWEATHER_API_KEY` | **Yes** | OpenWeather API key |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: `http://localhost:3000`) |
| `JWT_SECRET` | No | JWT signing secret (auto-generated if missing) |

---

## Development

### Start Backend + Frontend

```bash
npm run dev
```

This launches:
- **Express API** on `http://localhost:5001`
- **Frontend server** on `http://localhost:3000` (via Python HTTP server)

### Run Test Suite

```bash
# Core math engine verification (MERM, TST, ESG, Trust Score)
npm run test:math

# Backend integration tests
cd backend && npm test

# TypeScript type checking
cd backend && npm run lint
```

### Seed Database

```bash
# Seed zones, demo users, demo batches, demo IoT readings
npm run db:seed:all
```

### Key Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start full development environment |
| `npm run test:math` | Verify all calculation engines |
| `npm run demo:microclimate` | Run interactive microclimate CLI demo |
| `npm run seed:hazards` | Seed zone hazard profiles |
| `npm run seed:data` | Seed demonstration data |
| `cd backend && npm run dev` | Backend only (for API development) |

### API Endpoints

The backend exposes 25+ routes under `/api/`. Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with DB status |
| `/api/dashboard` | GET | Dashboard summary (weather + stats) |
| `/api/batches` | GET/POST | Batch CRUD |
| `/api/batches/:id/certify` | POST | Generate QR certificate |
| `/api/batches/:id/scans` | GET | QR scan history |
| `/api/batch/trust-score` | POST | Category-aware trust score |
| `/api/climate/dvs` | POST | Delivery Viability Score |
| `/api/weather` | GET | Weather by lat/lon |
| `/api/verify/:batch_id` | GET | Public batch verification |
| `/api/esg` | GET/POST | ESG metrics |
| `/api/bi` | GET | Business intelligence aggregation |
| `/api/ai/recommend` | POST | AI RAG recommendation |
| `/api/agent/message` | POST | Agent chat (text) |
| `/api/agent/voice-message` | POST | Agent chat (voice) |
| `/api/orders/:id/dispatch` | POST | Execute dispatch |
| `/api/spot-pricing/:batchId` | GET | Dynamic clearance pricing |
| `/api/route/optimize` | POST | Delivery route optimization |
| `/api/language/detect` | POST | Bangla/Banglish/English detection |
| `/api/notifications` | GET | Real-time notifications |

Full API documentation is available in [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

---

## Deployment

### Current Deployments

| Component | URL | Platform |
|-----------|-----|----------|
| Frontend | https://ecoweathersme.onrender.com | Render (static) |
| Backend API | https://backsme.onrender.com | Render (Node) |
| Database | Supabase project `pdeskdcdyhbldwfgbowz` | Supabase |

### CI/CD

Two GitHub Actions workflows handle deployments:

1. **`deploy-frontend.yml`** — Triggers on push to `main` affecting `Frontend and UI/**`. Calls Render deploy API.
2. **`deploy-supabase.yml`** — Triggers on push to `main` affecting `supabase/**`, `backend/**`, or `lib/**`. Deploys Supabase edge functions.

**Required GitHub Secrets:**
- `RENDER_API_KEY` — Render API token
- `RENDER_SERVICE_ID` — Render service identifier
- `SUPABASE_ACCESS_TOKEN` — Supabase personal access token
- `SUPABASE_PROJECT_REF` — Supabase project reference

See [DEPLOYMENT_NOTES.md](./DEPLOYMENT_NOTES.md) for detailed deployment instructions.

### Docker

```bash
docker-compose up --build
```

Runs both backend (port 5001) and frontend (port 3000) in containers.

---

## Project Status

### Current Phase: Late-stage pre-submission (Infinity AI BuildFest 2026)

**Completed:**
- ✅ All 5 production bugs resolved (see [SPEC.md](./SPEC.md))
- ✅ Core calculation engines (MERM, TST, Trust Score, DVS, ESG) verified
- ✅ QR tracking pipeline closed end-to-end
- ✅ BI dashboard live with real data
- ✅ Weather API with caching and graceful degradation
- ✅ Voice Bangla RAG agent functional
- ✅ 25+ API routes operational
- ✅ 17 database tables with migrations
- ✅ CI/CD pipeline configured
- ✅ Docker deployment ready

**Remaining:**
- [ ] Add JWT authentication middleware to batch routes (currently marked with TODOs)
- [ ] Run Supabase RLS policy for processor-scoped batch queries
- [ ] Implement AI CostShield service and route
- [ ] Standardize delivery state transitions
- [ ] Add comprehensive test coverage
- [ ] Add tenant/company IDs for multi-tenant readiness
- [ ] Add audit logging for sensitive operations
- [ ] Add observability (request IDs, structured logging)

See [ROADMAP.md](./ROADMAP.md) for the full development roadmap and future vision.

---

## For AI Agents — Improvement & Contribution Guide

This section helps AI coding agents understand the codebase to make targeted improvements, fix bugs, and evaluate system health.

### 📂 Key File Map

| Path | Purpose |
|------|---------|
| `backend/src/app.ts` | Express entrypoint — all routes mounted here |
| `backend/src/api/routes/*.ts` | API route handlers (25+ files) |
| `backend/src/lib/services/*.ts` | Domain services (21 files) |
| `backend/src/lib/middleware/*.ts` | Auth, rate limiting, role guard |
| `backend/src/lib/types.ts` | Shared TypeScript types |
| `backend/src/lib/supabase.ts` | Database client singleton |
| `backend/src/lib/groq.ts` | LLM client singleton |
| `Frontend and UI/index.html` | Main SPA (~7320 lines, React 18 inline JSX) |
| `Frontend and UI/api-integration.js` | API client wrapper |
| `schema.sql` | Master database schema (287 lines, 17 tables) |
| `supabase/migrations/` | Migration files (12 migrations) |
| `supabase/functions/` | Edge functions (trust-score, ai-processing, climate-dvs) |

### 🔍 Evaluating the System

**To check system health:**
```bash
# 1. Verify TypeScript compilation
cd backend && npx tsc --noEmit

# 2. Run math engine tests
npm run test:math

# 3. Check backend health
curl https://backsme.onrender.com/api/health

# 4. Run database smoke test
bash scripts/smoke-trust-layer-v2.sh
```

**Common bug patterns found in this codebase:**
- Silent error swallowing in catch blocks (e.g., weather fallback masked failure)
- Hardcoded URLs instead of env vars (e.g., QR domain hardcoded)
- Missing route registration in `app.ts` (new routes must be mounted explicitly)
- In-memory state that disappears on server restart
- Single monolithic frontend file with implicit component dependencies

### 🎯 Priority Improvement Areas (for agents)

1. **Authentication enforcement** — Routes `batch.route.ts`, `spotPricing.route.ts`, `agent.route.ts` have TODO comments to add JWT middleware. Search for `TODO` in the codebase.
2. **Test coverage** — Only 1 integration test exists in `backend/tests/`. The math engine has a script but no formal test framework.
3. **Type safety** — Some routes use `any` types. The `lib/types.ts` file has domain types that should be used consistently.
4. **Frontend modularization** — `index.html` at 7320 lines is fragile. Components (views) within it should be extracted.
5. **Error handling standardization** — Some endpoints return `{error: string}`, others throw HTTP errors. Inconsistent.
6. **Multi-tenant readiness** — No `company_id` or `tenant_id` on tables yet.
7. **Delivery state machine** — States are not standardized across order/dispatch flows.

### 📋 Checklist for New Features

When adding a feature, ensure these patterns are followed:
- [ ] Route file in `backend/src/api/routes/` with Zod validation schemas
- [ ] Service file in `backend/src/lib/services/` with pure business logic
- [ ] Route mounted in `backend/src/app.ts` with `app.use('/api/...', router)`
- [ ] API client method added to `Frontend and UI/api-integration.js`
- [ ] Database migration created in `supabase/migrations/` (not ad hoc SQL)
- [ ] TypeScript compiles cleanly (`cd backend && npx tsc --noEmit`)
- [ ] Error handling: no silent catch blocks, meaningful error messages
- [ ] Graceful degradation when dependencies (Supabase, Groq, OpenWeather) are unavailable

### Known Issues & Workarounds

| Issue | Workaround | Severity |
|-------|-----------|----------|
| OpenWeather free tier rate-limited | 5-min cache per city; stale data shown instead of errors | Low |
| JWT auth not enforced on batch routes | In-memory mock user in dev mode | Medium |
| Frontend is single HTML file (7320 lines) | Careful targeted edits with unique anchors; no full rewrites | Medium |
| Tests are minimal | Manual smoke testing via bash scripts | High |
| In-memory batch store (`batchStore.service.ts`) | Data lost on server restart; only for dev/testing | Low |

---

## Investor Demo: Batch Verification & QR Certification

Run the lifecycle migration before the demo:

```bash
supabase db push
# or paste db/migrations/002_batch_verification_lifecycle.sql into Supabase SQL editor
```

Optional large registry seed for pagination/search/filter demos:

```bash
psql "$DATABASE_URL" -f db/seeds/005_demo_verification_lifecycle.sql
```

Investor-scale demo seed for ClimaLogix AI / ClimateShield:

```bash
DATABASE_URL="postgresql://..." npm run seed:investor-demo
```

This creates a clearly synthetic dataset with `is_demo = true` wherever the table supports it: 100 demo manufacturers, 25 inspectors, 10 admins, 10,400 batches, 7,000 approved batches with QR URLs and `CLX-DEMO-CERT-*` certificate numbers, 50,000 QR scan logs, 20,000 IoT readings, 12,000 QA reports, provenance chains, verification requests, orders, ESG metrics, and workflow notifications.

Demo-only reset:

```bash
DEMO_SEED_ALLOW_RESET=true npm run seed:investor-demo:reset
```

Demo accounts all use `DemoPass123!` and are for local/demo environments only:

| Role | Email |
| --- | --- |
| Manufacturer | `manufacturer.demo@climalogix.test` |
| Inspector | `inspector.demo@climalogix.test` |
| Admin | `admin.demo@climalogix.test` |

Suggested investor journey:

1. Login as `manufacturer.demo@climalogix.test`.
2. Show the batch registry with thousands of paginated demo rows.
3. Register a new valid batch and show auto-evaluation passing.
4. Show the inspector request created.
5. Login as `inspector.demo@climalogix.test`.
6. Mark the batch received, then approve it.
7. Login as manufacturer again and download the QR.
8. Open `/api/verify/:batchId/page?hash=<current_provenance_hash>`.
9. Download `/api/verify/:batchId/certificate.pdf?hash=<current_provenance_hash>`.
10. Show dashboard charts, ESG metrics, QR scan analytics, rejected reason breakdown, and inspector workload.

Every official-looking demo ID is visibly marked with `DEMO`, for example `DEMO-BSTI-2026-0001`, `DEMO-BARI-EVAL-2026-0001`, and `CLX-DEMO-CERT-2026-000001`. These are synthetic records and are not official certificates, approvals, or government inspection records.

Backend checks:

```bash
cd backend
npm install
npm run build
npm run lint
npm test
npm run dev
```

Frontend demo:

```bash
cd "Frontend and UI"
npm install
npm run dev
```

Lifecycle to show:

1. Producer creates a batch. Valid BARI/BSTI inputs return `awaiting_shipment`; invalid inputs return `evaluation_failed` with field-level reasons and no inspector request.
2. Producer clicks `Send`, which creates a shipment token and moves the batch to `shipped`.
3. Inspector opens Verification Requests, clicks `Received`, completes the checklist, then approves or rejects.
4. Rejected batches show reason categories and never receive QR data.
5. Approved batches are locked, receive a certificate number, QR image, expiry date, and public URL.
6. Open `/api/verify/:batchId/page?hash=<current_provenance_hash>` for the public QR verification page.
7. Download `/api/verify/:batchId/certificate.pdf?hash=<current_provenance_hash>` for the generated live PDF certificate.

New lifecycle endpoints:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/batches` | POST | Create batch and run automated BARI/BSTI evaluation |
| `/api/batches` | GET | Paginated/searchable/filterable batch registry |
| `/api/batches/:id/ship` | POST | Manufacturer shipment handoff |
| `/api/verification-requests` | GET | Inspector inbox |
| `/api/verification-requests/:id/received` | POST | Inspector receipt |
| `/api/verification-requests/:id/verdict` | POST | Inspector approve/reject verdict |
| `/api/qr/:batchId` | GET | Approved QR image and verification URL |
| `/api/verify/:batchId` | GET | Public verification JSON |
| `/api/verify/:batchId/page` | GET | Mobile public verification page |
| `/api/verify/:batchId/certificate.pdf` | GET | On-demand PDF certificate |

---

## Team

| Name | Role | Contributions |
|------|------|-------------|
| **Umme Hani Punam** *(Lead)* | Microclimate Data Architect & UI Developer | MERM/TST engines, TypeScript interfaces, ESG calculator, test suites, frontend dashboard |
| **Zihad** | AI Integration & Backend Developer | Voice-to-Text Bangla LLM pipeline, backend microservices |
| **Orce** | UI/UX Designer | Circular SVG viability gauges, responsive layout, voice recorder animations |
| **Sabbir** | Database Architect & Cloud Ops | Supabase Vector DB, RLS policies, cloud deployments |

---

## References

- [Architecture Document](./docs/ARCHITECTURE.md) — Full system architecture, data flow, and agent guidance
- [Deployment Notes](./DEPLOYMENT_NOTES.md) — CI/CD setup and production change log
- [Integration Guide](./INTEGRATION_GUIDE.md) — Full-stack API integration reference
- [Roadmap](./ROADMAP.md) — Build plan and future $100M vision
- [Bug Fix Spec](./SPEC.md) — Documented production bugs and resolutions
- [Security Audit](./SECURITY_AUDIT.md) — Security and compliance assessment
- [Database Setup](./docs/DB_SETUP.md) — Database configuration guide
