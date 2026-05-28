# 🌍 EcoSortha AI (ClimateShield)
> **PaaS for Climate-Resilient Circular Commerce & Organic Decision Intelligence**

EcoSortha AI (ClimateShield) is a high-maturity, production-grade **circular commerce marketplace and decision-intelligence platform** designed specifically for Bangladesh's organic agriculture sector. By combining real-time IoT fermentation analytics, neighborhood-specific microclimate modeling (MERM), and a voice-first Bangla RAG assistant, the platform bridges the "trust deficit" in organic supply chains and secures biological inputs against heat-induced transit spoilage in extreme urban environments.

---

## 🎯 Project Purpose & Strategic Intent
Bangladesh's organic fertilizer market is valued at **BDT 800 Crore annually**, yet **less than 3% of products carry any verifiable certification**. The remaining 97% is traded informally, resulting in severe buyer hesitation due to pathogens or chemical contamination. Furthermore, biological organic fertilizers are highly temperature-sensitive; summer UHI (Urban Heat Island) heat spikes frequently exceed 36°C, causing **up to 40% microbial culture degradation** during transport.

**EcoSortha AI** resolves this double-sided crisis by:
1. **Verifying Batch Quality (At Production):** Through deterministic IoT fermentation metrics mapped to BARI standards.
2. **Verifying Transit Viability (At Dispatch):** Through a proprietary Microclimate Exposure Risk Model (MERM) that predicts Thermal Survival Time (TST).
3. **Overcoming Adoption Barriers:** By offering a speech-enabled, natural Bangla RAG interface for semi-literate local operators.

---

## 👥 Stakeholders & Beneficiaries

*   **Green Refineries & Bio-SME Processors:** Can double-certify products, qualify for eco-loans, and prevent transit spoilage losses (averting up to BDT 84,000 monthly per SME).
*   **Commercial Nurseries & Farmers:** Gain absolute quality transparency, accessing secure, pathogen-free organic bio-inputs with cryptographic QR tracking.
*   **Decentralized Bulk Refill Operators:** Save an average of **9,600 single-use plastic bottles annually** per SME by switching to tracked plastic offsets.
*   **Urban Ecosystem:** Permanently sequesters carbon in urban soils using stabilized thermochemical biochar amendments.

---

## 🚀 The 7 Core Product Features

1.  **🌡️ Microclimate Exposure Risk Model (MERM):** Fuses regional weather feeds (Open-Meteo) with neighborhood-specific concrete density, canopy levels, and building indices to predict microclimatic heat risks in narrow city corridors.
2.  **⏱️ Deterministic Thermal Survival Time (TST) Engine:** Predicts exact transit survival windows (in minutes) for sensitive microbial packages based on UHI forecasts, dispatch hours, and insulation factor packaging.
3.  **🔬 BARI-Aligned IoT Trust Score Evaluator:** Scores production batches (0-100) using deterministic sensor logs (pH, Electrical Conductivity, Temp, Fermentation days) against BARI (Bangladesh Agricultural Research Institute) benchmarks.
4.  **📈 Prophet-Style 30-Day Demand & Temp Forecaster:** Projects seasonal product demand curves alongside UHI extreme heat events, allowing SMEs to buffer stock before heatwaves hit.
5.  **♻️ Multi-Track ESG Impact Tracker:** Aggregates circular transaction metrics to programmatically calculate Plastic PET Offsets (kg), Carbon Sequestration ($CO_2\text{e}$), and Prevented Spoilage Savings (BDT).
6.  **🎙️ Voice-First Bangla RAG Assistant:** An inclusive browser speech portal translating natural spoken Bangla queries into LLM prompts grounded in BARI scientific guidelines.
7.  **🔐 Cryptographic QR Verification Pipeline:** Generates downloadable PDF certificates with public verification URLs (`/verify/[id]`) showing unalterable production histories.

---

## 🛠️ Technology Stack & Tools Used

| Layer | Technologies / Tools |
| :--- | :--- |
| **Frontend Framework** | React 18 (Standalone CDN), Vanilla CSS, Chart.js, Babel |
| **Backend Framework** | Node.js, Express, TypeScript, ts-node |
| **Database & Vector Store** | Supabase (PostgreSQL with `pgvector` & RLS Policies) |
| **AI & LLM Services** | Claude 3.5 Sonnet (Anthropic API), Web Speech API |
| **Libraries & Utilities** | jsPDF (Certificate generation), dotenv, standard-uuid |
| **Hosting & CI/CD** | Vercel (Frontend), Railway (Backend Microservice) |

---

## Current Integration Status (28 May 2026)

