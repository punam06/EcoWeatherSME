# Master Prompt & Work Package: Umme Hani Punam
**Role:** Team Lead & Microclimate Data Architect

## Overview
Your core objective as the **Team Lead & Microclimate Data Architect** of EcoSortha AI (ClimateShield) is to construct, seed, and verify the physical database architecture and analytical services that power the climate-resilient circular economy. You are responsible for:
1. **Physical Microclimate Modeling Pipeline:** Incorporating the BUET-calibrated neighborhood profiles, querying the real-time regional weather observations (Open-Meteo), and dynamically computing the Adjusted Temperature and Thermal Risk.
2. **Deterministic Delivery Viability Score (DVS) & Thermal Survival Time (TST) Engines:** Standardizing the mathematical models and logic that Zihad's endpoints and Orce's frontend widgets rely on.
3. **ESG & Impact Performance Engine:** Programmatically calculating environmental and economic metrics (plastic bottle offsets, permanent carbon sequestration, and prevented thermal spoilage) for automated ESG reports.
4. **Mock and Compliance Datastore Ingestion:** Creating forecast datasets and seeding Supabase database tables with BARI compliance records.

---

## 1. Core Relational Database Schemas (Supabase PostgreSQL)
You must finalize, migrate, and validate the PostgreSQL tables in your Supabase instance. Ensure these schemas are strictly defined:

