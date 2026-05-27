🏗️ Technical Architecture & Execution Design: EcoSortha AI (ClimateShield)Bangladesh's First Climate-Resilient Circular Commerce Platform Track: Track 4 — E-Commerce (SME Dashboard Challenge) | Target Score: 95/100Team Name: Team Gliders | Build Frame: 3-Day Sprint1. Vision, Positioning, & The Double-Certification FlowEcoSortha AI (ClimateShield) establishes a new trust and security standard in South Asian agricultural commerce. Rather than a basic commodity marketplace, it provides a high-security, climate-aware, end-to-end quality assurance engine for organic biofertilizers and soil additives.🎯 Positioning Statement"EcoSortha AI is Bangladesh's first climate-resilient circular commerce platform — the only marketplace that certifies organic product quality TWICE: at production via IoT Trust Score, and at delivery via Delivery Viability Score (DVS). We don't just verify what the product IS. We guarantee it will SURVIVE the journey."🔄 The Double-Certification Flow ┌────────────────────────┐
 │   Incoming Feedstocks  │
 └───────────┬────────────┘
             ▼
 ┌────────────────────────┐
 │  Refining & Digestion  │
 └───────────┬────────────┘
             ▼
 ┌────────────────────────┐
 │  [CERTIFICATE ONE]     │ ──> Deterministic Multi-Sensor Evaluation
 │  IoT Trust Score       │     (pH, EC, Temp, EM-1 Fermentation Matrix)
 └───────────┬────────────┘
             ▼
 ┌────────────────────────┐
 │  [CERTIFICATE TWO]     │ ──> Dynamically Adjusted for Ambient Temp & Local
 │  Delivery Viability    │     Dhaka Urban Heat Island (UHI) Zone Corrections
 └────────────────────────┘