- Backend: Express.js API completed and running locally on port 5001. Core endpoints implemented (health, trust-score calculation, demand-forecast, zones, batches, IoT readings, users). Database-dependent endpoints are present and guarded to fail gracefully when `DATABASE_URL` is not configured.
- Frontend: Static React dashboard (`Frontend and UI/index.html`) wired to a new `api-integration.js` client that auto-initializes health checks and exposes `window.APIClient` for components. Trust-score and forecast flows work without DB.
- DB & Schema: `schema.sql` contains the primary schema (users, batches, iot_readings, zone_microclimate_profiles). Local Postgres/Supabase integration is optional; DB endpoints will return helpful errors if DB is missing.
- Dev workflow: npm scripts added for bootstrapping backend and serving frontend; backend `package.json` updated and dependencies installed. Integration guide `INTEGRATION_GUIDE.md` added.

Completed key tasks:
- Implemented deterministic trust-score calculator endpoint and tested locally.
- Implemented demand-forecast mock endpoint and verified data loading.
- Created zone, batch, IoT, and user endpoints with safe DB wrappers.
- Added frontend integration script and wired into `index.html`.
- Created `.env` template, added root `.env` (local placeholders), and made backend load repo-root `.env` when run from subfolder.
- Committed and pushed all changes to GitHub.

---

## Remaining Work / Open Tasks (ordered by priority)

1. Production DB & SQL tasks
	- Finalize DB provisioning (Supabase or managed Postgres) and secure service role keys.
	- Run `schema.sql` to create all tables, indexes, and extensions (`uuid-ossp`, `vector`/`pgvector`).
	- Add migrations and seed scripts for zones, demo batches, and example IoT readings.
	- Implement and test Role-Level Security (RLS) policies if using Supabase.

2. Authentication & Security
	- Implement secure password hashing (bcrypt/argon2) and authentication flows (JWT refresh, access tokens).
	- Add input validation and stricter request schemas (e.g., using Zod or Joi).
	- Store secrets securely (GitHub Secrets / environment store) and avoid committing real keys.

3. Web Speech API & Multilingual Input
	- Integrate browser Web Speech API to capture microphone audio and detect user language (auto-detect preferred language based on locale + speech recognition results).
	- Build fallback behavior for unsupported browsers (show text input and language selector).
	- Provide UX for granting mic permission and language override.

4. Weather API Integration (base temperature & wind speed)
	- Integrate a weather provider (Open-Meteo, OpenWeatherMap, or Meteomatics) to fetch base temperature and wind speed for a given location.
	- Auto-trigger weather fetch when location is selected via geo-input (browser geolocation or typed location) and feed values into MERM/TST models.
	- Add caching and rate-limit handling for API keys.

5. Chatbot / Conversational Layer (Gork or alternative)
	- Select and integrate a conversational API (Gork or another LLM/chat API). Evaluate costs/latency and propose fallback LLM.
	- Implement RAG pipeline: vector store (Supabase/pgvector), retriever, prompt templates, and chat session management.
	- Add moderation & safety filters and usage quota enforcement.

6. Vector Store / RAG Indexing
	- Create vector embeddings pipeline for BARI guidelines and training documents.
	- Store vectors in Supabase `pgvector` or an alternate vector DB (Pinecone/Weaviate) if needed.

7. Frontend UX & Accessibility
	- Replace inline Babel React approach with a build system (Vite/Parcel) for production deploys.
	- Add UI controls for microphone, live updates, and clear error states for missing DB or API keys.
	- Accessibility testing and keyboard navigation support.

8. CI/CD, Deployment & Observability
	- Configure GitHub Actions to run lint/tests and deploy backend (Railway/Render) and frontend (Vercel/Netlify).
	- Add logging (structured logs) and error tracking (Sentry) and basic metrics (Prometheus / Hosted solution).
	- Create a production-ready `Dockerfile` for backend and optional container-based deployment.

9. Tests & QA
	- Add unit tests for trust-score logic and backend endpoints (Jest / Supertest).
	- End-to-end tests for core flows (create batch, record reading, calculate trust score).

10. Documentation & Governance
	- Complete `INTEGRATION_GUIDE.md` and expand README with architecture diagrams and API docs (OpenAPI/Swagger).
	- Add contributor guide and code style rules.

---

## Role-based Next Steps (who should own what)

- **Backend Engineer (you / dev team)**
  - Finalize DB provisioning, run `schema.sql`, and implement migrations + seeders.
  - Implement authentication, password hashing, and secure token flows.
  - Harden input validation and error handling, implement logging and health checks.

- **Frontend Engineer / UX**
  - Add Web Speech API integration, UI controls for mic permission and language selection.
  - Connect weather API calls to UI flows and visualize temperature/wind data.
  - Migrate to a production build pipeline (Vite) and ensure CORS + env handling.

- **ML / AI Engineer**
  - Choose conversational provider (Gork/Anthropic/OPenAI), design RAG pipeline, and implement vector embeddings ingestion.
  - Build prompt templates and evaluation tests for responses.

