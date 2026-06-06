# Deployment Notes & Required GitHub Secrets

This file documents the GitHub repository secrets and setup required so that pushing to `main` will automatically trigger deployments for the Frontend (Render) and Backend (Supabase Edge Functions).

## Frontend (Render)
- Recommended: Connect Render to GitHub via Render Dashboard for automatic deploys on push.
- Alternatively supply the following GitHub Secrets to trigger a deploy via GitHub Actions:
  - `RENDER_API_KEY` — Render service API key (bearer token)
  - `RENDER_SERVICE_ID` — Render service id (value like `srv-xxxxxx` without `srv-` in some cases; workflows expect the id part)

Workflow file: `.github/workflows/deploy-frontend.yml`
- This workflow triggers on changes to `Frontend and UI/**` and will call the Render deploy API using the secrets above.

## Backend (Supabase)
- Supabase edge functions and other assets can be deployed via the Supabase CLI.
- Add these GitHub Secrets:
  - `SUPABASE_ACCESS_TOKEN` — Personal access token with permission to deploy functions
  - `SUPABASE_PROJECT_REF` — Project ref ID (e.g., `pdeskdcdyhbldwfgbowz`)

Workflow file: `.github/workflows/deploy-supabase.yml`
- This workflow runs on changes to `supabase/**`, `backend/**`, or `lib/**` and uses the Supabase CLI to deploy functions.
- If the required secrets are not present, the workflow will skip deployment and output a note.

## Security
- DO NOT store secrets in the repository files. Use GitHub Secrets or Render / Supabase dashboards to store environment variables.
- If any secret was exposed publicly, rotate it immediately (Supabase DB credentials, publishable keys, LLM keys).

## How to Add Secrets in GitHub
1. Go to your GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
2. Add `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` with appropriate values

## Notes
- Render also supports connecting a GitHub repo directly and will auto-deploy on pushes — recommended.
- Supabase has GitHub integration / CI workflows; if you prefer that, you can enable Supabase's own GitHub integration.

If you want, I can add the Render service ID and Supabase project ref into the workflows for you if you provide them as GitHub Secrets, or I can walk you through adding them in the GitHub UI and then verifying an automatic deploy.

---

## Change Log — Production Fixes (Phase 1 + 2)

### Issue 1 · Business Intelligence page was blank
**Root cause:** the BI view rendered only ESG-synthetic bars. There was no live `/api/bi` route.
**Fix:**
- New `backend/src/api/routes/bi.route.ts` — GET `/` aggregates 14-day CO₂ + plastic bottles, regional market pull, trust-score distribution (A+/A/B/C/D/F), L1/L2/L3 layer breakdown, top 5 batches by trust, totals, and best-effort L3 QR scan count.
- Mounted at `app.ts` → `app.use('/api/bi', biRouter)`.
- Replaced the body of `BusinessIntelligenceView` in `index.html` (lines ~2725-2892) with a live-fetching implementation that reads `APIClient.getBI()`, shows a `LIVE | SYNTHETIC` badge, and renders five panels: 14-day trend, pipeline KPIs (3-layer funnel), trust distribution histogram, regional pull, top batches.
- Added `KpiBox` helper component for the KPI cards.

### Issue 2 · Weather API not fetching real-time data
**Root cause:** inline OpenWeather call in `/api/dashboard` (`app.ts:240-280`) failed silently and had malformed city strings (`Old Dhaka,BD`, `Mirpur,Dhaka`, `Gulshan,Dhaka`).
**Fix:**
- Added a 5-minute TTL `weatherCache: Map<string, {ts, data}>` in `app.ts`.
- Added `fetchWeatherWithCache(city, apiKey)` helper that returns `{temp, rh, description, city}` or `null`.
- Replaced the inline `fetch(OpenWeatherURL)` call with `await fetchWeatherWithCache(z.city, weatherApiKey)`.
- Cleaned city names to Google's geocode format: `Old Dhaka`, `Mirpur`, `Savar`, `Gulshan`.
- Heatmap objects now include `live: boolean` and `liveTempC: number | null` so the frontend can show a live-weather widget.
- The public `/api/weather` route at `app.ts:390` (lat/lon-based) was already present and continues to work.

### Issue 3 · Operations Dashboard needs redesign with current structure
**Fix:**
- Added a **live weather hero strip** above the 3-Layer Architecture card in `DashboardView`. When `/api/dashboard` returns live temps, the strip shows: avg °C across N zones (OpenWeather), hottest zone, coolest zone. Auto-hides when no live data.
- Kept existing 8-stat-card grid, 3-Layer Architecture strip, Thermal Hazard Map, and Recent Activity panels intact.
- All backend → frontend wiring preserved; the redesigned layout is fully backward compatible.

### Issue 4 · QR code links to dashboard's tracking system
**Fix:**
- QR code already points to `https://ecoweathersme.onrender.com/?tab=tracking&batch={id}` (set in `batch.route.ts:241`).
- URL parser in `index.html` now reads `?tab=tracking` + `?batch={id}`, stashes the batch in `window.__QR_PRODUCT__`, and `history.replaceState`s the URL clean.
- New `TrackingView` component: search box, journey bar (L1 Registration → L2 Certification → Provenance Chain → Chain Verified → Consumer Scan), 4 KPI cards, recent-scans table.
- `DashboardView` auto-selects the QR batch if `window.__QR_PRODUCT__` is present.
- Backend logs every QR scan: `verify.route.ts` inserts a row into `qr_scans` and returns `scanCount` in the response.
- New endpoint: `GET /api/batches/:id/scans` returns scan history for a batch.
- New migration: `supabase/migrations/012_qr_scans.sql` (id, batch_id, user_agent, ip_hash, scanned_at + indexes).

### Files modified
| File | Change |
| --- | --- |
| `backend/src/api/routes/bi.route.ts` | NEW — 14-day aggregation route |
| `backend/src/api/routes/batch.route.ts` | QR URL fix + `GET /:id/scans` |
| `backend/src/api/routes/verify.route.ts` | QR scan logging + `scanCount` in response |
| `backend/src/app.ts` | biRouter mount + weather cache + helper + city cleanup |
| `supabase/migrations/012_qr_scans.sql` | NEW — `qr_scans` table |
| `Frontend and UI/api-integration.js` | `getBI()`, `getBatchScans()` |
| `Frontend and UI/index.html` | New BI view, new `TrackingView`, weather widget, TABS entry, URL parser, `useMemo` import |

### Verification steps
1. `cd backend && npx tsc --noEmit` — PASSING.
2. Brace/paren/bracket balance check on `index.html` script body — balanced (delta 0).
3. Manual smoke test (post-deploy):
   - Open https://ecoweathersme.onrender.com/?tab=bi → should render live cards (or `SYNTHETIC` badge if no Supabase).
   - Open https://ecoweathersme.onrender.com/?tab=tracking → should show the search box; enter a batch id to see the journey bar.
   - Open https://ecoweathersme.onrender.com/?tab=tracking&batch=BCH-xxx → should auto-load that batch.
   - Open the Operations Dashboard → if OpenWeather + key are healthy, the live weather strip should show °C values within 5 minutes (cache window).