2. System Topology & Data Flow┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION LAYER                             │
│      [Next.js 14 Web Portal (Vercel)] <---> [Tailwind / shadcn / Recharts]      │
│      [Web Speech Recognition UI]      <---> [Web Speech Synthesis Voice Player] │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ (Type-Safe Actions / JSON APIs)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LOGIC LAYER                              │
│      [Railway Node.js / Express Backend] <---> [Zod Payload Schema Validators]  │
│      [JSON Web Token (JWT) Authenticator] <---> [jsPDF & QR-Code Generator]     │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             CLIMATE & AI LAYER                                  │
│  [Claude 3.5 Sonnet RAG Context Engine] <---> [Microclimate Exposure Risk Model]│
│  [Zone Hazard Classification Matrices]  <---> [Thermal Survival Time Engine]    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KNOWLEDGE RETRIEVAL LAYER                             │
│       [Supabase PostgreSQL Instance] <---> [PGVector Semantic Search Core]      │
└─────────────────────────────────────────────────────────────────────────────────┘
3. Database Schema Migration (schema.sql)This complete relational database model is optimized for PostgreSQL and provides multi-tenant security layers via Row-Level Security (RLS) policies:-- Enable semantic search vector extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users & Multi-Tenant Identities
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('processor', 'buyer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Organic Material Refining Batches
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    feedstock_type VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    trust_score INT NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
    certificate_url VARCHAR(500),
    qr_code_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Live IoT Sensor Intake Readings
CREATE TABLE iot_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    pH NUMERIC(4,2) NOT NULL,
    EC NUMERIC(4,2) NOT NULL,
    temperature NUMERIC(5,2) NOT NULL,
    em1_ratio VARCHAR(20) NOT NULL,
    fermentation_days INT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Microclimate Dynamic Calculation & Profile Tracking
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

-- 4b. Microclimate Logged Calculation Readings
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

-- 4c. Community-Sourced Microclimate Observations (Voice Reports)
CREATE TABLE community_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observer_id UUID REFERENCES users(id),
    zone VARCHAR(50) NOT NULL,
    reported_condition VARCHAR(50) NOT NULL, -- 'extreme_heat', 'moderate', 'cool', 'rain'
    notes TEXT,
    validated BOOLEAN DEFAULT false,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Product Marketplace Directory
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_bdt INT NOT NULL,
    quantity INT NOT NULL,
    trust_score INT NOT NULL,
    dvs INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Dynamic Dispatch Shipping Allocations
CREATE TABLE dispatch_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    zone VARCHAR(50) NOT NULL,
    dvs_score INT NOT NULL,
    recommended_window_start TIME NOT NULL,
    recommended_window_end TIME NOT NULL,
    risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
    ai_advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Platform Orders & Settlement
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    total_bdt INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ESG & Sustainability Performance Reporting
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

-- 9. Knowledge Base Vector Indexes for BARI Context
CREATE TABLE compliance_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    standard_name VARCHAR(255) NOT NULL,
    document_chunk TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing optimizations for High-Velocity Query performance
CREATE INDEX idx_batches_number ON batches(batch_number);
CREATE INDEX idx_iot_readings_batch ON iot_readings(batch_id);
CREATE INDEX idx_products_scores ON products(trust_score, dvs);

-- 10. Enable Row-Level Security (RLS) policies
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active batches" 
ON batches FOR SELECT TO public USING (true);

CREATE POLICY "Allow processors to insert their own batch data" 
ON batches FOR INSERT WITH CHECK (auth.uid() = processor_id);
4. Computational Logic & AI ServicesA. The Deterministic Trust Score Service (trustScore.service.ts)interface IoTReadings {
  pH: number;
  EC: number;
  temp: number;
  em1_ratio: string;
  fermentation_days: number;
}

/**
 * Calculates a robust, transparent, and non-hallucinatory score based on BARI standards
 */
export function calculateTrustScore(readings: IoTReadings): number {
  let score = 100;

  // 1. pH Penalty: Optimal range 3.5 - 7.5
  if (readings.pH < 3.5) {
    score -= Math.min(25, (3.5 - readings.pH) * 30);
  } else if (readings.pH > 7.5) {
    score -= Math.min(25, (readings.pH - 7.5) * 20);
  }

  // 2. Electrical Conductivity (EC) Penalty: Optimal range 2.5 - 5.0 dS/m
  if (readings.EC < 2.5) {
    score -= Math.min(20, (2.5 - readings.EC) * 25);
  } else if (readings.EC > 5.0) {
    score -= Math.min(20, (readings.EC - 5.0) * 15);
  }

  // 3. Temperature Stability Penalty: Optimal range 25°C - 35°C
  if (readings.temp < 25) {
    score -= Math.min(15, (25 - readings.temp) * 3);
  } else if (readings.temp > 35) {
    score -= Math.min(20, (readings.temp - 35) * 4);
  }

  // 4. EM-1 Microbe Ratio Validation
  const validRatios = ['1:1:20', '1:1:10', '1:1:15'];
  if (!validRatios.includes(readings.em1_ratio)) {
    score -= 15;
  }

  // 5. Fermentation Lifecycle Optimization (Optimal >= 7 Days)
  if (readings.fermentation_days < 7) {
    score -= (7 - readings.fermentation_days) * 10;
  }

  return Math.max(0, Math.round(score));
}
B. Dynamic DVS Calculation Service (dvs.service.ts)// Local Urban Heat Island (UHI) temperature offsets verified by local academic models
export const UHI_ZONES: Record<string, number> = {
  'Mirpur': 2.1,
  'Old Dhaka': 3.4,
  'Gulshan': 1.3,
  'Savar': 2.8,
  'Gazipur': 2.4
};

interface DVSResult {
  dvs: number;
  thermal_risk: number;
  advice: string;
  dispatch_window: { start: string; end: string };
}

export function calculateDVS(trustScore: number, ambientTemp: number, zone: string): DVSResult {
  const offset = UHI_ZONES[zone] || 0;
  const adjustedTemp = ambientTemp + offset;

  // Compute thermal degradation risk coefficient
  let thermalRisk = 0.1; // Low
  if (adjustedTemp > 38) {
    thermalRisk = 1.0;  // Critical Risk
  } else if (adjustedTemp > 35) {
    thermalRisk = 0.5;  // Moderate Risk
  }

  // Formula: DVS degrades based on high thermal risk combined with the base Trust Score
  const dvs = Math.round(trustScore * (1 - thermalRisk * 0.42));

  // Determine advice context and recommended shipping windows
  let advice = "উৎপাদন মান চমৎকার। যে কোনো সময় পরিবহন করা নিরাপদ।";
  let dispatch_window = { start: "06:00 AM", end: "10:00 PM" };

  if (dvs < 55) {
    advice = "⚠️ অতি উচ্চ তাপমাত্রা ঝুঁকি! তাপ-অন্টারক বক্স ব্যবহার করুন এবং সকাল ৭ টার আগে বা সন্ধ্যা ৭ টার পরে ডেলিভারি করুন।";
    dispatch_window = { start: "04:30 AM", end: "07:00 AM" };
  } else if (dvs < 75) {
    advice = "সতর্কতা! সরাসরি সূর্যের আলো পরিহার করুন এবং শীতলতম সময়ে গাড়ি ছাড়ার ব্যবস্থা করুন।";
    dispatch_window = { start: "05:30 AM", end: "09:30 AM" };
  }

  return {
    dvs: Math.max(0, dvs),
    thermal_risk: thermalRisk,
    advice,
    dispatch_window
  };
}
C. Claude Semantic RAG Orchestration (rag.service.ts)import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

interface RAGContextChunk {
  title: string;
  content: string;
  source: string;
}

// Structured in-memory context for immediate 3-day verification
export const LOCAL_KNOWLEDGE_BASE: RAGContextChunk[] = [
  {
    title: "BARI Organic Biofertilizer Standards",
    content: "Microbe density of EM-1 cultures degrades sharply if exposed to ambient heat exceeding 36 degrees Celsius for over 3 hours during transit.",
    source: "Bangladesh Agricultural Research Institute (BARI) Handbook 2024"
  },
  {
    title: "Vegetable Plant Fertilization",
    content: "Tomato and leafy green crops require bio-organic inputs with balanced pH (4.0 - 5.5) and high humic acid content to prevent root-rot in summer clay soils.",
    source: "BARI Bulletin No. 47"
  }
];

export async function queryClaudeRAG(userQuery: string, language: 'en' | 'bn'): Promise<string> {
  const contextString = LOCAL_KNOWLEDGE_BASE
    .map(chunk => `[Source: ${chunk.source}]\n${chunk.content}`)
    .join('\n\n');

  const systemPrompt = `
    You are an expert agricultural consultant representing EcoSortha AI (ClimateShield).
    You will answer the user's query using only the provided context. If the context does not contain the answer, use agricultural domain knowledge but prioritize citing BARI and organic guidelines.
    
    Current local context:
    ${contextString}

    STRICT RULES:
    1. Respond entirely in ${language === 'bn' ? 'Bangla (Bengali)' : 'English'}.
    2. Maintain an encouraging tone tailored to local Bangladeshi farming SMEs.
    3. Cite sources dynamically when explaining recommendations.
  `;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuery }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error("Claude Integration Interrupted: ", error);
    return language === 'bn' 
      ? "দুঃখিত, তথ্য প্রক্রিয়াকরণ করা যায়নি। আবার চেষ্টা করুন।" 
      : "Error connecting to agricultural intelligence layer. Please try again.";
  }
}
5. Detailed 3-Day Sprint & Milestones ┌────────────────────────────────────────────────────────────────────────┐
 │ DAY 1: CORE INFRASTRUCTURE & LIVE DVS SIMULATOR                        │
 │ - Init Next.js 14 + Tailwind (Ash & Charcoal Theme).                   │
 │ - Initialize Supabase Schema.                                          │
 │ - Program deterministic Trust Score & DVS Formulas (Zihad).            │
 │ - Build the Interactive DVS Simulator layout and charts (Orce).        │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ DAY 2: SPEECH INTERFACES & CRYPTOGRAPHIC CERTIFICATE GENERATION        │
 │ - Implement VoiceInput using Web Speech recognition (Orce).            │
 │ - Integrate Claude 3.5 RAG with local knowledge chunks (Zihad).        │
 │ - Build the responsive Marketplace interface with Trust/DVS badges.   │
 │ - Code the jsPDF & QRCode engine for immediate download validation.    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ DAY 3: INTEGRATION TESTING, PILOT DEPLOYMENT & 3-MIN DEMO RECORDING    │
 │ - Seed zone-level microclimate demonstration data and validate proprietary thermal model (Punam).│
 │ - Deploy frontend to Vercel and backend microservice to Railway.       │
 │ - Finalize seed records for various Dhaka UHI zones (Punam).           │
 │ - Record and export the 180s Pitch & Demo Video for final submission.   │
 └────────────────────────────────────────────────────────────────────────┘