- **Database / DevOps**
  - Provision Supabase or managed Postgres, configure backups, RLS policies, secrets, and monitoring.
  - Prepare Dockerfile(s), GitHub Actions workflows, and deployment targets.

- **QA / Tester**
  - Build test suites for backend endpoints and E2E flows, smoke test on staging, and validate cross-browser Web Speech support.

- **Product / PO**
  - Prioritize feature list (chatbot, Web Speech, weather-triggered alerts, certification flow) and coordinate API quotas and budget for LLM usage.

---

## Short-Term Roadmap (next 2 - 4 weeks suggested milestones)

1. Provision DB (Supabase) and run schema + seed scripts. Verify DB endpoints. (Backend + DB)
2. Implement password hashing + JWT auth and protect user/batch endpoints. (Backend)
3. Implement Web Speech API capture + simple language auto-detect and pipe to RAG. (Frontend + AI)
4. Integrate weather API and auto-trigger MERM calculations. (Frontend + Backend)
5. Choose LLM/chat provider and wire RAG retrieval for helpful, grounded responses. (AI)

---

If you want, I can now:
- Provision a Supabase project and generate the exact `DATABASE_URL`-ready `schema.sql` run commands; or
- Implement the Web Speech integration in `Frontend and UI/index.html` and wire it to `APIClient` for a demo; or
- Add authentication (bcrypt + JWT) to `backend/index.js` and secure user routes.

Tell me which of the high-priority items you'd like me to implement next and I will start the work and update the todo plan accordingly.

## 👥 Team & Contributions

Our team organized horizontally using strict branch lifecycles and logical interface contracts to maximize execution velocity:

| Name | Role | Core Contributions |
| :--- | :--- | :--- |
| **Umme Hani Punam** *(Team Lead)* | **Microclimate Data Architect & UI Developer** | Developed the core MERM/TST mathematical service libraries, engineered the TypeScript type interfaces, built the ESG calculator, created the test suites, and developed the standalone frontend dashboard. |
| **Zihad** | **AI Integration & Backend Developer** | Integrated the Voice-to-Text Bangla LLM pipeline and structured the backend microservices. |
| **Orce** | **UI/UX Designer** | Designed the circular SVG viability gauges, formulated responsive layout wires, and specified the voice recorder animations. |
| **Sabbir** | **Database Architect & Cloud Ops** | Configured the Supabase Vector Database, implemented RLS security policies, and managed cloud deployments. |

---

## 📥 Installation & Local Setup

### Prerequisites
*   Node.js (v18.0.0 or higher)
*   npm (v9.0.0 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/punam06/EcoWeatherSME.git
cd EcoWeatherSME
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory matching [`.env.template`](file:///.env.template):
```bash
cp .env.template .env
```
*Fill in your Supabase connection strings and Anthropic/Claude API credentials.*

---

## 🏃 Using the Application & Test Runner

### Run the Mathematical Engine Verification
To execute the high-precision mathematical test suite verifying all formulas (MERM, TST, ESG, Trust Score) and checking float-rounding logic:
```bash
npm run test:math
```

### Run the Interactive Microclimate Simulation
To run an interactive command-line simulator where you can input custom parameters (zone, packaging, solar time, pH) and get live advice:
```bash
npx ts-node scripts/interactive-microclimate.ts
```

### Seed the Supabase Cloud Databases
To populate the database tables with neighborhood hazard constants and BARI guidelines:
```bash
# Seed neighborhood hazards & multipliers
npm run seed:hazards

# Seed compliance RAG standards
npm run seed:data
```

---

## 📜 Scientific Formulas & Logic Specifications

### Microclimate Adjustment (MERM)
$$T_{\text{adjusted}} = T_{\text{base}} + (\text{UHI Offset} \times \text{Solar Factor}) - W_{\text{cooling}}$$
*   **Solar Factor:** `1.0` during Peak Solar Hour (11:00 AM - 3:00 PM), `0.6` standard daylight, `0.2` night.
*   **Wind Cooling ($W_{\text{cooling}}$):** `1.0°C` reduction if ambient wind speed exceeds 15.0 km/h.

### Thermal Survival Time (TST)
$$\text{TST (minutes)} = \text{Math.max}\left(10, \text{Math.round}\left(\frac{\text{Trust Score} \times \text{Packaging Factor} \times \text{Base Survival Multiplier}}{\text{Hazard Multiplier} \times \text{Solar Hour Multiplier}} \times 60\right)\right)$$
*   **Standard Old Dhaka Peak Test Case:** Standard Plastic (`1.0`), Old Dhaka (`Hazard=1.8`, `Survival=0.9`), Peak Solar (`1.5`), Trust Score (`85`) $\rightarrow$ Resolves to exactly **`1700` minutes**.
