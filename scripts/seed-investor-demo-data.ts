import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createRequire } from 'module';

dotenv.config();

type Json = Record<string, unknown> | unknown[];
type Row = Record<string, unknown>;

const requireFromRoot = createRequire(__filename);
const requireFromBackend = createRequire(path.join(process.cwd(), 'backend', 'package.json'));

function loadPgClient(): any {
  try {
    return requireFromRoot('pg').Client;
  } catch {
    return requireFromBackend('pg').Client;
  }
}

const Client = loadPgClient();

const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY';
const GENESIS_HASH = '0'.repeat(64);
const TOTAL_BATCHES = 10_400;
const CURRENT_YEAR = 2026;

const categories = [
  'Organic Fertilizer',
  'Bio Compost',
  'Vermicompost',
  'Liquid Organic Input',
  'Dairy Product',
  'Packaged Agro Product',
  'Retail Perishable Product',
  'Herbal/Agricultural Input',
  'Manufacturing Raw Input',
];

const zones = [
  'Dhaka',
  'Gazipur',
  'Savar',
  'Mirpur',
  'Gulshan',
  'Old Dhaka',
  'Narayanganj',
  'Tongi',
  'Keraniganj',
];

const rejectionReasons = [
  'Safety Issue',
  'Contamination Found',
  'Labeling Non-compliance',
  'Packaging Failure',
  'Ingredient Mismatch',
  'Other',
];

const packagingTypes = [
  'Sealed demo pouch',
  'Tamper-evident demo jar',
  'Cold-chain demo carton',
  'Moisture barrier demo sack',
  'Recyclable demo crate',
];

const feedstocks = [
  'Market vegetable residue + molasses',
  'Rice husk compost base',
  'Dairy cold-chain sample lot',
  'Neem and herbal input blend',
  'Jute fiber packaging input',
  'Vermicast matured bed',
  'Bio-slurry EM culture',
  'Packaged lentil agro lot',
  'Retail greens cold box',
];

const consumerAgents = [
  'Mozilla/5.0 (Linux; Android 14; DEMO Mobile) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'ClimaLogixDemoScanner/1.0 Android Retail',
  'Mozilla/5.0 (Linux; Android 13; Retail POS Demo) AppleWebKit/537.36 Chrome/122 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
];