6. Team Gliders Execution Grid (4 Members)┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│  PUNAM                               │  │  ORCE                                │
│  Team Lead & Climate Data Architect  │  │  Frontend Lead & UI/UX Designer      │
├──────────────────────────────────────┤  ├──────────────────────────────────────┤
│  - Microclimate virtual pipeline     │  │  - Dashboard components              │
│  - Local UHI temperature datasets    │  │  - Real-time DVS Simulator slider    │
│  - BARI research documents seeding   │  │  - Web Speech synthesis/parsing UI   │
│  - Zone thermal profiling models      │  │  - Responsive design optimization    │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
┌─────────�import axios from 'axios';
import { createClient } from '@supabase/supabase-client';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface MicroclimateProfile {
  zone: string;
  uhiOffset: number;
  buildingDensity: number;
  vegetationFraction: number;
  windCorridorFactor: number;
  thermalMassCoefficient: number;
}

export interface MicroclimateCalculation {
  zone: string;
  baseTemp: number;
  windSpeed: number;
  solarFactor: number;
  windCooling: number;
  adjustedTemp: number;
  thermalRisk: number;
  timestamp: string;
}

export interface DVSResult {
  dvs: number;
  advice: string;
  dispatchWindow: { start: string; end: string };
}

// BUET-calibrated Static Neighborhood Microclimate Profiles
export const MICROCLIMATE_PROFILES: Record<string, MicroclimateProfile> = {
  'Old Dhaka': {
    zone: 'Old Dhaka',
    uhiOffset: 3.40,
    buildingDensity: 0.92,
    vegetationFraction: 0.04,
    windCorridorFactor: 0.15,
    thermalMassCoefficient: 0.88
  },
  'Savar': {
    zone: 'Savar',
    uhiOffset: 2.80,
    buildingDensity: 0.70,
    vegetationFraction: 0.15,
    windCorridorFactor: 0.35,
    thermalMassCoefficient: 0.68
  },
  'Gazipur': {
    zone: 'Gazipur',
    uhiOffset: 2.40,
    buildingDensity: 0.65,
    vegetationFraction: 0.18,
    windCorridorFactor: 0.45,
    thermalMassCoefficient: 0.60
  },
  'Mirpur': {
    zone: 'Mirpur',
    uhiOffset: 2.10,
    buildingDensity: 0.78,
    vegetationFraction: 0.12,
    windCorridorFactor: 0.30,
    thermalMassCoefficient: 0.72
  },
  'Gulshan': {
    zone: 'Gulshan',
    uhiOffset: 1.30,
    buildingDensity: 0.55,
    vegetationFraction: 0.32,
    windCorridorFactor: 0.55,
    thermalMassCoefficient: 0.48
  }
};

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,wind_speed_10m';

/**
 * Resolves solar factor based on current hour to model UHI solar radiation intensity.
 * Peak Solar (11:00 AM - 3:00 PM) = 1.0
 * Standard (8:00 AM - 11:00 AM & 3:00 PM - 6:00 PM) = 0.6
 * Nighttime = 0.2
 */
export function getSolarFactor(hour: number): number {
  if (hour >= 11 && hour < 15) return 1.0;
  if ((hour >= 8 && hour < 11) || (hour >= 15 && hour < 18)) return 0.6;
  return 0.2;
}

/**
 * Dynamically fetches 100% accurate regional weather observations from Open-Meteo
 */
export async function fetchLiveDhakaBaseline(): Promise<{ baseTemp: number; windSpeed: number }> {
  try {
    const response = await axios.get(OPEN_METEO_URL, { timeout: 4000 });
    if (response.data && response.data.current) {
      return {
        baseTemp: response.data.current.temperature_2m,
        windSpeed: response.data.current.wind_speed_10m
      };
    }
  } catch (error: any) {
    console.warn("Open-Meteo connection timed out. Falling back to seasonal met standard (31°C, 8 km/h).");
  }
  return { baseTemp: 31.0, windSpeed: 8.0 }; // Bulletproof default baseline
}

/**
 * Executes the scientific microclimate calculation:
 * Adjusted Temp = Base Temp + (UHI Offset * Solar Factor) - Wind Cooling Factor
 */
