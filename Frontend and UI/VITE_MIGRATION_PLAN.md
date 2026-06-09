# Vite Migration Plan for ClimaLogix Frontend

## Current State
Currently, the frontend runs as an unbundled monolithic HTML application (`index.html`). 
- **Dependencies:** React, React Router DOM, Babel Standalone, Three.js, Chart.js, jsPDF, and Supabase are all loaded via CDN `<script>` tags.
- **Components & Scripts:** `climalogix_dashboard.jsx`, `AuthPanel.jsx`, and multiple extracted components (`DhakaRouteMicroMap.jsx`, `ZoneDetailPanel.jsx`, `RouteExposureMapCard.jsx`, `OrderTimeline.jsx`, `CheckoutDialog.jsx`) are loaded via `<script type="text/babel">` and compiled in the browser at runtime.
- **Global Architecture:** State and API utilities are heavily reliant on the `window` object for cross-file communication (e.g., `window.apiCall`, `window.supabaseClient`, `window.LanguageSelector`, `window.DhakaRouteMicroMap`).

## Migration Steps
1. **Install Vite + React plugin:** Initialize Vite using `npm create vite@latest frontend -- --template react` and install necessary dependencies (`npm install react react-dom react-router-dom chart.js @supabase/supabase-js three jspdf`).
2. **Move `index.html`:** Move the root `index.html` out of `Frontend and UI` to the Vite project root and update the script entry point to `<script type="module" src="/src/main.jsx"></script>`.
3. **Convert CDN React imports:** Remove all CDN scripts from `index.html`. Replace them with proper `import` statements at the top of each component file.
4. **Eliminate `window.X` globals:** Convert each `window.` global variable to a proper ES module `export` and `import`.
5. **Modularize API Integration:** Update `api-integration.js`, `api-client.js`, and `supabaseClient.js` to be standard ES modules using `export`.
6. **Restructure Source Files:** Move all `.jsx` component files into a `src/components/` directory, and `climalogix_dashboard.jsx` into `src/pages/Dashboard.jsx` or similar.
7. **Create Entry Point:** Create `src/main.jsx` to mount the application (`ReactDOM.createRoot(document.getElementById('root')).render(<App />)`).
8. **Adopt Environment Variables:** Replace all hardcoded API keys and backend URLs with `import.meta.env.VITE_*` equivalents.

## Environment Variables Needed
| Current Hardcoded Value | Suggested Vite Env Variable Name | Purpose |
|-------------------------|----------------------------------|---------|
| `http://localhost:3001` or `https://backsme.onrender.com` | `VITE_BACKEND_URL` | Connects the frontend API client to the correct backend environment |
| `sb_publishable_H-_gcEncBp26k2iCHKOb_g_3RDQSr_M` | `VITE_SUPABASE_ANON_KEY` | Public access key for Supabase client |
| `https://...supabase.co` (if hardcoded) | `VITE_SUPABASE_URL` | Supabase instance URL |

## Risk & Rollback Plan
- **Primary Risk:** Converting from a global `window.*` architecture to ES modules will initially cause widespread `ReferenceError`s until all dependencies are explicitly imported. The `climalogix_dashboard.jsx` file is massive and untangling its internal state dependencies will be the hardest part of the migration.
- **Secondary Risk:** The browser-based Babel runtime acts permissively with some syntax that Vite/Rollup might reject during the build phase (e.g., missing imports, undefined variables).
- **Rollback Plan:** Ensure all work is done on a dedicated `feature/vite-migration` branch. If the migration breaks critical flows or takes longer than expected, simply `git checkout main` to revert back to the stable `index.html` CDN-based setup.
