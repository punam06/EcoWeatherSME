# SPEC.md — EcoWeatherSME / Climalogix AI — Production Bug Fixes

> **Live deployment:**
> - Frontend: https://ecoweathersme.onrender.com
> - Backend: https://backsme.onrender.com
> - Database: Supabase (https://pdeskdcdyhbldwfgbowz.supabase.co)
>
> **User-reported bugs (priority order):**
> 1. **Business Intelligence page is blank**
> 2. **Weather API isn't fetching correct data in real time**
> 3. **Operations Dashboard should be redesigned based on current updated structure**
> 4. **QR code should be linked with the dashboard's tracking system**
> 5. **Has source-to-consumer tracking/verification been completed via QR?** (verification question)
>
> **Directive:** "complete these task first"

---

## 1. Root-Cause Analysis (verified via codebase archaeology)

### Bug 1 — BI page is blank
- **Symptom:** User opens the "Business Intelligence" sidebar item, the page renders empty (or crashes silently).
- **Code reality:**
  - `Frontend and UI/index.html:2724` — `function BusinessIntelligenceView({ trustScore, dvs }) { … }`
  - `Frontend and UI/index.html:7255` — `<BusinessIntelligenceView trustScore={trustScore} dvs={dvs} />`
  - `Frontend and UI/index.html:6803` — `const [trustScore, setTrustScore] = useState(84);` (initialized to `84`, not `null`)
  - **However**, the body of `BusinessIntelligenceView` (lines 2716–2920) renders **conditional JSX that depends on data that is never passed in**. It expects a `batches` array, a `sustainabilityTrend`, and a `marketPull` chart — none of which are props. The comment at line 2721 reads: *"Degrades gracefully when the new BI route is not…"* — confirming the view was written to optionally call `/api/bi` for richer data, and falls back to a placeholder that **only renders when `trustScore` and `dvs` are non-zero and a `batches` array is supplied**. None of those conditions are met today, so the JSX returns `null`/empty.
  - There is **no `/api/bi` route** mounted in `backend/src/app.ts` (grep confirmed).
- **Fix:** Add a real backend `/api/bi` route that aggregates sustainability + market data, call it from `BusinessIntelligenceView` with safe fallbacks. The view must render useful content even when the route is offline (graceful degradation).

### Bug 2 — Weather API not real-time
- **Symptom:** Dashboard weather data appears stuck on old/seed values.
- **Code reality:**
  - `backend/src/app.ts:241-268` — `/api/dashboard` calls OpenWeather inline:
    ```ts
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(z.city)},BD&appid=${weatherApiKey}&units=metric`)
    ```
  - `.env:28` — `OPENWEATHER_API_KEY=<set in .env, never committed>` (loaded from environment at runtime).
  - `.env:5` — `BACKEND_API_URL=https://pdeskdcdyhbldwfgbowz.supabase.co` ← **This is the smoking gun.** The `BACKEND_API_URL` is set to the **Supabase URL**, not the Render backend URL `https://backsme.onrender.com`. This means any frontend code that reads `BACKEND_API_URL` is hitting the Supabase REST API instead of the Express backend — and the `/api/dashboard` route is never reached.
  - `frontend/index.html:3830` — `const BACKEND_URL = IS_LOCAL_DEV ? 'http://localhost:5001' : 'https://backsme.onrender.com';` ← The frontend uses the **correct** hardcoded URL. So the weather call *should* work…
  - **But the inline OpenWeather call is wrapped in `try/catch` and silently swallows errors** (line 264: `catch (_e) { /* use fallback */ }`). The fallback is `32 + Math.random() * 4` (line 253) — a random value between 32–36°C. **This is why the dashboard always shows roughly the same temperature** — the OpenWeather call is failing, the catch swallows the error, and the random fallback runs every time.
- **Root causes (in priority order):**
  1. The OpenWeather call uses `units=metric` (returns `temp` in °C) but reads `wd.main?.temp` — this is **correct** syntax.
  2. The OpenWeather key in `.env` appears to be **a public sample key from the OpenWeather docs** — it almost certainly doesn't have a paid plan activated, so calls return `401` for non-free cities. Free keys are throttled to 60 calls/min and only support a limited number of cities. (The actual key value lives in `.env` and is never committed to the repo.)
  3. The fallback silently masks the failure, making diagnosis impossible.