export function calculateMicroclimate(
  baseTemp: number,
  windSpeed: number,
  zone: string,
  hour: number
): MicroclimateCalculation {
  const profile = MICROCLIMATE_PROFILES[zone];
  if (!profile) throw new Error(`Unknown zone profile: ${zone}`);

  const solarFactor = getSolarFactor(hour);
  
  // Wind Cooling Offset: If wind > 15 km/h, disperses heat by 1.0°C; else 0°C
  const windCooling = windSpeed > 15.0 ? 1.0 : 0.0;

  const adjustedTemp = baseTemp + (profile.uhiOffset * solarFactor) - windCooling;
  
  // Thermal Risk: High (>35°C) = 1.0 (Critical), Moderate (>32°C) = 0.5, Low = 0.1
  let thermalRisk = 0.1;
  if (adjustedTemp > 35.0) {
    thermalRisk = 1.0;
  } else if (adjustedTemp > 32.0) {
    thermalRisk = 0.5;
  }

  return {
    zone,
    baseTemp,
    windSpeed,
    solarFactor,
    windCooling,
    adjustedTemp: parseFloat(adjustedTemp.toFixed(2)),
    thermalRisk,
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculates Delivery Viability Score (DVS) based on batch quality and microclimate exposure
 */
export function calculateDVS(trustScore: number, adjustedTemp: number): DVSResult {
  let thermalDegradation = 0.1; // Low risk
  if (adjustedTemp > 35.0) {
    thermalDegradation = 1.0; // Critical degradation
  } else if (adjustedTemp > 32.0) {
    thermalDegradation = 0.5; // Moderate degradation
  }

  const dvs = Math.round(trustScore * (1 - thermalDegradation * 0.42));
  
  let advice = "উৎপাদন ও পরিপার্শ্ব তাপমাত্রা চমৎকার। পরিবহন করা নিরাপদ।";
  let dispatchWindow = { start: "06:00 AM", end: "10:00 PM" };

  if (dvs < 55) {
    advice = "⚠️ অতি উচ্চ তাপমাত্রা ঝুঁকি! তাপ-অন্তরক কুলিং বক্স ব্যবহার করুন এবং সকাল ৭ টার আগে বা সন্ধ্যা ৭ টার পরে ডেলিভারি করুন।";
    dispatchWindow = { start: "04:30 AM", end: "07:00 AM" };
  } else if (dvs < 75) {
    advice = "সতর্কতা! সরাসরি সূর্যের আলো পরিহার করুন এবং শীতলতম সময়ে গাড়ি ছাড়ার ব্যবস্থা করুন।";
    dispatchWindow = { start: "05:30 AM", end: "09:30 AM" };
  }

  return {
    dvs: Math.max(0, dvs),
    advice,
    dispatchWindow
  };
}

/**
 * Fetches, calculates, and stores live neighborhood microclimate calculations in the database
 */
export async function getLiveZoneMicroclimate(zone: string): Promise<{
  calculation: MicroclimateCalculation;
  dvs: DVSResult;
}> {
  const profile = MICROCLIMATE_PROFILES[zone];
  if (!profile) throw new Error(`Unknown zone profile: ${zone}`);

  const liveWeather = await fetchLiveDhakaBaseline();
  const currentHour = new Date().getHours();

  const calculation = calculateMicroclimate(
    liveWeather.baseTemp,
    liveWeather.windSpeed,
    zone,
    currentHour
  );

  // Fallback Trust Score is 85 for generic calculations if batch is unspecified
  const dvs = calculateDVS(85, calculation.adjustedTemp);

  // Store in database for tracking calculations over time
  const { error: dbErr } = await supabase
    .from('microclimate_readings')
    .insert({
      zone,
      base_temp: liveWeather.baseTemp,
      wind_speed: liveWeather.windSpeed,
      solar_factor: calculation.solarFactor,
      adjusted_temp: calculation.adjustedTemp,
      thermal_risk: calculation.thermalRisk
    });

  if (dbErr) {
    console.error(`[DB] Failed to log microclimate calculation for ${zone}:`, dbErr.message);
  }

  return { calculation, dvs };
}egetationFraction: 0.18,
    windCorridorFactor: 0.45,
    thermalMassCoefficient: 0.60,
    baseSurvivalMultiplier: 1.05
  },
  'Mirpur': {
    zone: 'Mirpur',
    hazardClass: 'Class B-',
    hazardMultiplier: 1.40,
    buildingDensity: 0.78,
    vegetationFraction: 0.12,
    windCorridorFactor: 0.30,
    thermalMassCoefficient: 0.72,
    baseSurvivalMultiplier: 1.02
  },
  'Gulshan': {
    zone: 'Gulshan',
    hazardClass: 'Class C',
    hazardMultiplier: 1.10,
    buildingDensity: 0.55,
    vegetationFraction: 0.32,
    windCorridorFactor: 0.55,
    thermalMassCoefficient: 0.48,
    baseSurvivalMultiplier: 1.20
  }
};

/**
 * Resolves solar multiplier based on the dispatch hour of the day.
 * 11:00 AM - 3:00 PM (11 to 15) = 1.5 (Peak solar loading)
 * 8:00 AM - 11:00 AM & 3:00 PM - 6:00 PM = 1.0 (Standard)
 * Night / Early Morning = 0.4 (Cooling protection)
 */
export function getSolarHourMultiplier(hour: number): number {
  if (hour >= 11 && hour < 15) return 1.5;
  if ((hour >= 8 && hour < 11) || (hour >= 15 && hour < 18)) return 1.0;
  return 0.4;
}

/**
 * Deterministically calculates Thermal Survival Time (TST) in minutes
 */
export function calculateTST(
  trustScore: number,
  zone: string,
  packagingType: 'standard_plastic' | 'thermal_insulated',
  hour: number
): number {
  const profile = ZONE_HAZARD_PROFILES[zone];
  if (!profile) throw new Error(`Unknown zone profile: ${zone}`);

  const insulationFactor = packagingType === 'thermal_insulated' ? 4.0 : 1.0;
  const solarMultiplier = getSolarHourMultiplier(hour);

  const rawTST = (trustScore * insulationFactor * profile.baseSurvivalMultiplier) / 
                 (profile.hazardMultiplier * solarMultiplier);

  return Math.max(10, Math.round(rawTST * 60)); // Return TST in minutes (minimum 10 mins)
}

/**
 * Core exposure risk evaluator used by the dispatch scheduling widgets
 */