```sql
-- A. Microclimate Dynamic Calculation & Profile Tracking
CREATE TABLE zone_microclimate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL UNIQUE,
    uhi_offset NUMERIC(4,2) NOT NULL,
    building_density NUMERIC(4,2) NOT NULL,
    vegetation_fraction NUMERIC(4,2) NOT NULL,
    wind_corridor_factor NUMERIC(4,2) NOT NULL,
    thermal_mass_coefficient NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- B. Live Neighborhood Hazard Profiles (Used in TST)
CREATE TABLE zone_hazard_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL UNIQUE,
    hazard_class VARCHAR(20) NOT NULL,
    hazard_multiplier NUMERIC(4,2) NOT NULL,
    building_density NUMERIC(4,2) NOT NULL,
    vegetation_fraction NUMERIC(4,2) NOT NULL,
    wind_corridor_factor NUMERIC(4,2) NOT NULL,
    thermal_mass_coefficient NUMERIC(4,2) NOT NULL,
    base_survival_multiplier NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- C. Microclimate Logged Calculation Readings
CREATE TABLE microclimate_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) REFERENCES zone_microclimate_profiles(zone) ON DELETE CASCADE,
    base_temp NUMERIC(5,2) NOT NULL,            -- Live regional temperature from API
    wind_speed NUMERIC(5,2) NOT NULL,           -- Live regional wind speed from API
    solar_factor NUMERIC(4,2) NOT NULL,          -- Diurnal solar hour factor
    adjusted_temp NUMERIC(5,2) NOT NULL,         -- Calculated microclimate temperature
    thermal_risk NUMERIC(3,2) NOT NULL,          -- Calculated thermal degradation risk
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- D. Dispatch Transit Exposure Tracking Logs
CREATE TABLE dispatch_exposure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    zone VARCHAR(50) NOT NULL,
    packaging_type VARCHAR(30) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    calculated_survival_time_minutes INT NOT NULL,
    exposure_risk_level VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- E. ESG & Sustainability Performance Reporting
CREATE TABLE esg_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    spoilage_prevented_bdt INT NOT NULL,
    plastic_offset_kg INT NOT NULL,
    carbon_sequestered_kg INT NOT NULL,
    report_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Core Mathematical Specifications

### A. Real-time Microclimate Delta Calculations
Instead of using static, city-wide weather parameters, the pipeline dynamically fetches baseline metrics from the regional Open-Meteo API:
* **API URL:** `https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,wind_speed_10m`
* **Fallback Defaults:** If the API times out or fails, gracefully fallback to seasonal baseline standards: `baseTemp = 31.0°C`, `windSpeed = 8.0 km/h`.

#### The Microclimate Adjustment Formula:
$$T_{\text{adjusted}} = T_{\text{base}} + (\text{UHI Offset} \times \text{Solar Factor}) - W_{\text{cooling}}$$

* **Diurnal Solar Factor ($S_{\text{factor}}$):**
  * Peak Solar Hour (11:00 AM - 3:00 PM): `1.0`
  * Standard Daylight Hour (8:00 AM - 11:00 AM & 3:00 PM - 6:00 PM): `0.6`
  * Nighttime/Dawn/Dusk: `0.2`
* **Wind Cooling Dispersion Factor ($W_{\text{cooling}}$):**
  * If live wind speed > 15.0 km/h: disperse heat by `1.0°C`.
  * Otherwise: `0.0°C`.
* **Thermal Risk Index:**
  * High Hazard ($T_{\text{adjusted}} > 35.0^\circ\text{C}$): `1.0` (Critical Degradation)
  * Moderate Hazard ($32.0^\circ\text{C} < T_{\text{adjusted}} \le 35.0^\circ\text{C}$): `0.5`
  * Low Hazard ($T_{\text{adjusted}} \le 32.0^\circ\text{C}$): `0.1`

---

### B. Thermal Survival Time (TST) Equation
Calculates the exact minutes an organic biological fertilizer batch can survive in transit before pathologically degrading under local neighborhood solar loading:

$$\text{TST (minutes)} = \text{Math.max}\left(10, \text{Math.round}\left(\frac{\text{Trust Score} \times \text{Packaging Factor} \times \text{Base Survival Multiplier}}{\text{Hazard Multiplier} \times \text{Solar Hour Multiplier}} \times 60\right)\right)$$

#### Variable Mapping & Parameter Matrices:
1. **Trust Score:** Dynamic IoT-verified base batch stability (scale 0-100).
2. **Packaging Factor:**
   * Standard Uninsulated Plastic Bottle = `1.0`
   * Thermal-Insulated Cooling Bin = `4.0`
3. **Solar Hour Multiplier:**
   * Peak Solar (11:00 AM - 3:00 PM): `1.5`
   * Standard Daylight (8:00 AM - 11:00 AM & 3:00 PM - 6:00 PM): `1.0`
   * Night / Early Morning: `0.4`
4. **BUET-Calibrated Neighborhood Hazard Registry:**
   * **Old Dhaka (Class A):** Hazard Multiplier = `1.80` | Base Survival Multiplier = `0.90`
   * **Savar (Class B+):** Hazard Multiplier = `1.55` | Base Survival Multiplier = `1.00`
   * **Gazipur (Class B):** Hazard Multiplier = `1.50` | Base Survival Multiplier = `1.05`
   * **Mirpur (Class B-):** Hazard Multiplier = `1.40` | Base Survival Multiplier = `1.02`
   * **Gulshan (Class C):** Hazard Multiplier = `1.10` | Base Survival Multiplier = `1.20`

#### Example Scenario Validation:
Verify that your mathematical implementation produces the exact outcome for this standard test case:
* **Batch Trust Score:** `85`
* **Destination:** `Old Dhaka` (Hazard Class A: Hazard Multiplier = `1.80`, Base Survival = `0.90`)
* **Packaging:** `Standard Plastic` (Factor = `1.0`)
* **Dispatch Time:** `12:00 PM` (Peak Solar Multiplier = `1.5`)
* **Formula Execution:**
  $$\text{Raw TST (hours)} = \frac{85 \times 1.0 \times 0.90}{1.80 \times 1.5} = \frac{76.5}{2.7} = 28.333\text{ hours}$$
  $$\text{TST (minutes)} = \text{Math.round}(28.333 \times 60) = 1700\text{ minutes}$$

* *Note:* Zihad's backend `merm.service.ts` uses this equation to trigger critical warnings when Transit Duration exceeds TST, proposing:
  * **Upgrade Packaging:** Switches Packaging Factor to `4.0` (increasing TST from 1,700 to 6,800 minutes).
  * **Shift Shipping Time:** Shifts solar multiplier to `0.4` at early morning (increasing TST to 6,375 minutes).

---

## 3. Dynamic ESG Metric Calculations (`lib/services/esg.service.ts`)
You must construct the ESG engine to process real physical logs and compile mathematically verified circular commerce impact credentials:

### A. Volume-to-Bottle Offset Equation
Calculates standard plastic packaging containers saved via bulk-refill stations and translates it into physical PET weight offset:
$$N_{\text{saved}} = \sum_{i=1}^{k} \frac{V_{\text{refill}, i}}{0.25\text{ Liters}}$$
$$\text{Plastic Offset (kg)} = \text{Math.round}(N_{\text{saved}} \times 0.015\text{ kg})$$
*(Assumes standard container volume is 0.25L and average commercial PET bottle weight is 15g).*

### B. Carbon Sequestration Equation
Translates thermochemical solid carbonization (pyrolysis of wood/dry refuse feedstocks) into CO2-equivalent metrics:
$$\text{Carbon Sequestered (kg)} = \text{Math.round}(M_{\text{biochar}} \times \Phi_{\text{fixed\_carbon}} \times \frac{44}{12} \times \gamma_{\text{permanence}})$$
* **$M_{\text{biochar}}$:** Mass of solid biochar produced (kg).
* **$\Phi_{\text{fixed\_carbon}}$:** Carbon fraction index under 450°C slow pyrolysis = `0.75`.
* **$\frac{44}{12}$:** Molecular mass ratio to convert fixed carbon to carbon dioxide equivalent ($CO_2\text{e}$).
* **$\gamma_{\text{permanence}}$:** Permanence stabilization rating over a 100-year soil horizon = `0.95`.

### C. Prevented Biological Spoilage (BDT)
Measures regional financial losses averted using the platform's smart dispatch scheduler:
$$\text{Spoilage Averted (BDT)} = \text{Math.round}(N_{\text{shipments}} \times \text{Value}_{\text{base}} \times \text{Degradation Rate} \times \text{Smart Window Compliance})$$
* **$\text{Value}_{\text{base}}$:** Median market value of biological batches = `BDT 15,000`.
* **$\text{Degradation Rate}$:** Loss coefficient if shipped during extreme UHI heat without DVS insulation = `0.40` (40% decay).
* **$\text{Smart Window Compliance}$:** Fraction of delivery shipments conforming with the smart dispatch scheduler = `0.90` (90% success).

---

## 4. Seeding and Mock Data Deliverables

### A. Target Zone Hazard Seeder (`scripts/seed-zone-hazards.ts`)
Write an automated Supabase script that populates the complete 5 neighborhood parameters into `zone_hazard_profiles` to support live API integrations.

### B. BARI Standards Knowledge Seeder (`scripts/seed-data.ts`)
Seed the organic database schemas (`compliance_knowledge_base`) with standard guidelines to support the vector RAG semantic search features:
* **EM-1 Fermentation Standard:** Ambient heat exposure limits, pathologically optimal pH boundaries (`3.5 - 4.2`).
* **Soil Carbon Stabilization Standard:** Solid woody feedstock conversion requirements.

### C. Prophet-style Demand Visualizer Dataset (`public/demand-forecast-mock.json`)
Construct a high-fidelity 30-day forecast dataset containing `date`, `base_demand`, `adjusted_demand`, `temperature`, and informative `annotations` mapping UHI extreme heat wave events.

---

## 🛡️ CRITICAL VERIFICATION CHECKLIST FOR PUNAM
* [ ] **Strict Schema Compliance:** Ensure PostgreSQL tables `zone_microclimate_profiles`, `zone_hazard_profiles`, `microclimate_readings`, and `dispatch_exposure_logs` perfectly match Section 1.
* [ ] **Seeding Completeness:** Validate that running `npm run seed:hazards` correctly populates the database and handles conflict resolution (`ON CONFLICT (zone) DO UPDATE`).
* [ ] **TypeScript Type-Safety:** Guarantee that no fields utilize `any`. Create and export clear TS Interfaces (`MicroclimateProfile`, `MicroclimateCalculation`, `DVSResult`, `ESGMetrics`) across all services.
* [ ] **Verification of Equations:** Execute internal unit tests on `calculateTST` and `calculateSME_ESGMetrics` to verify zero float rounding issues. Confirm TST matches the expected 1,700 minutes for the Old Dhaka peak solar test case.