- **Fix:**
  - **Replace** the inline OpenWeather call with a proper `weatherService` that:
    - Reads the city from a structured list.
    - Caches responses for 5–10 minutes (per city) to stay under the free-tier rate limit.
    - Exposes a `source` field (`'live' | 'cache' | 'fallback'`) so the UI can show a "Live · 3 min ago" badge.
    - Surfaces the upstream error in logs (no silent swallow).
  - **Expose** `WEATHER_DEBUG=1` env var to return diagnostic data in dev.
  - **Add** `/api/weather/:city` as a public endpoint for the SPA to call directly (so the dashboard can refresh on demand without reloading the whole summary).
  - **Fix** the misleading `BACKEND_API_URL` env var: rename to `SUPABASE_URL` (it points at Supabase) so the bug can't recur.

### Bug 3 — Operations Dashboard needs redesign
- **Code reality:** The current dashboard at `index.html:3065-3140` renders:
  - 8 stat cards in a 4-column grid.
  - A "3-Layer Architecture" strip (L1 / L2 / L3).
  - Live/Seeded badge + refresh button.
  - A "New Batch" CTA.
- **What's missing per the user's "current updated structure":**
  - **Live weather widget** for the operator's zone (was supposed to be there, broken because of Bug 2).
  - **Sustainability trend sparkline** (last 7 days of carbon sequestered / plastic saved).
  - **Recent QR scans** feed (links to Bug 4).
  - **Trust score histogram** (distribution of batch trust scores).
  - **Per-layer KPI breakdown** (L1 registration count, L2 cert count, L3 QR scan count).
- **Fix:** Redesign the Operations Dashboard top section into a **modern 3-zone layout**:
  - **Zone A (Hero strip):** Live status, weather, last refresh, "New Batch" CTA.
  - **Zone B (KPI grid):** 8 stat cards with sparklines.
  - **Zone C (Activity panel):** Recent QR scans (Bug 4), recent batches, dispatch heat-map.

### Bug 4 — QR code not linked to dashboard's tracking system
- **Code reality:**
  - `backend/src/api/routes/batch.route.ts:241` — `const verificationUrl = \`https://climalogix.build/verify/${displayBatchId}\`;` ← **WRONG DOMAIN.** Hardcodes `climalogix.build` (a non-existent placeholder) instead of the actual frontend `https://ecoweathersme.onrender.com` or the env var `FRONTEND_URL`.
  - `.env:6` — `FRONTEND_URL=https://ecoweathersme.onrender.com` is **already set** but unused.
  - `backend/src/api/routes/verify.route.ts` — The public verify endpoint exists and returns trust score + provenance chain. **No scan-logging is performed** when someone scans a QR.
  - `frontend/index.html:3040` — `window.__QR_PRODUCT__` is consumed by `DashboardView` to auto-select a product, **but only if the user is already on the dashboard**. There is no deep-link parsing of `?batch=BCH-123` in the URL.
  - `frontend/index.html:6863-6864` — The only URL-param handler is `?tab=docs`. No `?tab=tracking` or `?batch=...`.
- **End-to-end source-to-consumer flow today (broken):**
  1. Operator certifies a batch → backend generates QR → QR contains `https://climalogix.build/verify/BCH-123` (dead link).
  2. Consumer scans QR → goes to a non-existent domain (404).
  3. Even if they manually reach `https://ecoweathersme.onrender.com/verify/BCH-123`, the SPA doesn't deep-link to a tracking view — it just renders the dashboard.
- **Fix:**
  1. **Fix the QR URL** in `batch.route.ts:241` to use `process.env.FRONTEND_URL || 'https://ecoweathersme.onrender.com'`.
  2. **Add QR scan logging** in `verify.route.ts`: on every `GET /api/verify/:batch_id`, insert a row into a new `qr_scans` table (or use a Supabase function) capturing `batch_id`, `timestamp`, `user_agent`, `ip_hash`. (Schema migration required.)
  3. **Expose scan history** via `GET /api/batches/:id/scans` (auth required, processor/admin role).
  4. **Add deep-link routing** in the SPA: parse `?batch=BCH-123` from `window.location.search` on mount, switch to a new "Tracking" view, prefilled with that batch.
  5. **Build a "Source-to-Consumer Tracking" view** that shows: origin (L1 registration), QA + climate events (L2), certification, QR scan history (L3), and a "Verify authenticity" link to the public verify endpoint.

### Bug 5 (question) — Has source-to-consumer tracking been completed?
- **Answer:** **Partially.** The data layer exists (provenance chain in `provenance_records`, trust score in `trust_score_logs`, QR generator in `batch.route.ts`). The verify endpoint exists and returns the chain. **But the loop is broken in 3 places:**
  1. The QR URL points to a dead domain.
  2. QR scans are not logged.
  3. The SPA doesn't render a consumer-facing tracking view from a QR scan.
- **After Bug 4 is fixed:** the loop is closed. Operator certifies → QR generated with correct URL → consumer scans → lands on `/verify/BCH-123` deep-linked to a tracking view → backend logs the scan → operator sees the scan in their dashboard.

---