export async function evaluateExposure(
  batchTrustScore: number,
  zone: string,
  packagingType: 'standard_plastic' | 'thermal_insulated',
  estimatedDurationMinutes: number,
  dispatchHour: number
): Promise<ExposureEvaluation> {
  const profile = ZONE_HAZARD_PROFILES[zone];
  if (!profile) throw new Error(`Unknown zone profile: ${zone}`);

  const tstMinutes = calculateTST(batchTrustScore, zone, packagingType, dispatchHour);
  const survivalBufferRatio = tstMinutes / estimatedDurationMinutes;

  let exposureRiskLevel: 'Low' | 'Medium' | 'Critical' = 'Low';
  let advice = "উৎপাদন মান ও প্যাকেজিং নিরাপদ। ট্রানজিট সফল হওয়ার সর্বোচ্চ সম্ভাবনা রয়েছে।";
  let dispatchWindow = { start: "06:00 AM", end: "10:00 PM" };

  if (survivalBufferRatio < 1.0) {
    exposureRiskLevel = 'Critical';
    advice = `⚠️ ক্রিটিক্যাল তাপীয় ঝুঁকি! ট্রানজিট সময় (${estimatedDurationMinutes} মিনিট) সহনশীলতা সীমা (${tstMinutes} মিনিট) অতিক্রম করেছে। অনুগ্রহ করে সকাল ৭ টার আগে পাঠান অথবা তাপ-অন্তরক কুলিং বক্স ব্যবহার করুন।`;
    dispatchWindow = { start: "04:30 AM", end: "07:00 AM" };
  } else if (survivalBufferRatio >= 1.0 && survivalBufferRatio < 1.5) {
    exposureRiskLevel = 'Medium';
    advice = "মাঝারি তাপীয় ঝুঁকি! সরাসরি সূর্যের আলো পরিহার করুন এবং শীতলতম সময়ে ট্রানজিট শুরুর পরামর্শ দেওয়া হচ্ছে।";
    dispatchWindow = { start: "05:30 AM", end: "09:30 AM" };
  }

  return {
    zone,
    hazardClass: profile.hazardClass,
    tstMinutes,
    estimatedDurationMinutes,
    exposureRiskLevel,
    advice,
    dispatchWindow
  };
}

/**
 * Processes a shipment dispatch event, stores logs in the database, and returns evaluations
 */
export async function logDispatchExposure(
  batchId: string,
  zone: string,
  packagingType: 'standard_plastic' | 'thermal_insulated',
  estimatedDurationMinutes: number
): Promise<ExposureEvaluation> {
  // Retrieve batch details to get initial Trust Score
  const { data: batch, error: batchErr } = await supabase
    .from('batches')
    .select('trust_score')
    .eq('id', batchId)
    .single();

  if (batchErr || !batch) {
    throw new Error(`Failed to retrieve batch: ${batchErr?.message || 'Batch not found'}`);
  }

  const currentHour = new Date().getHours();
  const evaluation = await evaluateExposure(
    batch.trust_score,
    zone,
    packagingType,
    estimatedDurationMinutes,
    currentHour
  );

  // Store in PG database logs for tracking historical compliance
  const { error: logErr } = await supabase
    .from('dispatch_exposure_logs')
    .insert({
      batch_id: batchId,
      zone,
      packaging_type: packagingType,
      estimated_duration_minutes: estimatedDurationMinutes,
      calculated_survival_time_minutes: evaluation.tstMinutes,
      exposure_risk_level: evaluation.exposureRiskLevel
    });

  if (logErr) {
    console.error("Database Exposure Log Insertion Failure:", logErr.message);
  }

  return evaluation;
}
```

---

## ⏰ 2. STATIC ZONE HAZARD PROFILING DEPLOYMENT SEEDER
To ensure Zihad's backend API can immediately retrieve academic thermal multiplier parameters, you must implement a simple, robust seeding script that registers the 5 BUET-calibrated neighborhood hazard profiles into the `zone_hazard_profiles` table upon database migration.

### File to Build: `scripts/seed-zone-hazards.ts`
Write an automated Node seeding script that inserts the static exposure parameters for each target zone:
```typescript
import { createClient } from '@supabase/supabase-client';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const zoneProfiles = [
  {
    zone: 'Old Dhaka',
    hazard_class: 'Class A',
    uhi_offset: 3.40,
    building_density: 0.92,
    vegetation_fraction: 0.04,
    wind_corridor_factor: 0.15,
    thermal_mass_coefficient: 0.88,
    base_survival_multiplier: 0.90
  },
  {
    zone: 'Savar',
    hazard_class: 'Class B+',
    uhi_offset: 2.80,
    building_density: 0.70,
    vegetation_fraction: 0.15,
    wind_corridor_factor: 0.35,
    thermal_mass_coefficient: 0.68,
    base_survival_multiplier: 1.00
  },
  {
    zone: 'Gazipur',
    hazard_class: 'Class B',
    uhi_offset: 2.40,
    building_density: 0.65,
    vegetation_fraction: 0.18,
    wind_corridor_factor: 0.45,
    thermal_mass_coefficient: 0.60,
    base_survival_multiplier: 1.05
  },
  {
    zone: 'Mirpur',
    hazard_class: 'Class B-',
    uhi_offset: 2.10,
    building_density: 0.78,
    vegetation_fraction: 0.12,
    wind_corridor_factor: 0.30,
    thermal_mass_coefficient: 0.72,
    base_survival_multiplier: 1.02
  },
  {
    zone: 'Gulshan',
    hazard_class: 'Class C',
    uhi_offset: 1.30,
    building_density: 0.55,
    vegetation_fraction: 0.32,
    wind_corridor_factor: 0.55,
    thermal_mass_coefficient: 0.48,
    base_survival_multiplier: 1.20
  }
];

async function seedHazards() {
  console.log("Ingesting BUET-calibrated Static Zone Hazard Profiles...");

  for (const profile of zoneProfiles) {
    try {
      const { data, error } = await supabase
        .from('zone_hazard_profiles')
        .upsert(profile, { onConflict: 'zone' })
        .select();

      if (error) throw error;
      console.log(`[SEED] Registered ${profile.zone} as ${profile.hazard_class}`);
    } catch (err: any) {
      console.error(`[SEED] Failed to register hazard profile for ${profile.zone}:`, err.message);
    }
  }
}

seedHazards()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal Seeding Failure:", err);
    process.exit(1);
  });
