
### Page 1 — Title
<a name="page-1"></a>

**Team GreenBytes**

# ClimaLogix AI

### From Bio-Waste Uncertainty to Verified Value

*AI-Powered Climate-Resilient Supply Chain Intelligence for Bangladesh's SMEs*

**Infinity AI BuildFest 2026**

Presented by: **Umme Hani Punam** — Team Lead & Full-Stack AI/ML Engineer

🌐 Live Demo: [ecoweathersme.onrender.com](https://ecoweathersme.onrender.com)
📡 Live API: [backsme.onrender.com](https://backsme.onrender.com)


### Page 2 — Table of Contents
<a name="page-2"></a>

## Table of Contents

| # | Section |
|---|---------|
| 01 | The Problem — Why This Matters |
| 02 | Our Solution — ClimaLogix AI |
| 03 | Live Demo Flow |
| 04 | AI Architecture & Responsible Design |
| 05 | Technical Deep Dive |
| 06 | Impact KPIs & Metrics |
| 07 | Business Model & Market Opportunity |
| 08 | What's Next — Roadmap |
| 09 | Our Team |
| 10 | Thank You & Call to Action |


### Page 3 — The Problem
<a name="page-3"></a>

## The Problem — Why This Matters

### Bangladesh's Hidden Crisis

Bangladesh's organic fertilizer sector is valued at **BDT 800 Crore (~$73M) annually** — yet the supply chain is broken:

| Pain Point | Data |
|------------|------|
| 🧪 **No Verifiable Certification** | Less than **3%** of organic products carry verified quality proof |
| 🌡️ **Heat-Induced Spoilage** | Summer Urban Heat Island (UHI) spikes above **36°C** cause up to **40%** active compound degradation during transit |
| 🌧️ **Monsoon Loss Risk** | **20–30%** product loss during monsoon season from climate volatility |
| 🌍 **Global Soil Crisis** | **1.5 billion** people globally are affected by degraded soil systems |
| 🤝 **Trust Deficit** | Buyers cannot verify what they're purchasing — zero supply chain transparency |

> *"A farmer in Old Dhaka buys organic fertilizer. He has no way to know if it's genuine, if it survived the 38°C transit, or if it will help his tomato crop. He's gambling ৳15,000 on faith."*

**The core gap:** No platform exists that connects **product quality verification**, **climate-aware logistics**, and **AI-powered decision intelligence** into one trusted system for South Asian SMEs.


### Page 4 — Our Solution
<a name="page-4"></a>

## Our Solution — ClimaLogix AI

### An AI-powered PaaS that makes every shipment verifiable, climate-safe, and trustworthy.

We don't just predict weather — **we predict whether your product will survive the journey.**

---

### The 4-Layer Intelligence Stack

**Layer 1: Product Trust — IoT-Driven Quality Verification**
- Real-time sensor ingestion: pH, EC, Temperature, EM-1 ratio, Fermentation days
- Category-aware Trust Score (0–100) mapped to official **BARI standards**
- Supports 5 product categories: Organic, Retail FMCG, Pharma, Dairy, Manufacturing
- Explainable scoring with per-dimension breakdown ("why this score")

**Layer 2: Climate Intelligence — Microclimate Exposure Risk Model (MERM)**
- **50+ Dhaka zone profiles** with UHI offsets, hazard classes (MODERATE/HIGH/CRITICAL), and solar coefficients
- **Thermal Survival Time (TST)** prediction in minutes — the exact window before product degrades
- Real-time OpenWeather integration with 5-min intelligent caching
- Dispatch window recommendations: "Ship before 08:00 for Old Dhaka"

**Layer 3: Decision Intelligence — Delivery Viability Score (DVS)**
- Weighted formula: `DVS = (Trust Score × 60%) + (TST Normalized × 40%)`
- 5-tier dispatch recommendations: ✅ OPTIMAL → 🟡 GOOD → ⚠️ CAUTION → ❌ REJECTED
- Dynamic spot pricing (10%/30% clearance) based on TST risk windows
- Route optimization with zone hazard awareness

**Layer 4: AI Agentic Commerce — Voice-First Bangla RAG Assistant**
- LLM-powered agent (Llama-3.3 70B via Groq) with multi-intent orchestration
- 11 intent types: weather, order, navigate, product_search, bari_advice, batch_explain, and more
- **Voice-first Bangla/Banglish interface** using Web Speech API — designed for semi-literate operators
- RAG grounded in BARI scientific guidelines with Supabase text search retrieval
- AI CostShield: Budget guard limiting AI spending per IP with ROI tracking


### Page 5 — Live Demo Flow
<a name="page-5"></a>

## Live Demo Flow

### End-to-End Journey: Producer → Climate Check → Consumer Verification

```
Step 1: REGISTER                    Step 2: VERIFY                     Step 3: CLIMATE CHECK
┌─────────────────────┐            ┌─────────────────────┐            ┌─────────────────────┐
│  Producer registers │            │  Inspector records  │            │  System evaluates   │
│  a new batch via    │───────────▶│  IoT readings:      │───────────▶│  MERM for zone:     │
│  Producer Dashboard │            │  pH=4.1, EC=3.4     │            │  "Old Dhaka"        │
│                     │            │  Temp=28°C, Days=9  │            │  UHI offset: +3.4°C │
│  BCH-123456         │            │  Trust Score: 87/100│            │  TST: 142 minutes   │
└─────────────────────┘            └─────────────────────┘            └─────────────────────┘
                                                                               │
                                                                               ▼
Step 6: CONSUMER SCAN              Step 5: DISPATCH                   Step 4: DVS DECISION
┌─────────────────────┐            ┌─────────────────────┐            ┌─────────────────────┐
│  Consumer scans QR  │            │  Climate-safe       │            │  DVS = 85.2         │
│  → sees full        │◀───────────│  dispatch executed   │◀───────────│  ✅ OPTIMAL         │
│  provenance chain   │            │  via Pathao/Redex   │            │  "Safe for immediate│
│  (SHA-256 verified) │            │  adapters           │            │   dispatch"         │
│  📱 Tamper-proof    │            │  Route optimized    │            │  Window: 06:00–08:00│
└─────────────────────┘            └─────────────────────┘            └─────────────────────┘
```

### Voice Demo (Bangla RAG)
> 🎙️ Farmer speaks: *"আমার টমেটোর জন্য কোন সার ভালো?"*
> 🤖 ClimaLogix responds in Bangla with BARI-grounded advice + product recommendations + one-tap ordering


### Page 6 — AI Architecture & Responsible Design
<a name="page-6"></a>

## AI Architecture & Responsible Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USERS & ACTORS                              │
│  SME Owner  │  Buyer  │  Inspector  │  Delivery Partner  │  Admin   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│              AUTHENTICATION & ACCESS CONTROL                         │
│     JWT (Argon2)  │  Role Guard  │  Rate Limiter (3-tier)           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
    ┌───────────┬───────────┼───────────┬──────────────────┐
    │           │           │           │                  │
┌───▼────┐ ┌───▼─────┐ ┌───▼─────┐ ┌───▼──────────┐ ┌────▼────────┐
│Commerce│ │ Product │ │ Climate │ │AI Decision   │ │Provenance   │
│ Layer  │ │ Trust   │ │ Chain   │ │  Layer       │ │  Chain      │
│        │ │ Layer   │ │ Layer   │ │              │ │             │
│•Market │ │•Batch   │ │•Weather │ │•RAG Agent    │ │•SHA-256     │
│•Orders │ │•IoT/QA  │ │•MERM    │ │•Voice Bangla │ │•QR Certs    │
│•Checkout│ │•Trust   │ │•DVS     │ │•CostShield  │ │•Scan Track  │
│•Pricing│ │•QR Cert │ │•Route   │ │•11 Intents  │ │•Tamper Proof│
└────────┘ └─────────┘ └─────────┘ └──────────────┘ └─────────────┘
```

### AI Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM | Groq — Llama-3.3 70B Versatile | Intent classification, RAG responses, explanations |
| Fallback LLM | Llama-3.1 8B Instant | Graceful degradation when primary model unavailable |
| Knowledge Base | Supabase pgvector + Text Search | BARI guideline chunks for grounded retrieval |
| Speech | Web Speech API (Browser-native) | Zero-dependency voice input in Bangla |
| Language Detection | franc-min | Auto-detect Bangla / Banglish / English |
| Banglish Normalization | Custom agronomy glossary | Transliterate "shar" → "সার", "tometo" → "টমেটো" |

### Responsible AI Principles

| Principle | How We Implement It |
|-----------|---------------------|
| ✅ **Explainability** | Trust Score shows per-dimension breakdown (pH: -3, EC: 0, Temp: -2) — users see *why* |
| ✅ **Fairness** | Category-aware scoring — organic, retail, pharma each scored against their own standards |
| ✅ **Bangla-First Inclusion** | Voice-first interface for semi-literate farmers; auto-language detection |
| ✅ **Cost Transparency** | AI CostShield tracks token usage per IP, enforces budget limits, reports ROI |
| ✅ **Graceful Degradation** | 3-tier fallback: Primary LLM → Fallback LLM → Local BARI context (no AI required) |
| ✅ **Data Integrity** | SHA-256 provenance hash chain — tamper detection for every lifecycle event |
| ✅ **Privacy** | QR scan tracking uses IP hashing, not raw IPs; no PII stored in scan logs |


### Page 7 — Technical Deep Dive
<a name="page-7"></a>

## Technical Deep Dive

### Production-Ready Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | React 18 (CDN, no build step) | Zero-config deployment, instant load |
| **Backend** | Express 4 + TypeScript 6.0 | Type-safe, 23 route files, 24 services |
| **Database** | Supabase PostgreSQL 17 + pgvector | 17 tables, RLS policies, vector search |
| **AI/LLM** | Groq SDK (Llama-3.3 70B) | Fastest inference, Bangla-capable |
| **Auth** | JWT + Argon2 | Military-grade password hashing |
| **Security** | Helmet, CORS, Zod schemas, 3-tier rate limiting | Defense-in-depth |
| **Delivery** | Pathao + Redex API adapters | Local carrier integration |
| **CI/CD** | GitHub Actions → Render + Supabase | Automated deploy on push to main |
| **Infra** | Docker + Render | One-command deployment |

### What's Actually Built & Live (Not Mockups)

| Metric | Count |
|--------|-------|
| API Endpoints | **25+** production routes |
| Backend Services | **24** domain service files |
| Database Tables | **17** with migrations |
| Dhaka Zone Profiles | **50+** with UHI data |
| Product Categories | **5** (Organic, Retail, Pharma, Dairy, Manufacturing) |
| Agent Intents | **11** (weather, order, navigate, bari_advice, etc.) |
| Supabase Edge Functions | **3** (trust-score, ai-processing, climate-dvs) |
| Delivery Carrier Adapters | **2** (Pathao, Redex) |
| CI/CD Workflows | **2** (frontend deploy, backend deploy) |

### Proprietary Algorithms

1. **MERM (Microclimate Exposure Risk Model)**
   - `effectiveTemp = (ambientTemp + uhiOffset) × solarLoadFactor`
   - `solarLoadFactor = 1 + (solarCoefficient - 1) × sin(π × solarScale / 12)`
   - Zone-specific: Hazaribagh (+3.5°C UHI) vs. Gulshan (+1.3°C UHI)

2. **TST (Thermal Survival Time)**
   - `TST = 480 - (effectiveTemp - 30) × 18` minutes
   - Max 8 hours → 0 minutes as heat exposure increases

3. **DVS (Delivery Viability Score)**
   - `DVS = (trustScore × 0.6) + (normalizedTST × 0.4)`
   - Threshold: DVS ≥ 60 = dispatch approved

4. **ESG Metrics Engine**
   - Plastic offset: `bottlesSaved × 15g PET weight`
   - Carbon sequestration: `biocharKg × 0.75 × (44/12) × 0.95` kg CO₂e
   - Spoilage averted: `shipments × ৳15,000 × 40% loss × 90% compliance`


### Page 8 — Impact KPIs
<a name="page-8"></a>

## Impact KPIs & Metrics

### Quantifiable Outcomes

| KPI | Metric | How |
|-----|--------|-----|
| 🧪 **Product Verification** | Trust Score 0–100 per batch | IoT sensors vs BARI benchmarks |
| 🌡️ **Spoilage Prevention** | **40% degradation risk** eliminated per DVS-compliant shipment | MERM + TST dispatch windows |
| 💰 **Financial Savings** | **৳5,400/shipment** saved | `৳15,000 × 40% loss × 90% compliance` |
| 🌍 **Carbon Sequestration** | **2.61 kg CO₂e per kg** biochar | Pyrolysis carbon fraction model |
| ♻️ **Plastic Offset** | **15g PET** per refill container | Bulk refill station displacement |
| 📱 **Consumer Trust** | QR scan → full provenance chain | SHA-256 tamper-proof hash chain |
| 🗣️ **Inclusion** | Voice-first Bangla for semi-literate users | Web Speech API + Banglish normalization |
| 🤖 **AI Efficiency** | CostShield budgeting per IP | 50 AI calls/15min cap with ROI tracking |

### SDG Alignment

| SDG | Alignment |
|-----|-----------|
| 🎯 **SDG 2** — Zero Hunger | Verified soil inputs → better crop yields |
| 🎯 **SDG 9** — Industry & Innovation | AI-powered SME operating layer |
| 🎯 **SDG 12** — Responsible Consumption | ESG reporting, circular economy metrics |
| 🎯 **SDG 13** — Climate Action | Climate-resilient logistics, carbon tracking |
| 🎯 **SDG 17** — Partnerships | Open carrier adapters (Pathao, Redex) |


### Page 9 — Business Model & Market
<a name="page-9"></a>

## Business Model & Market Opportunity

### Target Market

- **Bangladesh Organic Fertilizer Sector:** BDT 800 Crore (~$73M/year)
- **South Asian Agri-Supply Chain:** $200B+ addressable market
- **Global Soil Health Products:** 1.5B people affected by degraded soils

### Revenue Model (PaaS)

| Stream | Model |
|--------|-------|
| 🔑 **SME Subscriptions** | Monthly SaaS fee for dashboard, batch tracking, QR verification |
| 📊 **DVS API Access** | Pay-per-call climate risk scoring for logistics companies |
| 🤖 **AI Agent Usage** | Tiered AI credits (CostShield metered) |
| 🏷️ **Certification Premium** | QR-verified batches command 15–25% price premium |
| 📈 **ESG Reporting** | Compliance reports for investors and auditors |

### Competitive Advantage

| Us | Traditional Solutions |
|----|-----------------------|
| Real-time climate-aware dispatch | Ship and pray |
| 50+ zone microclimate profiles | City-level weather only |
| AI agent in Bangla (voice-first) | English-only dashboards |
| SHA-256 provenance chain | Paper certificates |
| DVS = quality + climate combined | Quality OR logistics, never both |


### Page 10 — What's Next
<a name="page-10"></a>

## What's Next — Roadmap

### Phase 1: Post-Launch (Q3 2026)
- [ ] Multi-tenant SaaS with company/tenant IDs
- [ ] Full JWT enforcement across all routes
- [ ] Supabase Row-Level Security for processor-scoped queries
- [ ] Comprehensive test suite (currently: 1 integration + 1 smoke test)
- [ ] Standardized delivery state machine: `draft → verified → climate_checked → dispatched → delivered → received`

### Phase 2: Scale (Q4 2026)
- [ ] Offline ESP32 trust scoring — edge computing for rural cellular blackouts
- [ ] Cold-chain logistics integration — Pathao/Paperfly reefer van booking API
- [ ] Community-sourced microclimate observations via voice reports
- [ ] Audit logging for all sensitive operations
- [ ] Multi-city expansion: Chittagong, Sylhet, Rajshahi zone profiles

### Phase 3: Regional (2027)
- [ ] Expand to India (West Bengal, Odisha), Myanmar, Nepal
- [ ] Carbon credit marketplace integration
- [ ] Blockchain-backed provenance (move from SHA-256 chain to on-chain)
- [ ] Satellite imagery integration for vegetation fraction updates
- [ ] Government BARI certification API integration


### Page 11 — Our Team
<a name="page-11"></a>

## Our Team

| Name | Role | Key Contributions |
|------|------|-------------------|
| **Umme Hani Punam** | 🏆 Team Leader & Full-Stack AI/ML Engineer | MERM/TST engines, Trust Score algorithms, TypeScript architecture, ESG calculator, frontend dashboards, test suites, CI/CD pipeline |
| **Abu Zihad** | AI Integration & Backend Developer | Voice-to-Text Bangla LLM pipeline, Agent Orchestrator (890 lines), RAG service, Groq integration, intent classification |
| **Sultana Orce** | UI/UX Designer | Circular SVG viability gauges, responsive layouts, voice recorder animations, glassmorphism design system |
| **Sabbir Hasnat** | Database Architect & Cloud Ops | Supabase PostgreSQL schema (17 tables), pgvector setup, RLS policies, cloud deployments, migration scripts |
| **Shaon** | Frontend & UI Designer | Dashboard components, ProducerDashboard, InspectorDashboard, SMEOwnerDashboard |
| **Rebeka** | Frontend & UI Designer | Batch Verification QR component, Delivery Tracking views, Route Exposure Map |
| **Nishat Tasnim** | NRB Member | Research support, BARI guideline curation, testing |
| **Pufin** | NRB Member | Documentation, competitive analysis, user testing |


### Page 12 — Thank You
<a name="page-12"></a>

## Thank You

# ClimaLogix AI

### *From Bio-Waste Uncertainty to Verified Value*

---

🌐 **Live Demo:** [ecoweathersme.onrender.com](https://ecoweathersme.onrender.com)
📡 **API:** [backsme.onrender.com](https://backsme.onrender.com)
💻 **GitHub:** [github.com/punam06/EcoWeatherSME](https://github.com/punam06/EcoWeatherSME)

---

> *"Every shipment gets a Trust Score, a Climate Risk Assessment, and a tamper-proof provenance chain — so the farmer knows exactly what they're buying, and the SME knows their product will survive the journey."*

---

**Let's build climate-resilient commerce together.** 🌱

**Team GreenBytes** — Infinity AI BuildFest 2026

