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
| **Frontend Framework** | Next.js 14 (React), TypeScript, Tailwind CSS, Recharts |
| **Backend Framework** | Node.js, Express, TypeScript, ts-node |
| **Database & Vector Store** | Supabase (PostgreSQL with `pgvector` & RLS Policies) |
| **AI & LLM Services** | Claude 3.5 Sonnet (Anthropic API), Web Speech API |
| **Libraries & Utilities** | jsPDF (Certificate generation), dotenv, standard-uuid |
| **Hosting & CI/CD** | Vercel (Frontend), Railway (Backend Microservice) |

---

## 👥 Team & Contributions

Our team organized horizontally using strict branch lifecycles and logical interface contracts to maximize execution velocity:

| Name | Role | Core Contributions |
| :--- | :--- | :--- |
| **Umme Hani Punam** *(Team Lead)* | **Microclimate Data Architect & UI Developer** | Developed the core MERM/TST mathematical service libraries, engineered the TypeScript type interfaces, built the ESG calculator, created the test suites, and took over frontend dashboard development. |
| **Zihad** | **Full-Stack AI & Backend Architect** | Built the Express microservice routes, implemented the Claude 3.5 Sonnet RAG prompt compiler, and set up LLM API connectors. |
| **Orce** | **UI/UX Designer** | Designed the circular SVG viability gauges, formulated responsive layout wires, and specified the voice recorder animations. |
| **Sabbir** | **DevOps & DB Lead** | Setup Supabase cloud tables, wrote PostgreSQL security policies (RLS), and deployed CI/CD configurations. |

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