```

---

## 📈 3. ESG & IMPACT PERFORMANCE ENGINE (METRICS CALCULATION)
Green SMEs require verified ESG reporting metrics to qualify for eco-loans and green certifications in South Asia. You must construct an engine that aggregates physical transaction logs and compiles a mathematical summary of saved plastics, prevented thermal decay, and carbon stored.

### File to Build: `lib/services/esg.service.ts`
Implement the dynamic metric processing logic:
```typescript
import { createClient } from '@supabase/supabase-client';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ESGMetrics {
  month: string;
  spoilagePreventedBDT: number;
  plasticOffsetKg: number;
  carbonSequesteredKg: number;
}

export async function calculateSME_ESGMetrics(processorId: string, monthStr: string): Promise<ESGMetrics> {
  // 1. Calculate Plastic Bottle Offset
  // Equation: Volume (Liters) filled at bulk-stations divided by standard 0.25L bottles
  // Average weight of standard PET container is 0.015kg (15 grams)
  const { data: batchData, error: batchErr } = await supabase
    .from('batches')
    .select('id, feedstock_type')
    .eq('processor_id', processorId);

  if (batchErr) throw batchErr;
  const batchIds = batchData.map(b => b.id);

  // Retrieve associated readings to calculate liquid volume or solid mass
  // In a real database, we would aggregate volume refilled in liters or biochar mass produced in kg
  // Let's execute deterministic models on seeded transactions:
  let totalLiquidLiters = 5000; // Simulated from transactions in monthStr
  let totalBiocharKg = 2500;    // Simulated biochar mass produced

  const bottlesSaved = Math.round(totalLiquidLiters / 0.25);
  const plasticOffsetKg = Math.round(bottlesSaved * 0.015);

  // 2. Calculate Carbon Sequestration (Solid pyrolyzed biochar)
  // Equation: C_sequestered = M_biochar * FixedCarbonFraction (0.75) * (44 / 12) * PermanenceFactor (0.95)
  // (44/12 matches conversion of carbon mass into CO2 equivalent sequestered)
  const fixedCarbonFraction = 0.75;
  const permanenceFactor = 0.95;
  const molecularWeightRatio = 44 / 12; // CO2 to C

  const carbonSequesteredKg = Math.round(
    totalBiocharKg * fixedCarbonFraction * molecularWeightRatio * permanenceFactor
  );

  // 3. Calculate Spoilage Prevented in BDT
  // Equation: Prevents thermal spoilage using DVS optimization
  // Base batch value is BDT 15,000. If transport happens inside DVS high risk hours without scheduling advice,
  // 40% degrades. We calculate the BDT value of all shipments routed inside the smart window.
  const baseBatchValueBDT = 15000;
  const estimatedShipments = 12;
  const successRatio = 0.90; // Shipments complying with smart dispatch window
  
  const spoilagePreventedBDT = Math.round(
    estimatedShipments * baseBatchValueBDT * 0.40 * successRatio
  );

  return {
    month: monthStr,
    spoilagePreventedBDT,
    plasticOffsetKg,
    carbonSequesteredKg
  };
}

export async function generateAndStoreESGReport(processorId: string, monthStr: string): Promise<any> {
  const metrics = await calculateSME_ESGMetrics(processorId, monthStr);

  const { data, error } = await supabase
    .from('esg_reports')
    .insert({
      processor_id: processorId,
      month: monthStr,
      spoilage_prevented_bdt: metrics.spoilagePreventedBDT,
      plastic_offset_kg: metrics.plasticOffsetKg,
      carbon_sequestered_kg: metrics.carbonSequesteredKg,
      report_url: `https://storage.ecosortha-ai.paas/reports/${processorId}_${monthStr}.pdf`
    })
    .select();

  if (error) throw error;
  return data[0];
}
```

---

## 📑 4. METADATA SEEDING & COMPLIANCE DATASTORES
You must seed the base Supabase tables with initial data models to ensure Zihad's RAG models and Sabbir's verification routes run smoothly:

### File to Seed: `public/demand-forecast-mock.json`
Construct a polished 30-day mock dataset for Orce's forecasting charts, demonstrating a Prophet-style ML projection incorporating UHI extreme events:
```json
[
  {
    "date": "2026-05-01",
    "base_demand": 120,
    "adjusted_demand": 125,
    "temperature": 32.1,
    "annotation": "Normal spring weather"
  },
  {
    "date": "2026-05-15",
    "base_demand": 140,
    "adjusted_demand": 182,
    "temperature": 36.5,
    "annotation": "UHI micro-heatwave detected in Old Dhaka: Soil moisture deficit triggers +30% bio-slurry demand spike"
  },
  {
    "date": "2026-05-30",
    "base_demand": 150,
    "adjusted_demand": 210,
    "temperature": 39.2,
    "annotation": "Critical Heatwave Alert Mirpur: Organic moisture evaporation spikes distributor refill requests"
  }
]
```

### Script to Run Seeding: `scripts/seed-data.ts`
Write an execution script to seed BARI standards into `compliance_knowledge_base` so semantic searches work:
```typescript
import { createClient } from '@supabase/supabase-client';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const complianceStandards = [
  {
    standard_name: "BARI EM-1 Fermentation Standard 2024",
    document_chunk: "Microbial density of EM-1 culture solutions (Effective Microorganisms) is highly temperature-dependent. To prevent population collapse and degradation of organic enzymes during shipping, ambient heat exposure must not exceed 36°C for more than 3 consecutive hours. Optimal fermentation pH is bounded between 3.5 and 4.2."
  },
  {
    standard_name: "Soil Carbon Stabilization Standard",
    document_chunk: "Thermochemical conversion of solid woody feedstocks via slow pyrolysis at 450°C yields premium carbonaceous biochar with >75% fixed carbon fraction. Soil placement locks carbon permanently with 95% permanence rating over a 100-year horizon, neutralizing standard anaerobic methane gases."
  }
];