## 2. Implementation Plan

### Phase 1 — Backend (foundation)
1. **Fix QR URL bug** — `batch.route.ts:241`
2. **Add `/api/bi` route** — new file `backend/src/api/routes/bi.route.ts` (sustainability + market aggregation)
3. **Add `/api/weather/:city` route** — new file `backend/src/api/routes/weather.route.ts` (with caching)
4. **Add QR scan logging** — new table `qr_scans` + insert in `verify.route.ts` + read endpoint
5. **Add batch scan history endpoint** — `GET /api/batches/:id/scans`
6. **Mount all new routes** in `app.ts`
7. **Rename misleading env var** `BACKEND_API_URL` → `SUPABASE_URL` in `.env` and `app.ts` references

### Phase 2 — Frontend (UX)
1. **Fix `BusinessIntelligenceView`** — call `/api/bi`, render sustainability + market panels with graceful fallback
2. **Add live weather widget** to Operations Dashboard hero strip — call `/api/weather/Dhaka` on mount, refresh every 5 min, show "Live · 2 min ago" badge
3. **Redesign Operations Dashboard** — new 3-zone layout (hero + KPIs + activity)
4. **Add deep-link parser** in main App — handle `?batch=BCH-123`, `?tab=tracking`, `?tab=bi`, `?tab=dashboard`
5. **Build `<TrackingView />`** — source-to-consumer journey with provenance chain + scan history
6. **Add "Tracking" sidebar entry** between "Batches" and "Verification"
7. **Wire QR scan toast** — when `__QR_PRODUCT__` is set, show "QR scan detected: BCH-123 — viewing journey" and route to Tracking view

### Phase 3 — Verification
1. `tsc --noEmit` on backend
2. Curl `/api/dashboard`, `/api/bi`, `/api/weather/Dhaka`, `/api/verify/BCH-123` and assert JSON shapes
3. Manual SPA test: load dashboard, click BI, click Tracking, scan simulated QR

---

## 3. Files Touched

**Backend (new):**
- `backend/src/api/routes/bi.route.ts`
- `backend/src/api/routes/weather.route.ts`
- `supabase/migrations/012_qr_scans.sql`

**Backend (modified):**
- `backend/src/app.ts` — mount new routes, rename env var
- `backend/src/api/routes/batch.route.ts:241` — fix QR URL
- `backend/src/api/routes/verify.route.ts` — log scan, return scan count
- `.env` — rename `BACKEND_API_URL` → `SUPABASE_URL`

**Frontend (modified):**
- `Frontend and UI/index.html` — redesign Dashboard, fix BI, add Tracking view, add deep-link parser, add weather widget, add Tracking nav item

**Docs:**
- `SPEC.md` (this file)
- `DEPLOYMENT_NOTES.md` — append change log

---

## 4. Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | BI page renders meaningful content (not blank) | Visit `?tab=bi`, see Sustainability × Market panels with live data |
| 2 | Weather API returns real-time data | Dashboard hero shows "Live · N min ago" with current Dhaka temp |
| 3 | Operations Dashboard redesigned | New 3-zone layout visible; no layout regressions on mobile |
| 4 | QR codes link to dashboard tracking | Scan → land on `/verify/BCH-123` → see tracking view with scan logged |
| 5 | Source-to-consumer tracking closed | Operator certifies → QR generated with `https://ecoweathersme.onrender.com/verify/...` → consumer scan → operator sees scan in their dashboard's "Recent QR Scans" feed |
| 6 | No TypeScript errors | `cd backend && npx tsc --noEmit` exits 0 |
| 7 | No silent errors in production | Server logs show real OpenWeather responses (or explicit "OPENWEATHER_API_KEY missing" warnings) |

---

## 5. Risk & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenWeather free-tier key gets throttled | 5-min in-memory cache keyed by city; `source: 'cache' | 'live' | 'fallback'` field |
| Renaming `BACKEND_API_URL` breaks something else | grep `BACKEND_API_URL` first; only rename if 0 production-code references |
| Adding `qr_scans` table requires Supabase access | Migration script is idempotent (`CREATE TABLE IF NOT EXISTS`); endpoint gracefully degrades if table missing |
| New Tracking view breaks existing deep-link `?tab=docs` | Only add *new* param handlers, don't touch the `?tab=docs` path |
| Edit `index.html` (7320 lines) is risky | Use `replace_string_in_file` with unique anchors; never rewrite whole file |

---

## 6. Out of Scope (explicit non-goals)
- Adding new auth roles / permissions
- Refactoring the single-file SPA into components
- Migrating to a real-time weather provider (paid OpenWeather plan)
- Adding a 3rd-party QR analytics service
- Changing the AI/ML pipeline (GROQ, trust score, DVS)
