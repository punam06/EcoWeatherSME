# ClimaLogix AI (EcoWeatherSME) — Agent Guide

## Quick start

```bash
npm run setup          # install root + backend deps
cp .env.template .env  # fill: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, OPENWEATHER_API_KEY
npm run dev            # backend on :5001, frontend (Python http.server) on :3000
```

## Verification commands

```bash
npm run test:math                              # core math engine (MERM, TST, ESG, Trust Score)
cd backend && npm test                         # integration test (Node native runner)
cd backend && npm run lint                     # tsc --noEmit --ignoreDeprecations 6.0
bash scripts/smoke-trust-layer-v2.sh           # offline smoke tests for trust layer v2
npm run db:seed:all                            # requires DATABASE_URL env var
```

## Architecture

- **Frontend:** React 18 SPA, **CDN-loaded inline JSX** in `Frontend and UI/index.html` (~7320 lines). No bundler. JSX compiled at build via `scripts/compile-frontend.js`. Edit with unique anchors only.
- **Backend:** Express 4 + TypeScript 6.0, entrypoint `backend/src/app.ts`, port 5001. Two tsconfigs: root (`lib/`+`scripts/`, node16) and `backend/` (`src/`, commonjs).
- **Domain math lib:** `lib/` at root is pure domain math (re-exported by `lib/index.ts`). `backend/src/lib/` is backend-specific services, types, middleware, utils.
- **DB:** Supabase (PostgreSQL 17 + pgvector). Client singleton at `backend/src/lib/supabase.ts`. 13 migrations under `supabase/migrations/`. Separate `db/migrations/` dir also exists.
- **AI:** Groq SDK, model `llama-3.3-70b-versatile` (`backend/src/lib/groq.ts`).
- **Auth:** JWT via Supabase Auth + Argon2. `backend/src/middleware/authenticateJWT.ts`. **Not enforced on most routes** (many marked `TODO`).

## Route mounting

Routes are mounted in `backend/src/app.ts`. Every route must be explicitly registered:

```typescript
app.use('/api/...', router);
```

23 route files in `backend/src/api/routes/`. One outlier: `language.ts` lives in `backend/src/routes/` and is imported as `import languageRouter from './routes/language'`.

**AI routes** require `strictAiRateLimiter` + `aiCostShield(50)` middleware wraps (see lines ~249-257 in app.ts). Three rate limiters exist: global (100/15min), AI (20/15min), strict per-minute (30/1min).

## Key conventions

- Services → `backend/src/lib/services/` (23 files). Middleware split across `backend/src/middleware/` (auth, costShield, roleGuard) and `backend/src/lib/middleware/` (rateLimiter, auth).
- API client → `Frontend and UI/api-integration.js`.
- DB migrations → `supabase/migrations/` only (no raw SQL in production).
- Zod validation schemas in route files or `backend/src/api/schemas.ts`.
- 3 Supabase Edge Functions in `supabase/functions/`: `trust-score`, `ai-processing`, `climate-dvs`. All configured with `verify_jwt = false` in `supabase/config.toml`.
- Delivery carrier adapters: `backend/src/adapters/carriers/pathao.adapter.ts`, `redx.adapter.ts`.

## Gotchas

- **Dual .env loading:** `backend/.env` loaded first, then root `.env` — backend vars win.
- **JWT not enforced** on batch, spotPricing, agent routes — in-memory mock used in dev.
- **In-memory state:** Weather cache (5-min TTL), AI CostShield ledger, `batchStore.service.ts` — all lost on restart.
- **Frontend fragility:** Single HTML file with CDN React 18. Edit with targeted anchors; avoid full rewrites.
- **Tests are thin:** 1 integration test (`backend/tests/order.integration.test.ts`, Node native test runner), 1 smoke script, 1 math test script.
- **OpenWeather free tier rate-limited** — caches per city for 5 min; falls back to estimated temps.
- **CORS:** allows localhost, `*.onrender.com`, Vercel, and any origin in development mode.
- **Error handling inconsistency:** some routes return `{error: string}`, others throw HTTP errors.
- **Two type systems:** `lib/types.ts` and `backend/src/lib/types.ts` partially overlap.
- **DB seeding** uses `psql "$DATABASE_URL"` directly (not Supabase client) — requires direct DB connection string in env.

## CI/CD

- `deploy-frontend.yml` — push to `main` affecting `Frontend and UI/**` → Render deploy API.
- `deploy-supabase.yml` — push to `main` affecting `supabase/**`, `backend/**`, or `lib/**` → Supabase CLI edge-function deploy.
- Secrets needed: `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.