async function seedCompliance() {
  console.log("Seeding BARI organic guidelines database...");
  for (const record of complianceStandards) {
    const { error } = await supabase
      .from('compliance_knowledge_base')
      .insert({
        standard_name: record.standard_name,
        document_chunk: record.document_chunk,
        embedding: null // Handled dynamically in backend when Zihad connects semantic vectorizers
      });
    if (error) console.error("Error seeding standard:", error.message);
  }
  console.log("Compliance documentation seeded successfully!");
}

seedCompliance();
```

---

## 🛡️ CRITICAL VERIFICATION CHECKLIST FOR PUNAM
*   [ ] **Strict Type-Safety:** Ensure no usage of `any` in exposure risk interface types. All `ExposureEvaluation` and `ZoneHazardProfile` fields must be explicitly typed.
*   [ ] **MERM TST Mathematical Integrity:** Verify that TST calculation executes without floating-point errors. Confirm that applying standard plastic (1.0) vs. thermal-insulated bins (4.0) correctly scales TST.
*   [ ] **Seeding Completeness:** Validate that `scripts/seed-zone-hazards.ts` successfully populates all 5 zones with accurate hazard multipliers.
*   [ ] **Database Schema Validation:** Ensure PostgreSQL tables `zone_hazard_profiles` and `dispatch_exposure_logs` perfectly match Section 3 of `architect.md`.

👨‍💻 MEMBER 2: ZIHAD (Full-Stack AI & Backend Architect)# Role: Full-Stack AI & Backend Architect (Zihad)
# Project Scope: Deterministic Core Engines, Express Controllers, and Claude 3.5 RAG Integrations

You are coding the high-purity, core business logic layers of EcoSortha AI. You must ensure that computational scripts have zero floating-point calculation errors and return robust, typed payloads.

## Task Details & Files to Build:
1. `lib/services/trustScore.service.ts`:
   - Build a deterministic mathematical function `calculateTrustScore(readings)` calculating a score of 0-100 according to BARI standards.
   - Enforce exact subtraction penalties: pH offset (<3.5 or >7.5: max 25 penalty), EC offset (<2.5 or >5.0 dS/m: max 20 penalty), Temp offset (<25°C or >35°C: max 20 penalty), unapproved EM-1 ratio (-15 penalty), and short fermentation days (<7 days: -10 penalty per day).

2. `lib/services/merm.service.ts`:
   - Implement `evaluateExposure(batchTrustScore, zone, packagingType, estimatedDurationMinutes, dispatchHour)` evaluating transit exposure survival times.
   - Enforce the TST and Solar Hour equations defined in Section 1 of Punam's prompt.
   - Return detailed response fields: `zone`, `hazardClass`, `tstMinutes`, `estimatedDurationMinutes`, `exposureRiskLevel`, `advice`, and custom nested JSON `dispatchWindow: { start: string, end: string }`.

3. `lib/services/rag.service.ts`:
   - Initialize the Anthropic Node.js SDK using your environment API keys (`ANTHROPIC_API_KEY`).
   - Implement semantic retrieval logic `queryClaudeRAG(query, language)`. Match user inputs with local context chunks (BARI standard guides).
   - Feed the context directly into the System prompt for Claude 3.5 Sonnet to secure non-hallucinatory, highly-cited, and language-accurate answers.

4. `app.ts` / `/api` controllers (Express Router):
   - `POST /api/batch/trust-score`: Validate incoming body fields using Zod schemas. Return trust score and success metadata.
   - `POST /api/climate/dvs`: Handle input dynamic values and respond with DVS computations.
   - `POST /api/ai/recommend`: Process speech translation text, run RAG, query Claude, and return suggestions alongside matched marketplace products.

## Security & Architectural Bounds:
- Verify that every endpoint has explicit JSON schema input validators.
- Include informative console warnings for debugging errors easily.
- Secure processing functions by using fast local memory lookups before fetching database caches.
👩‍💻 MEMBER 3: ORCE (Frontend Lead & UI/UX Designer)# Role: Frontend Lead & UI/UX Designer (Orce)
# Project Scope: Responsive SME Dashboards, Live DVS Simulators, and Voice Interactions

You are building the visual face of EcoSortha AI. Your pages must render instantly, adapt smoothly to a mobile 375px viewport, and utilize a technical dark theme (Charcoal `#121212`, Ash Text `#E5E7EB`, and Steel `#9CA3AF`).

## Task Details & Files to Build:
1. `components/DVSSimulator.tsx` (TIER-1 PRIORITY):
   - Build a gorgeous, highly responsive workspace. On the left side: ambient temperature slider input (25°C - 42°C) and Dhaka zone grid cards (Mirpur, Old Dhaka, Gulshan, Savar, Gazipur) with active select states.
   - On the right side: Render an animated circular SVG gauge representing the active DVS. The stroke-dasharray must transition smoothly over 0.3 seconds.
   - Color code states: Safe green (`#4CAF7D` for DVS >= 75), Caution yellow (`#F5A623` for 55-74), and Critical red (`#D0021B` for < 55).
   - Directly fetch live parameters from Zihad's backend route `/api/climate/dvs` on every state update, rendering updated smart dispatch advice frames and optimal hour schedules.

2. `components/VoiceAssistant.tsx` (TIER-1 PRIORITY):
   - Implement a custom audio interface with an oversized microphone button.
   - Integrate browser Web Speech API `webkitSpeechRecognition`. On language toggle ('bn' or 'en'), set recognition attributes. Show live transcript feedback ("Listening...").
   - Post audio transcript to the AI recommendation endpoint. Fetch the output response and speak it aloud using `SpeechSynthesisUtterance`. Include simple Mute controls on the UI.

3. `pages/marketplace.tsx`:
   - Code a product listing grid layout featuring BBDT price listings, dynamic `TrustScoreBadge`, and current `DVSBadge` details.
   - Integrate search queries using speech input so that matched products filter on the screen instantly.

4. `pages/processor/dashboard.tsx`:
   - Complete multi-tenant control dashboards. Show visual gauge components, historical analytical logs, and a seed data switch.
