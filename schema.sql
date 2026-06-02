-- Enable semantic search vector and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users & Multi-Tenant Identities
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('processor', 'buyer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Refresh token storage for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address TEXT
);

-- 2. Organic Material Refining Batches
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    feedstock_type VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    weight_kg NUMERIC(10,2) DEFAULT 0,
    packaging_type VARCHAR(50) DEFAULT 'Standard',
    destination_zone VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'certified', 'dispatched', 'delivered')),
    trust_score INT NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
    certificate_url VARCHAR(500),
    qr_code_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Live IoT Sensor Intake Readings
CREATE TABLE IF NOT EXISTS iot_readings (
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
CREATE TABLE IF NOT EXISTS zone_microclimate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL UNIQUE,
    uhi_offset NUMERIC(4,2) NOT NULL,
    building_density NUMERIC(4,2) NOT NULL,
    vegetation_fraction NUMERIC(4,2) NOT NULL,
    wind_corridor_factor NUMERIC(4,2) NOT NULL,
    thermal_mass_coefficient NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4b. Live Neighborhood Hazard Profiles (Used in TST)
CREATE TABLE IF NOT EXISTS zone_hazard_profiles (
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

-- 4c. Microclimate Logged Calculation Readings
CREATE TABLE IF NOT EXISTS microclimate_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) REFERENCES zone_microclimate_profiles(zone) ON DELETE CASCADE,
    base_temp NUMERIC(5,2) NOT NULL,            -- Live regional temperature from API
    wind_speed NUMERIC(5,2) NOT NULL,           -- Live regional wind speed from API
    solar_factor NUMERIC(4,2) NOT NULL,          -- Diurnal solar hour factor
    adjusted_temp NUMERIC(5,2) NOT NULL,         -- Calculated microclimate temperature
    thermal_risk NUMERIC(3,2) NOT NULL,          -- Calculated thermal degradation risk
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4d. Community-Sourced Microclimate Observations (Voice Reports)
CREATE TABLE IF NOT EXISTS community_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observer_id UUID REFERENCES users(id),
    zone VARCHAR(50) NOT NULL,
    reported_condition VARCHAR(50) NOT NULL, -- 'extreme_heat', 'moderate', 'cool', 'rain'
    notes TEXT,
    validated BOOLEAN DEFAULT false,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Product Marketplace Directory
CREATE TABLE IF NOT EXISTS products (
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

-- 6. Dynamic Dispatch Shipping Allocations / Exposure Tracking Logs
CREATE TABLE IF NOT EXISTS dispatch_exposure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    zone VARCHAR(50) NOT NULL,
    packaging_type VARCHAR(30) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    calculated_survival_time_minutes INT NOT NULL,
    exposure_risk_level VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Dynamic Dispatch Shipping Allocations (Scheduler)
CREATE TABLE IF NOT EXISTS dispatch_schedules (
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

-- 8. Platform Orders & Settlement
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    total_bdt INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. ESG & Sustainability Performance Reporting
CREATE TABLE IF NOT EXISTS esg_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    spoilage_prevented_bdt INT NOT NULL,
    plastic_offset_kg INT NOT NULL,
    carbon_sequestered_kg INT NOT NULL,
    report_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Knowledge Base Vector Indexes for BARI Context
CREATE TABLE IF NOT EXISTS compliance_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    standard_name VARCHAR(255) NOT NULL,
    document_chunk TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Trust Score Calculation Logs (For diagnostic tracking)
CREATE TABLE IF NOT EXISTS trust_score_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ph NUMERIC(4,2) NOT NULL,
    ec NUMERIC(4,2) NOT NULL,
    temperature NUMERIC(5,2) NOT NULL,
    em1_ratio NUMERIC(8,6) NOT NULL,
    fermentation_days INT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    grade VARCHAR(2) NOT NULL,
    is_viable BOOLEAN NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Granular ESG Metrics (For green SMEs and audit trails)
CREATE TABLE IF NOT EXISTS esg_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    e_score INT NOT NULL,
    s_score INT NOT NULL,
    g_score INT NOT NULL,
    esg_score INT NOT NULL,
    plastic_offset_kg INT NOT NULL,
    carbon_sequestered_kg INT NOT NULL,
    water_saved_l INT NOT NULL,
    waste_reduced_kg INT NOT NULL,
    spoilage_prevented_bdt INT NOT NULL,
    trust_score INT NOT NULL,
    dvs_score INT NOT NULL,
    month VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Knowledge Base Text Search for BARI Context
CREATE TABLE IF NOT EXISTS bari_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Climate Delivery Viability Score Calculation Logs
CREATE TABLE IF NOT EXISTS dvs_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(50) NOT NULL,
    ambient_temperature NUMERIC(5,2) NOT NULL,
    solar_hour INT NOT NULL,
    trust_score INT NOT NULL,
    dvs_score NUMERIC(5,2) NOT NULL,
    delivery_approved BOOLEAN NOT NULL,
    tst_minutes NUMERIC(6,2) NOT NULL,
    hazard_class VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. BARI RAG Assistant Query Logs
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    language VARCHAR(5) NOT NULL,
    answer TEXT NOT NULL,
    tokens_used INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Agentic Chatbot Interaction Logs
CREATE TABLE IF NOT EXISTS agent_interaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    farmer_id VARCHAR(100),
    message TEXT NOT NULL,
    intent VARCHAR(50) NOT NULL,
    response_type VARCHAR(50) NOT NULL,
    language VARCHAR(5) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing optimizations for High-Velocity Query performance
CREATE INDEX IF NOT EXISTS idx_batches_number ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_iot_readings_batch ON iot_readings(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_scores ON products(trust_score, dvs);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Enable Row-Level Security (RLS) policies
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Base Public RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to active batches' AND tablename = 'batches'
    ) THEN
        CREATE POLICY "Allow public read access to active batches" 
        ON batches FOR SELECT TO public USING (true);
    END IF;
END
$$;