function seededNumber(seed: string): number {
  const digest = crypto.createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function uuidFromSeed(seed: string): string {
  const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function hashEvent(prevHash: string, type: string, data: Row, timestamp: string): string {
  return crypto
    .createHash('sha256')
    .update(prevHash)
    .update('|')
    .update(type)
    .update('|')
    .update(canonicalize({ ...data, __ts: timestamp }))
    .digest('hex');
}

function hashMetrics(metrics: Row): string {
  return crypto.createHash('sha256').update(canonicalize(metrics)).digest('hex');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function iso(date: Date): string {
  return date.toISOString();
}

function publicBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:5000'
  ).replace(/\/$/, '');
}

function qrSvgData(batchNumber: string, verifyUrl: string): string {
  const text = `${batchNumber} DEMO QR`;
  const escaped = text.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char] || char));
  const hash = crypto.createHash('sha256').update(verifyUrl).digest();
  const cells = Array.from({ length: 121 }, (_, i) => ((hash[i % hash.length] + i * 17) % 3 === 0 ? '#111827' : '#ffffff'));
  const rects = cells.map((fill, i) => {
    const x = 16 + (i % 11) * 8;
    const y = 16 + Math.floor(i / 11) * 8;
    return `<rect x="${x}" y="${y}" width="8" height="8" fill="${fill}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="176" viewBox="0 0 144 176"><rect width="144" height="176" fill="#fff"/><rect x="10" y="10" width="100" height="100" fill="#fff" stroke="#111827" stroke-width="2"/>${rects}<text x="8" y="134" font-family="Arial" font-size="10" fill="#111827">${escaped}</text><text x="8" y="150" font-family="Arial" font-size="9" fill="#b91c1c">DEMO / NOT OFFICIAL</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function batchStatus(index: number): string {
  if (index <= 7000) return 'approved';
  if (index <= 7500) return 'awaiting_shipment';
  if (index <= 8000) return 'shipped';
  if (index <= 8500) return 'under_review';
  if (index <= 9500) return 'rejected';
  if (index <= 10000) return 'evaluation_failed';
  if (index <= 10150) return 'registered';
  if (index <= 10300) return 'evaluation_passed';
  if (index <= 10350) return 'expired';
  return 'revoked';
}

function categoryExpiryDays(category: string): number {
  if (category === 'Dairy Product') return 14;
  if (category === 'Retail Perishable Product') return 10;
  if (category === 'Packaged Agro Product') return 120;
  if (category === 'Manufacturing Raw Input') return 180;
  return 90;
}

function trustScoreFor(status: string, index: number): number {
  if (status === 'approved' || status === 'expired' || status === 'revoked') return 80 + (index % 20);
  if (status === 'rejected') return 60 + (index % 26);
  if (status === 'evaluation_failed') return 35 + (index % 25);
  return 68 + (index % 25);
}

function eventTypeCompat(type: string): string {
  if (type === 'registered' || type === 'evaluation_passed' || type === 'verification_requested' || type === 'approved' || type === 'rejected' || type === 'qr_generated') return 'qa';
  if (type === 'shipped') return 'dispatched';
  if (type === 'received') return 'delivered';
  return 'qa';
}

function buildProvenance(batchId: string, batchNumber: string, status: string, actor: string, createdAt: Date, extra: Row): Row[] {
  const stepsByStatus: Record<string, string[]> = {
    registered: ['registered'],
    evaluation_failed: ['registered', 'evaluation_failed'],
    evaluation_passed: ['registered', 'evaluation_passed'],
    awaiting_shipment: ['registered', 'evaluation_passed', 'verification_requested'],
    shipped: ['registered', 'evaluation_passed', 'verification_requested', 'shipped'],
    under_review: ['registered', 'evaluation_passed', 'verification_requested', 'shipped', 'received'],
    rejected: ['registered', 'evaluation_passed', 'verification_requested', 'shipped', 'received', 'rejected'],
    approved: ['registered', 'evaluation_passed', 'verification_requested', 'shipped', 'received', 'approved', 'qr_generated'],
    expired: ['registered', 'evaluation_passed', 'verification_requested', 'shipped', 'received', 'approved', 'qr_generated'],
    revoked: ['registered', 'evaluation_passed', 'verification_requested', 'shipped', 'received', 'approved', 'qr_generated', 'revoked'],
  };
  const steps = stepsByStatus[status] || ['registered'];
  let prev = GENESIS_HASH;
  return steps.map((type, seq) => {
    const timestamp = iso(addHours(createdAt, seq * 8 + 1));
    const data = {
      batch_id: batchId,
      batch_number: batchNumber,
      lifecycle_event: type,
      is_demo: true,
      demo_notice: 'Synthetic investor demo provenance event. Not an official government record.',
      ...extra,
    };
    const current = hashEvent(prev, type, data, timestamp);
    const row = {
      batch_id: batchId,
      seq,
      type,
      event_type: eventTypeCompat(type),
      event_data: { seq, type, timestamp, data },
      actor,
      data,
      prev_hash: prev,
      current_hash: current,
      timestamp,
      created_at: timestamp,
      is_demo: true,
    };
    prev = current;
    return row;
  });
}

function sqlJson(value: unknown): string {
  return JSON.stringify(value);
}

async function tableExists(client: any, table: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table],
  );
  return Boolean(result.rows[0]?.exists);
}

async function getColumns(client: any, table: string): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((row: { column_name: string }) => row.column_name));
}

async function columnType(client: any, table: string, column: string): Promise<string | null> {
  const result = await client.query(
    `SELECT udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return result.rows[0]?.udt_name ?? null;
}

async function insertRows(client: any, table: string, rows: Row[], chunkSize = 1000): Promise<void> {
  if (rows.length === 0) return;
  if (!await tableExists(client, table)) return;
  const columns = await getColumns(client, table);
  const keys = Object.keys(rows[0]).filter((key) => columns.has(key));
  if (keys.length === 0) return;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = keys.map((key) => {
        values.push(row[key]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO public.${table} (${keys.map((key) => `"${key}"`).join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }
}

async function upsertRows(client: any, table: string, rows: Row[], conflictColumn: string, chunkSize = 500): Promise<void> {
  if (rows.length === 0) return;
  const columns = await getColumns(client, table);
  const keys = Object.keys(rows[0]).filter((key) => columns.has(key));
  const updateKeys = keys.filter((key) => key !== conflictColumn);
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = keys.map((key) => {
        values.push(row[key]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO public.${table} (${keys.map((key) => `"${key}"`).join(', ')})
       VALUES ${tuples.join(', ')}
       ON CONFLICT ("${conflictColumn}") DO UPDATE SET
       ${updateKeys.map((key) => `"${key}" = EXCLUDED."${key}"`).join(', ')}`,
      values,
    );
  }
}

async function prepareSchema(client: any): Promise<void> {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
      batch_number VARCHAR(100) UNIQUE NOT NULL,
      feedstock_type VARCHAR(100) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      weight_kg NUMERIC(10,2) DEFAULT 0,
      packaging_type VARCHAR(50) DEFAULT 'Standard',
      destination_zone VARCHAR(100),
      status VARCHAR(20) DEFAULT 'registered',
      trust_score NUMERIC NOT NULL DEFAULT 0,
      certificate_url TEXT,
      qr_code_url TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.iot_readings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
      pH NUMERIC(4,2) NOT NULL,
      EC NUMERIC(4,2) NOT NULL,
      temperature NUMERIC(5,2) NOT NULL,
      em1_ratio VARCHAR(20) NOT NULL,
      fermentation_days INT NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price_bdt INT NOT NULL,
      quantity INT NOT NULL,
      trust_score INT NOT NULL,
      dvs INT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.esg_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.esg_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
      month VARCHAR(7) NOT NULL,
      spoilage_prevented_bdt INT NOT NULL,
      plastic_offset_kg INT NOT NULL,
      carbon_sequestered_kg INT NOT NULL,
      report_url VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.product_categories (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      ph_min FLOAT,
      ph_max FLOAT,
      ec_min FLOAT,
      ec_max FLOAT,
      temp_min FLOAT NOT NULL DEFAULT 2,
      temp_max FLOAT NOT NULL DEFAULT 35,
      required_ratio TEXT,
      min_fermentation_days INT NOT NULL DEFAULT 0,
      max_fermentation_days INT NOT NULL DEFAULT 365,
      requires_bsti BOOLEAN NOT NULL DEFAULT false,
      weights JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    DO $$
    DECLARE table_name TEXT;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'users', 'batches', 'iot_readings', 'verification_requests', 'qr_scans',
        'qa_reports', 'provenance_records', 'notifications', 'products', 'orders',
        'order_lifecycle_logs', 'esg_metrics', 'esg_reports', 'dispatch_exposure_logs',
        'dispatch_schedules', 'checkout_orders', 'pending_orders'
      ]
      LOOP
        IF to_regclass('public.' || table_name) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE', table_name);
        END IF;
      END LOOP;
    END $$;

    DO $$
    BEGIN
      IF to_regclass('public.users') IS NOT NULL THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE public.users ADD CONSTRAINT users_role_check
          CHECK (role IN ('processor', 'buyer', 'admin', 'producer', 'consumer', 'sme_owner', 'inspector'));
      END IF;
    END $$;

    ALTER TABLE IF EXISTS public.batches
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS product_type TEXT,
      ADD COLUMN IF NOT EXISTS manufacturer_id UUID,
      ADD COLUMN IF NOT EXISTS producer_id UUID,
      ADD COLUMN IF NOT EXISTS inspector_id UUID,
      ADD COLUMN IF NOT EXISTS sme_owner_id UUID,
      ADD COLUMN IF NOT EXISTS evaluation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS evaluation_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS shipment_token TEXT,
      ADD COLUMN IF NOT EXISTS shipment_dispatched_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inspector_received_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inspector_verdict TEXT,
      ADD COLUMN IF NOT EXISTS verdict_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS inspector_certification_id TEXT,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS qr_image_data TEXT,
      ADD COLUMN IF NOT EXISTS qr_expiry_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS certificate_number TEXT,
      ADD COLUMN IF NOT EXISTS current_provenance_hash TEXT,
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
      ADD COLUMN IF NOT EXISTS ingredients JSONB,
      ADD COLUMN IF NOT EXISTS certification_claims JSONB,
      ADD COLUMN IF NOT EXISTS initial_metrics JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_sensor_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 1000;

    ALTER TABLE IF EXISTS public.batches DROP CONSTRAINT IF EXISTS batches_status_check;
    ALTER TABLE IF EXISTS public.batches ADD CONSTRAINT batches_status_check
      CHECK (status IN (
        'pending', 'active', 'certified', 'dispatched', 'delivered',
        'created', 'inspected', 'in_transit', 'sme_inventory', 'sold',
        'registered', 'evaluation_failed', 'evaluation_passed', 'awaiting_shipment',
        'shipped', 'under_review', 'rejected', 'approved', 'expired', 'revoked'
      ));

    CREATE TABLE IF NOT EXISTS public.verification_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL,
      manufacturer_id UUID,
      inspector_id UUID,
      inspector_certification_id TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_shipment',
      preliminary_trust_score NUMERIC,
      evaluation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      shipped_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      verdict TEXT,
      verdict_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.qr_scans (
      id BIGSERIAL PRIMARY KEY,
      batch_id TEXT NOT NULL,
      user_agent TEXT,
      ip_hash TEXT,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status_returned TEXT,
      scan_location_optional JSONB,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.qa_reports (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      batch_id TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('iot', 'inspector', 'manufacturer')),
      metrics JSONB NOT NULL,
      signature TEXT NOT NULL,
      bsti_credential TEXT,
      inspector_notes TEXT,
      signed_by TEXT,
      signed_at TIMESTAMPTZ DEFAULT now(),
      submitted_at TIMESTAMPTZ DEFAULT now(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    ALTER TABLE IF EXISTS public.qa_reports ADD COLUMN IF NOT EXISTS inspector_notes TEXT;
    ALTER TABLE IF EXISTS public.qa_reports ADD COLUMN IF NOT EXISTS signed_by TEXT;
    ALTER TABLE IF EXISTS public.qa_reports ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE IF EXISTS public.qa_reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE IF EXISTS public.qa_reports DROP CONSTRAINT IF EXISTS chk_bsti_format;
    ALTER TABLE IF EXISTS public.qa_reports ADD CONSTRAINT chk_bsti_format
      CHECK (
        bsti_credential IS NULL
        OR bsti_credential ~ '^BSTI-[0-9]{4,}$'
        OR bsti_credential ~ '^DEMO-BSTI-[0-9]{4}-[0-9]{4,}$'
      );

    CREATE TABLE IF NOT EXISTS public.provenance_records (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      batch_id UUID NOT NULL,
      seq INTEGER,
      type TEXT,
      event_type TEXT,
      event_data JSONB,
      actor TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      prev_hash TEXT,
      current_hash TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    ALTER TABLE IF EXISTS public.provenance_records ADD COLUMN IF NOT EXISTS seq INTEGER;
    ALTER TABLE IF EXISTS public.provenance_records ADD COLUMN IF NOT EXISTS type TEXT;
    ALTER TABLE IF EXISTS public.provenance_records ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE IF EXISTS public.provenance_records ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT now();

    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      batch_id UUID,
      destination_zone TEXT,
      type TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL DEFAULT '',
      message TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      read BOOLEAN NOT NULL DEFAULT false,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.order_lifecycle_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id TEXT NOT NULL,
      event VARCHAR(30) NOT NULL CHECK (event IN ('created', 'confirmed', 'dispatched', 'received')),
      session_id VARCHAR(100),
      buyer_id TEXT,
      from_status VARCHAR(20),
      to_status VARCHAR(20),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.dispatch_exposure_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
      zone VARCHAR(50) NOT NULL,
      packaging_type VARCHAR(30) NOT NULL,
      estimated_duration_minutes INT NOT NULL,
      calculated_survival_time_minutes INT NOT NULL,
      exposure_risk_level VARCHAR(20) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.dispatch_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
      zone VARCHAR(50) NOT NULL,
      dvs_score INT NOT NULL,
      recommended_window_start TIME NOT NULL,
      recommended_window_end TIME NOT NULL,
      risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
      ai_advice TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id TEXT NOT NULL,
      product_id TEXT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      total_bdt INT NOT NULL DEFAULT 0,
      "totalBdt" NUMERIC(12, 2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'canceled', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_demo BOOLEAN NOT NULL DEFAULT false
    );
    ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_type_check CHECK (
      type IN (
        'trust_pass', 'trust_fail', 'temp_alert', 'dispatch_approved', 'dispatch_rejected',
        'order_update', 'budget_alert', 'evaluation_failed', 'evaluation_passed',
        'verification_request', 'product_shipped', 'product_received', 'batch_rejected',
        'qr_ready', 'demo_registered'
      )
    );

    CREATE INDEX IF NOT EXISTS idx_batches_demo_status_created_at ON public.batches(is_demo, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_batches_demo_category_created_at ON public.batches(is_demo, category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_qr_scans_demo_recent ON public.qr_scans(is_demo, scanned_at DESC);
    CREATE INDEX IF NOT EXISTS idx_provenance_demo_batch_seq ON public.provenance_records(is_demo, batch_id, seq);
  `);
}

async function cleanupDemoData(client: any): Promise<void> {
  await client.query(`
    DELETE FROM public.order_lifecycle_logs WHERE is_demo = true;
    DELETE FROM public.orders WHERE is_demo = true;
    DELETE FROM public.products WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.qr_scans WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.provenance_records WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.qa_reports WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.iot_readings WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.verification_requests WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.notifications WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.dispatch_exposure_logs WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.dispatch_schedules WHERE is_demo = true
      OR batch_id::text IN (SELECT id::text FROM public.batches WHERE batch_number LIKE 'DEMO-CLX-BATCH-%');
    DELETE FROM public.esg_metrics WHERE is_demo = true
      OR processor_id::text IN (SELECT id::text FROM public.users WHERE email LIKE '%@climalogix.test' AND is_demo = true);
    DELETE FROM public.esg_reports WHERE is_demo = true
      OR processor_id::text IN (SELECT id::text FROM public.users WHERE email LIKE '%@climalogix.test' AND is_demo = true);
    DELETE FROM public.batches WHERE is_demo = true OR batch_number LIKE 'DEMO-CLX-BATCH-%';
    DELETE FROM public.users WHERE is_demo = true AND email LIKE '%@climalogix.test';
  `);
}

async function seedProductCategories(client: any): Promise<void> {
  const rows = categories.map((category, index) => ({
    name: category,
    display_name: `${category} - DEMO rulebook`,
    ph_min: category === 'Dairy Product' ? 6.5 : 3.5,
    ph_max: category === 'Dairy Product' ? 6.8 : 7.8,
    ec_min: category.includes('Manufacturing') ? 0 : 1.2,
    ec_max: category.includes('Manufacturing') ? 100 : 8.5,
    temp_min: category === 'Dairy Product' || category === 'Retail Perishable Product' ? 2 : 18,
    temp_max: category === 'Dairy Product' ? 6 : category === 'Retail Perishable Product' ? 12 : 35,
    required_ratio: category.includes('Organic') || category.includes('Compost') ? '1:1:20' : null,
    min_fermentation_days: category.includes('Compost') || category.includes('Fertilizer') ? 14 : 0,
    max_fermentation_days: 365,
    requires_bsti: category === 'Dairy Product' || category === 'Packaged Agro Product',
    weights: { ph: 0.2, ec: 0.18, temp: 0.24, ratio: 0.18, days: 0.2, demoIndex: index },
    is_demo: true,
  }));
  await upsertRows(client, 'product_categories', rows, 'name');
}

function buildUsers(): { manufacturers: Row[]; inspectors: Row[]; admins: Row[]; buyers: Row[]; all: Row[] } {
  const manufacturers = Array.from({ length: 100 }, (_, index) => {
    const n = index + 1;
    return {
      id: uuidFromSeed(`demo-manufacturer-${n}`),
      email: n === 1 ? 'manufacturer.demo@climalogix.test' : `demo-manufacturer-${pad(n, 3)}@climalogix.test`,
      password_hash: DEMO_PASSWORD_HASH,
      name: n === 1 ? 'DEMO Manufacturer Console' : `DEMO SME Manufacturer ${pad(n, 3)}`,
      role: 'processor',
      is_demo: true,
      created_at: iso(addDays(new Date(`${CURRENT_YEAR}-01-01T00:00:00.000Z`), -n)),
    };
  });
  const inspectors = Array.from({ length: 25 }, (_, index) => {
    const n = index + 1;
    return {
      id: uuidFromSeed(`demo-inspector-${n}`),
      email: n === 1 ? 'inspector.demo@climalogix.test' : `demo-inspector-${pad(n, 3)}@climalogix.test`,
      password_hash: DEMO_PASSWORD_HASH,
      name: n === 1 ? 'DEMO Inspector Console' : `DEMO Inspector ${pad(n, 3)}`,
      role: 'inspector',
      is_demo: true,
      created_at: iso(addDays(new Date(`${CURRENT_YEAR}-01-01T00:00:00.000Z`), -n)),
    };
  });
  const admins = Array.from({ length: 10 }, (_, index) => {
    const n = index + 1;
    return {
      id: uuidFromSeed(`demo-admin-${n}`),
      email: n === 1 ? 'admin.demo@climalogix.test' : `demo-admin-${pad(n, 3)}@climalogix.test`,
      password_hash: DEMO_PASSWORD_HASH,
      name: n === 1 ? 'DEMO Admin Console' : `DEMO Regulator Admin ${pad(n, 3)}`,
      role: 'admin',
      is_demo: true,
      created_at: iso(addDays(new Date(`${CURRENT_YEAR}-01-01T00:00:00.000Z`), -n)),
    };
  });
  const buyers = Array.from({ length: 50 }, (_, index) => {
    const n = index + 1;
    return {
      id: uuidFromSeed(`demo-buyer-${n}`),
      email: n === 1 ? 'buyer.demo@climalogix.test' : `demo-buyer-${pad(n, 3)}@climalogix.test`,
      password_hash: DEMO_PASSWORD_HASH,
      name: n === 1 ? 'DEMO Buyer Console' : `DEMO Retail Buyer ${pad(n, 3)}`,
      role: 'buyer',
      is_demo: true,
      created_at: iso(addDays(new Date(`${CURRENT_YEAR}-01-01T00:00:00.000Z`), -n)),
    };
  });
  return { manufacturers, inspectors, admins, buyers, all: [...manufacturers, ...inspectors, ...admins, ...buyers] };
}

function buildDataset(users: ReturnType<typeof buildUsers>): Record<string, Row[]> {
  const baseUrl = publicBaseUrl();
  const batches: Row[] = [];
  const verificationRequests: Row[] = [];
  const provenanceRecords: Row[] = [];
  const iotReadings: Row[] = [];
  const qaReports: Row[] = [];
  const notifications: Row[] = [];
  const products: Row[] = [];
  const qrScans: Row[] = [];
  const esgMetrics: Row[] = [];
  const esgReports: Row[] = [];
  const orders: Row[] = [];
  const orderLifecycleLogs: Row[] = [];
  const dispatchExposureLogs: Row[] = [];
  const dispatchSchedules: Row[] = [];

  const approvedProductIds: string[] = [];
  const batchRefs: Array<{ id: string; number: string; status: string; category: string; manufacturerId: string; inspectorId: string; productId?: string; hash?: string; zone: string; trust: number; createdAt: Date }> = [];
  const now = new Date(`${CURRENT_YEAR}-06-11T06:00:00.000Z`);

  for (let i = 1; i <= TOTAL_BATCHES; i++) {
    const status = batchStatus(i);
    const id = uuidFromSeed(`demo-batch-${i}`);
    const batchNumber = `DEMO-CLX-BATCH-${pad(i, 5)}`;
    const manufacturer = users.manufacturers[(i - 1) % users.manufacturers.length];
    const inspector = users.inspectors[(i - 1) % users.inspectors.length];
    const buyer = users.buyers[(i - 1) % users.buyers.length];
    const category = pick(categories, i - 1);
    const zone = pick(zones, i - 1);
    const trust = trustScoreFor(status, i);
    const createdAt = addDays(now, -(180 - (i % 180)));
    const approvedAt = ['approved', 'expired', 'revoked'].includes(status) ? addHours(createdAt, 58) : null;
    const expiry = approvedAt ? addDays(approvedAt, status === 'expired' ? -1 : categoryExpiryDays(category)) : null;
    const certificationId = `${category === 'Organic Fertilizer' || category.includes('Compost') ? 'DEMO-BARI-EVAL' : 'DEMO-BSTI'}-${CURRENT_YEAR}-${pad(i, 4)}`;
    const certificateNumber = approvedAt ? `CLX-DEMO-CERT-${CURRENT_YEAR}-${pad(i, 6)}` : null;
    const preliminary = {
      passed: !['evaluation_failed'].includes(status),
      score: trust,
      grade: trust >= 90 ? 'A' : trust >= 80 ? 'B' : trust >= 65 ? 'C' : 'F',
      reference: 'DEMO BARI/BSTI-aligned screening, synthetic investor dataset only',
      demo_notice: 'DEMO / NOT AN OFFICIAL CERTIFICATE OR GOVERNMENT APPROVAL',
      failures: status === 'evaluation_failed'
        ? ['Temperature outside demo threshold', 'Fermentation days below demo threshold']
        : [],
    };
    const breakdown = {
      BARI: {
        ph: { value: Number((3.6 + (i % 35) / 10).toFixed(2)), verdict: status === 'evaluation_failed' ? 'fail' : 'pass' },
        ec: { value: Number((1.5 + (i % 60) / 10).toFixed(2)), verdict: status === 'evaluation_failed' && i % 2 === 0 ? 'fail' : 'pass' },
        fermentation_days: { value: 7 + (i % 42), verdict: status === 'evaluation_failed' ? 'fail' : 'pass' },
      },
      BSTI: {
        labeling: status === 'rejected' && i % 3 === 0 ? 'fail' : 'pass',
        packaging: status === 'rejected' && i % 5 === 0 ? 'fail' : 'pass',
        cold_chain: category === 'Dairy Product' ? (status === 'rejected' ? 'review' : 'pass') : 'not_required',
      },
      demo_watermark: 'DEMO / NOT AN OFFICIAL CERTIFICATE',
    };
    const reasons = status === 'rejected'
      ? [pick(rejectionReasons, i), pick(rejectionReasons, i + 2)].filter((value, idx, arr) => arr.indexOf(value) === idx)
      : [];
    const events = buildProvenance(id, batchNumber, status, String(inspector.id), createdAt, {
      category,
      trust_score: trust,
      certificate_number: certificateNumber,
    });
    const headHash = events.length ? String(events[events.length - 1].current_hash) : null;
    const verifyUrl = approvedAt ? `${baseUrl}/api/verify/${encodeURIComponent(id)}/page?hash=${encodeURIComponent(headHash || '')}` : null;

    batches.push({
      id,
      processor_id: manufacturer.id,
      manufacturer_id: manufacturer.id,
      producer_id: manufacturer.id,
      inspector_id: ['approved', 'expired', 'revoked', 'rejected', 'under_review'].includes(status) ? inspector.id : null,
      sme_owner_id: ['approved', 'expired', 'revoked', 'under_review'].includes(status) ? buyer.id : null,
      batch_number: batchNumber,
      feedstock_type: pick(feedstocks, i - 1),
      product_name: `DEMO ${category} Product ${pad(i, 5)}`,
      product_type: category,
      category,
      weight_kg: 25 + (i % 900),
      packaging_type: pick(packagingTypes, i - 1),
      destination_zone: zone,
      status,
      trust_score: trust,
      certificate_url: certificateNumber ? `${baseUrl}/api/verify/${encodeURIComponent(id)}/certificate.pdf?hash=${encodeURIComponent(headHash || '')}&watermark=DEMO` : null,
      qr_code_url: verifyUrl,
      qr_image_data: verifyUrl ? qrSvgData(batchNumber, verifyUrl) : null,
      qr_expiry_date: expiry ? iso(expiry) : null,
      certificate_number: certificateNumber,
      current_provenance_hash: headHash,
      evaluation_summary: preliminary,
      evaluation_breakdown: breakdown,
      shipment_token: ['shipped', 'under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) ? `DEMO-SHIP-${CURRENT_YEAR}-${pad(i, 6)}` : null,
      shipment_dispatched_at: ['shipped', 'under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) ? iso(addHours(createdAt, 26)) : null,
      inspector_received_at: ['under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) ? iso(addHours(createdAt, 42)) : null,
      inspector_verdict: status === 'rejected' ? 'rejected' : approvedAt ? 'approved' : null,
      verdict_reasons: reasons,
      inspector_certification_id: approvedAt || status === 'rejected' ? certificationId : null,
      approved_at: approvedAt ? iso(approvedAt) : null,
      locked_at: approvedAt ? iso(addHours(approvedAt, 1)) : null,
      is_locked: Boolean(approvedAt),
      revoked_at: status === 'revoked' ? iso(addDays(now, -7)) : null,
      revocation_reason: status === 'revoked' ? 'DEMO revocation drill: documentation mismatch found after approval.' : null,
      ingredients: { lot: `DEMO-ING-${pad(i, 5)}`, components: [pick(feedstocks, i), category], is_demo: true },
      certification_claims: {
        claims: ['Synthetic demo compliance packet', 'Investor walkthrough only'],
        watermark: 'DEMO / NOT AN OFFICIAL CERTIFICATE',
      },
      initial_metrics: {
        ph: Number((3.6 + (i % 35) / 10).toFixed(2)),
        ec: Number((1.5 + (i % 60) / 10).toFixed(2)),
        moisture_pct: 35 + (i % 30),
        category,
        fermentation_days: 7 + (i % 42),
        temperature_celsius: category === 'Dairy Product' ? 4 : 24 + (i % 10),
      },
      is_sensor_verified: i % 3 !== 0,
      base_price: 650 + (i % 5000),
      is_demo: true,
      created_at: iso(createdAt),
    });
    provenanceRecords.push(...events);
    batchRefs.push({ id, number: batchNumber, status, category, manufacturerId: String(manufacturer.id), inspectorId: String(inspector.id), zone, trust, createdAt, hash: headHash || undefined });

    if (!['registered', 'evaluation_passed', 'evaluation_failed'].includes(status)) {
      verificationRequests.push({
        id: uuidFromSeed(`demo-verification-${i}`),
        batch_id: id,
        manufacturer_id: manufacturer.id,
        inspector_id: inspector.id,
        inspector_certification_id: certificationId,
        status,
        preliminary_trust_score: trust,
        evaluation_summary: preliminary,
        created_at: iso(addHours(createdAt, 18)),
        shipped_at: ['shipped', 'under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) ? iso(addHours(createdAt, 26)) : null,
        received_at: ['under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) ? iso(addHours(createdAt, 42)) : null,
        reviewed_at: ['approved', 'expired', 'revoked', 'rejected'].includes(status) ? iso(addHours(createdAt, 58)) : null,
        verdict: status === 'rejected' ? 'rejected' : approvedAt ? 'approved' : null,
        verdict_reasons: reasons,
        notes: status === 'rejected'
          ? `DEMO inspector notes: ${reasons.join(', ')}. Not an official inspection.`
          : 'DEMO inspector workflow record for investor walkthrough.',
        is_demo: true,
      });
    }

    const notificationBase = {
      user_id: manufacturer.id,
      batch_id: id,
      destination_zone: zone,
      severity: status === 'rejected' || status === 'evaluation_failed' ? 'warn' : 'info',
      read: i % 4 === 0,
      is_read: i % 4 === 0,
      is_demo: true,
    };
    if (status === 'evaluation_failed') {
      notifications.push({
        ...notificationBase,
        type: 'evaluation_failed',
        title: 'DEMO evaluation failed',
        body: `Batch ${batchNumber} failed synthetic BARI/BSTI screening.`,
        message: `Batch ${batchNumber} failed synthetic BARI/BSTI screening.`,
        created_at: iso(addHours(createdAt, 2)),
      });
    } else {
      notifications.push({
        ...notificationBase,
        type: 'evaluation_passed',
        title: 'DEMO evaluation passed',
        body: `Batch ${batchNumber} passed synthetic auto-evaluation.`,
        message: `Batch ${batchNumber} passed synthetic auto-evaluation.`,
        created_at: iso(addHours(createdAt, 2)),
      });
    }
    if (verificationRequests.length && !['registered', 'evaluation_passed', 'evaluation_failed'].includes(status)) {
      notifications.push({
        ...notificationBase,
        user_id: inspector.id,
        type: 'verification_request',
        title: 'DEMO verification request',
        body: `Synthetic inspection request created for ${batchNumber}.`,
        message: `Synthetic inspection request created for ${batchNumber}.`,
        created_at: iso(addHours(createdAt, 18)),
      });
    }
    if (status === 'rejected') {
      notifications.push({
        ...notificationBase,
        type: 'batch_rejected',
        title: 'DEMO batch rejected',
        body: `Batch ${batchNumber} rejected: ${reasons.join(', ')}.`,
        message: `Batch ${batchNumber} rejected: ${reasons.join(', ')}.`,
        created_at: iso(addHours(createdAt, 59)),
      });
    }
    if (approvedAt) {
      notifications.push({
        ...notificationBase,
        type: 'qr_ready',
        title: 'DEMO QR ready',
        body: `Batch ${batchNumber} has demo certificate ${certificateNumber}.`,
        message: `Batch ${batchNumber} has demo certificate ${certificateNumber}.`,
        severity: 'success',
        created_at: iso(addHours(createdAt, 60)),
      });
    }

    if (i <= 10_000) {
      for (let r = 0; r < 2; r++) {
        iotReadings.push({
          id: uuidFromSeed(`demo-iot-${i}-${r}`),
          batch_id: id,
          ph: Number((3.7 + ((i + r) % 32) / 10).toFixed(2)),
          ec: Number((1.8 + ((i + r * 3) % 55) / 10).toFixed(2)),
          temperature: Number((category === 'Dairy Product' ? 3.5 + (r % 3) : 23 + ((i + r) % 12)).toFixed(2)),
          em1_ratio: category.includes('Compost') || category.includes('Fertilizer') ? '1:1:20' : 'N/A',
          fermentation_days: 7 + ((i + r) % 42),
          recorded_at: iso(addHours(createdAt, r * 12)),
          is_demo: true,
        });
      }
    }

    if (approvedAt) {
      const productId = uuidFromSeed(`demo-product-${i}`);
      approvedProductIds.push(productId);
      batchRefs[batchRefs.length - 1].productId = productId;
      products.push({
        id: productId,
        batch_id: id,
        name: `DEMO Marketplace ${category} ${pad(i, 5)}`,
        description: 'Synthetic demo product listing. Not an official certification or approval.',
        price_bdt: 250 + (i % 4500),
        quantity: 10 + (i % 600),
        trust_score: trust,
        dvs: 65 + (i % 35),
        created_at: iso(addHours(createdAt, 61)),
        is_demo: true,
      });
    }

    if (['shipped', 'under_review', 'approved', 'expired', 'revoked', 'rejected'].includes(status) && i <= 3000) {
      dispatchExposureLogs.push({
        id: uuidFromSeed(`demo-dispatch-exposure-${i}`),
        batch_id: id,
        zone,
        packaging_type: pick(packagingTypes, i),
        estimated_duration_minutes: 45 + (i % 220),
        calculated_survival_time_minutes: 180 + (i % 900),
        exposure_risk_level: i % 6 === 0 ? 'High' : i % 3 === 0 ? 'Medium' : 'Low',
        recorded_at: iso(addHours(createdAt, 25)),
        is_demo: true,
      });
      dispatchSchedules.push({
        id: uuidFromSeed(`demo-dispatch-schedule-${i}`),
        batch_id: id,
        zone,
        dvs_score: 60 + (i % 40),
        recommended_window_start: '06:00:00',
        recommended_window_end: i % 2 === 0 ? '09:00:00' : '18:00:00',
        risk_level: i % 6 === 0 ? 'High' : i % 3 === 0 ? 'Medium' : 'Low',
        ai_advice: 'DEMO route window generated for investor dashboard charts.',
        created_at: iso(addHours(createdAt, 24)),
        is_demo: true,
      });
    }
  }

  for (let i = 1; i <= 12_000; i++) {
    const ref = batchRefs[(i - 1) % batchRefs.length];
    const isDairy = ref.category === 'Dairy Product';
    const source = isDairy ? 'inspector' : pick(['iot', 'manufacturer', 'inspector'], i);
    const metrics = {
      pH: Number((3.7 + (i % 32) / 10).toFixed(2)),
      ec: Number((1.8 + (i % 55) / 10).toFixed(2)),
      temp: Number((isDairy ? 4 : 23 + (i % 10)).toFixed(2)),
      em1Ratio: ref.category.includes('Compost') || ref.category.includes('Fertilizer') ? 0.05 : 0,
      fermentationDays: 7 + (i % 42),
    };
    qaReports.push({
      id: uuidFromSeed(`demo-qa-${i}`),
      batch_id: ref.id,
      category: ref.category,
      source,
      metrics,
      signature: hashMetrics(metrics),
      bsti_credential: source === 'inspector' ? `DEMO-BSTI-${CURRENT_YEAR}-${pad(i, 4)}` : null,
      inspector_notes: 'DEMO QA report. Synthetic metrics only; not an official inspection.',
      note: 'DEMO QA report. Synthetic metrics only; not an official inspection.',
      signed_by: source === 'inspector' ? ref.inspectorId : ref.manufacturerId,
      submitted_by: source === 'inspector' ? ref.inspectorId : ref.manufacturerId,
      signed_at: iso(addHours(ref.createdAt, 4 + (i % 48))),
      submitted_at: iso(addHours(ref.createdAt, 4 + (i % 48))),
      is_demo: true,
    });
  }

  for (let i = 1; i <= 50_000; i++) {
    const pool = i % 20 === 0
      ? batchRefs.filter((ref) => ref.status === 'expired')
      : i % 17 === 0
        ? batchRefs.filter((ref) => ref.status === 'revoked')
        : batchRefs.filter((ref) => ref.status === 'approved');
    const ref = pool[(i - 1) % pool.length];
    const tampered = i % 37 === 0;
    const statusReturned = tampered
      ? 'Tamper Warning'
      : ref.status === 'expired'
        ? 'Expired Certification'
        : ref.status === 'revoked'
          ? 'Revoked'
          : 'Valid';
    qrScans.push({
      batch_id: ref.id,
      user_agent: pick(consumerAgents, i),
      ip_hash: `demo-retailer-${pad((i % 250) + 1, 3)}-${crypto.createHash('sha256').update(`ip-${i % 250}`).digest('hex').slice(0, 16)}`,
      scanned_at: iso(addDays(now, -(i % 180))),
      status_returned: statusReturned,
      scan_location_optional: {
        zone: ref.zone,
        channel: i % 5 === 0 ? 'retailer_repeat_scan' : 'consumer_mobile',
        is_demo: true,
        tampered_hash: tampered,
      },
      is_demo: true,
    });
  }

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthDate = new Date(Date.UTC(CURRENT_YEAR, 5 - monthOffset, 1));
    const month = `${monthDate.getUTCFullYear()}-${pad(monthDate.getUTCMonth() + 1, 2)}`;
    users.manufacturers.forEach((manufacturer, idx) => {
      const score = 72 + ((idx + monthOffset) % 25);
      esgMetrics.push({
        id: uuidFromSeed(`demo-esg-metric-${manufacturer.id}-${month}`),
        processor_id: manufacturer.id,
        e_score: score,
        s_score: 68 + ((idx + monthOffset) % 28),
        g_score: 70 + ((idx + monthOffset) % 24),
        esg_score: score,
        plastic_offset_kg: 40 + idx * 3 + monthOffset,
        carbon_sequestered_kg: 120 + idx * 4 + monthOffset * 8,
        water_saved_l: 800 + idx * 11 + monthOffset * 50,
        waste_reduced_kg: 95 + idx * 5 + monthOffset * 6,
        spoilage_prevented_bdt: 12000 + idx * 400 + monthOffset * 900,
        trust_score: 78 + ((idx + monthOffset) % 20),
        dvs_score: 65 + ((idx + monthOffset) % 30),
        month,
        created_at: iso(monthDate),
        is_demo: true,
      });
      if (idx < 25) {
        esgReports.push({
          id: uuidFromSeed(`demo-esg-report-${manufacturer.id}-${month}`),
          processor_id: manufacturer.id,
          month,
          spoilage_prevented_bdt: 12000 + idx * 400 + monthOffset * 900,
          plastic_offset_kg: 40 + idx * 3 + monthOffset,
          carbon_sequestered_kg: 120 + idx * 4 + monthOffset * 8,
          report_url: `${baseUrl}/demo/esg/${encodeURIComponent(String(manufacturer.id))}/${month}?watermark=DEMO`,
          created_at: iso(monthDate),
          is_demo: true,
        });
      }
    });
  }

  for (let i = 1; i <= 3000; i++) {
    const productId = approvedProductIds[(i - 1) % approvedProductIds.length];
    const buyer = users.buyers[(i - 1) % users.buyers.length];
    const orderId = uuidFromSeed(`demo-order-${i}`);
    const status = i % 7 === 0 ? 'processing' : i % 11 === 0 ? 'pending' : 'completed';
    const createdAt = addDays(now, -(i % 120));
    orders.push({
      id: orderId,
      buyer_id: buyer.id,
      product_id: productId,
      quantity: 1 + (i % 30),
      total_bdt: (1 + (i % 30)) * (250 + (i % 4500)),
      totalBdt: (1 + (i % 30)) * (250 + (i % 4500)),
      status,
      created_at: iso(createdAt),
      is_demo: true,
    });
    (['created', 'confirmed', 'dispatched', 'received'] as const).forEach((event, step) => {
      if (status !== 'completed' && event === 'received') return;
      orderLifecycleLogs.push({
        id: uuidFromSeed(`demo-order-log-${i}-${event}`),
        order_id: orderId,
        event,
        session_id: `DEMO-SESSION-${pad(i, 5)}`,
        buyer_id: buyer.id,
        from_status: step === 0 ? null : ['pending', 'confirmed', 'processing'][step - 1],
        to_status: event === 'received' ? 'completed' : event,
        metadata: { is_demo: true, delivery_zone: pick(zones, i), product_id: productId },
        created_at: iso(addHours(createdAt, step * 8)),
        is_demo: true,
      });
    });
    notifications.push({
      user_id: buyer.id,
      batch_id: null,
      destination_zone: pick(zones, i),
      type: 'order_update',
      title: 'DEMO order update',
      body: `Synthetic order ${orderId} is ${status}.`,
      message: `Synthetic order ${orderId} is ${status}.`,
      severity: 'info',
      read: i % 3 === 0,
      is_read: i % 3 === 0,
      created_at: iso(createdAt),
      is_demo: true,
    });
  }

  return {
    batches,
    verificationRequests,
    provenanceRecords,
    iotReadings,
    qaReports,
    notifications,
    products,
    qrScans,
    esgMetrics,
    esgReports,
    orders,
    orderLifecycleLogs,
    dispatchExposureLogs,
    dispatchSchedules,
  };
}

async function validateCounts(client: any): Promise<void> {
  const checks = [
    ['batches', 'SELECT COUNT(*)::int AS count FROM public.batches WHERE is_demo = true'],
    ['approved batches', "SELECT COUNT(*)::int AS count FROM public.batches WHERE is_demo = true AND status = 'approved'"],
    ['approved QR URLs', "SELECT COUNT(*)::int AS count FROM public.batches WHERE is_demo = true AND status = 'approved' AND qr_code_url IS NOT NULL AND certificate_number IS NOT NULL"],
    ['QR scans', 'SELECT COUNT(*)::int AS count FROM public.qr_scans WHERE is_demo = true'],
    ['IoT readings', 'SELECT COUNT(*)::int AS count FROM public.iot_readings WHERE is_demo = true'],
    ['QA reports', 'SELECT COUNT(*)::int AS count FROM public.qa_reports WHERE is_demo = true'],
    ['provenance records', 'SELECT COUNT(*)::int AS count FROM public.provenance_records WHERE is_demo = true'],
    ['verification requests', 'SELECT COUNT(*)::int AS count FROM public.verification_requests WHERE is_demo = true'],
    ['orders', 'SELECT COUNT(*)::int AS count FROM public.orders WHERE is_demo = true'],
  ];

  console.log('\nDemo seed counts:');
  for (const [label, sql] of checks) {
    const result = await client.query(sql);
    console.log(`  ${label}: ${result.rows[0]?.count ?? 0}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or SUPABASE_DB_URL is required for the investor demo seed.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ALLOW_RESET !== 'true') {
    throw new Error('Refusing to seed production without DEMO_SEED_ALLOW_RESET=true.');
  }

  const resetOnly = process.argv.includes('--reset-only');
  if (resetOnly && process.env.DEMO_SEED_ALLOW_RESET !== 'true') {
    throw new Error('--reset-only requires DEMO_SEED_ALLOW_RESET=true.');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log('Preparing demo-compatible schema...');
    await prepareSchema(client);
    await client.query('BEGIN');
    console.log('Clearing prior synthetic demo rows...');
    await cleanupDemoData(client);
    if (resetOnly) {
      await client.query('COMMIT');
      console.log('Demo rows reset complete. No new data inserted.');
      return;
    }

    console.log('Building deterministic investor-demo dataset...');
    await seedProductCategories(client);
    const users = buildUsers();
    const data = buildDataset(users);

    console.log('Inserting users...');
    await upsertRows(client, 'users', users.all, 'email');

    console.log(`Inserting ${data.batches.length} batches...`);
    await insertRows(client, 'batches', data.batches, 1000);

    console.log(`Inserting ${data.verificationRequests.length} verification requests...`);
    await insertRows(client, 'verification_requests', data.verificationRequests, 1000);

    console.log(`Inserting ${data.provenanceRecords.length} provenance records...`);
    await insertRows(client, 'provenance_records', data.provenanceRecords, 1000);

    console.log(`Inserting ${data.iotReadings.length} IoT readings...`);
    await insertRows(client, 'iot_readings', data.iotReadings, 1000);

    console.log(`Inserting ${data.qaReports.length} QA reports...`);
    await insertRows(client, 'qa_reports', data.qaReports, 1000);

    console.log(`Inserting ${data.products.length} marketplace products...`);
    await insertRows(client, 'products', data.products, 1000);

    console.log(`Inserting ${data.qrScans.length} QR scan logs...`);
    await insertRows(client, 'qr_scans', data.qrScans, 2000);

    console.log(`Inserting ESG metrics and reports...`);
    await insertRows(client, 'esg_metrics', data.esgMetrics, 1000);
    await insertRows(client, 'esg_reports', data.esgReports, 1000);

    console.log(`Inserting orders and delivery lifecycle records...`);
    await insertRows(client, 'orders', data.orders, 1000);
    await insertRows(client, 'order_lifecycle_logs', data.orderLifecycleLogs, 1000);
    await insertRows(client, 'dispatch_exposure_logs', data.dispatchExposureLogs, 1000);
    await insertRows(client, 'dispatch_schedules', data.dispatchSchedules, 1000);

    console.log(`Inserting ${data.notifications.length} notifications...`);
    await insertRows(client, 'notifications', data.notifications, 1000);

    await client.query('COMMIT');
    await validateCounts(client);
    console.log('\nInvestor demo seed complete.');
    console.log(`Demo logins use password: ${DEMO_PASSWORD}`);
    console.log('  manufacturer.demo@climalogix.test');
    console.log('  inspector.demo@climalogix.test');
    console.log('  admin.demo@climalogix.test');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Investor demo seed failed:', error);
  process.exit(1);
});