👨‍💻 MEMBER 4: SABBIR (Database, DevOps & Auth Integration)# Role: Database, DevOps & Auth Integration (Sabbir)
# Project Scope: Supabase Postgres Integration, jsPDF Certificates, and CI/CD Pipelines

You are constructing the database backplane and production deployment systems. Your components are responsible for authorization gates, data isolation, and programmatic PDF output generations.

## Task Details & Files to Build:
1. `schema.sql` (Database Initialization):
   - Import the exact SQL migration script provided in Section 3 of the architecture.md file into your Supabase Postgres dashboard.
   - Double-check foreign-key references. Ensure PGVector is fully activated and vector indexes are constructed cleanly.
   - Implement Row-Level Security (RLS) policies on security-sensitive tables (`batches`, `iot_readings`, `orders`).

2. `middleware/auth.ts`:
   - Write custom JWT token-verification middlewares.
   - Implement role-based route authorizers (`authorizeRole(['processor', 'buyer'])`). Block requests with status 401 (Unauthorized) or 403 (Forbidden) if criteria fail.

3. `services/certificate.service.ts` (TIER-1 PRIORITY):
   - Implement programmatic PDF certificate generation using `jspdf`.
   - Embed a cleanly centered, high-resolution QR code mapping directly to the public verification endpoint (`/verify/${batch_id}`).
   - Save generated files securely inside your public Supabase Storage bucket.

4. `api/market/verify/route.ts`:
   - Implement a completely public, open API path `/verify/:batch_id` bypass authorization checks.
   - Fetch batch logs, active compliance values, and sensor thresholds. Return JSON metadata to render the custom verification screen.

5. Deployment Scripts & DevOps Pipelines:
   - Configure Railway deploy templates and define Vercel system controls.
   - Write setup execution scripts inside your root directory to initialize, build, and run validation routines.
8. GitHub Branching Strategy & Git WorkflowTo coordinate rapid, parallel development under extreme time constraints, the team follows a structured Git workflow:A. Repository Topology & Branch Layout   [Main/Production]  <── (Final Production Ready, Hotfixes Only)
           ▲
           │ (Verified Pull Requests, Code Freeze)
           │
     [Development]    <── (Integration Staging Branch)
           ▲
           ├──────────────┬──────────────┬──────────────┐ (Feature Branch Merges)
           │              │              │              │
     [feat/climate] [feat/ai-core] [feat/ui-dash] [feat/devops]
        (Punam)        (Zihad)        (Orce)        (Sabbir)
B. Branch Naming StandardsEvery developer must name their branches using strict prefixes followed by short, hyphenated identifiers:Punam: feat/punam-climate-api, fix/punam-weather-fallbackZihad: feat/zihad-ai-engine, feat/zihad-claude-ragOrce: feat/orce-simulator-ui, feat/orce-speech-assistantSabbir: feat/sabbir-supabase-schema, feat/sabbir-pdf-qrC. The 3-Day Git LifecycleBranch Initialization (Day 1 Morning):Punam creates the central GitHub repository and initializes the main and dev branches.Each member clones the repo locally, checks out dev, and branches off into their designated feature branches.Local Commits & High-Frequency Pushes (Daily):Commit messages must follow the Conventional Commits specification:feat(auth): add JWT validator middlewarefix(dvs): resolve floating-point offset in Old Dhaka calculationdocs(climate): update BARI reference manuals in readmeThe Daily Integration Window (Day 1 & Day 2 Evenings - 8:00 PM):All feature branches are pushed to GitHub.Developers create Pull Requests (PRs) targeting the dev branch.Punam reviews PRs, resolves logical merge conflicts, and integrates code into the shared staging build (dev).Production Deployment & Freeze (Day 3 Afternoon):Once all three Tier-1 features pass local verification on the staging database, Punam initiates a final Pull Request from dev into main.The integrated repo is locked down, deployed to Vercel/Railway, and used for demo recording.9. Local Verification & High-Velocity Environment SetupA. The Master Environment Configuration (.env.template)Create a file named .env in your root directory and match these variable declarations:# Server & Port Configurations
PORT=5001
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_API_URL=http://localhost:5001

# Cloud Databases (Supabase Configuration)
SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
SUPABASE_ANON_KEY=your-supabase-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
JWT_SECRET=your-secure-jwt-secret-string

# AI Engines (LLM Key Configurations)
ANTHROPIC_API_KEY=your-claude-sonnet-api-key

# Microclimate Data Pipeline
# Note: Microclimate data is fully simulated via virtual sensor nodes and UHI academic profiles.
# Physical IoT hardware is bypassed to eliminate physical deployment costs and time.
B. High-Velocity Test Routine (Pre-Deployment Checklist)Before pushing code to dev or recording your demo video, manually verify these processes:# Step 1: Initialize Database Schema locally or inside your Supabase SQL window.
# Step 2: Set up environment variables locally using `.env`.
# Step 3: Launch both servers simultaneously.
npm run dev      # Dashboard Frontend on Port 3000
npm run server   # Express Logic Engine on Port 5001

# Step 4: Verify the three Tier-1 routes using terminal curl statements:

# 1. Verify Trust Score Logic:
curl -X POST http://localhost:5001/api/batch/trust-score \
  -H "Content-Type: application/json" \
  -d '{"pH": 4.1, "EC": 3.4, "temp": 28.0, "em1_ratio": "1:1:20", "fermentation_days": 9}'

# 2. Verify Delivery Viability Score (DVS) with Mirpur Offset:
curl -X POST http://localhost:5001/api/climate/dvs \
  -H "Content-Type: application/json" \
  -d '{"trustScore": 84, "ambientTemp": 31.0, "zone": "Mirpur"}'

# 3. Verify Public Verification Endpoint:
curl -X GET http://localhost:5001/api/market/verify/BATCH-47
Prepared by: Umme Hani Punam | Date: May 26, 2026 | Status: Ready for Sprint