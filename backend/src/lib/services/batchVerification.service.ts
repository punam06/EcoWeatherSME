import QRCode from 'qrcode';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { appendEvent, verifyChain } from './provenance.service';
import {
  PRODUCT_CATEGORIES,
  calculateTrustScore,
  isValidBSTICredential,
  tryGetStandard,
} from './trustScore.service';
import { createNotification } from './notification.service';
import { publicBackendUrl, useMemoryStore, isProduction } from '../runtimeConfig';
import { ProvenanceEvent, ProductCategory } from '../types';

export const BATCH_STATUSES = [
  'evaluation_failed',
  'evaluation_passed',
  'awaiting_shipment',
  'shipped',
  'under_review',
  'rejected',
  'approved',
  'expired',
  'revoked',
] as const;

export type BatchStatus = typeof BATCH_STATUSES[number];

export const REJECTION_REASONS = [
  'Safety Issue',
  'Contamination Found',
  'Labeling Non-compliance',
  'Packaging Failure',
  'Ingredient Mismatch',
  'Other',
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];

type AnyRecord = Record<string, any>;

interface MemoryState {
  batches: AnyRecord[];
  verificationRequests: AnyRecord[];
  provenanceRecords: AnyRecord[];
  qrScans: AnyRecord[];
  notifications: AnyRecord[];
}

const memory: MemoryState = {
  batches: [],
  verificationRequests: [],
  provenanceRecords: [],
  qrScans: [],
  notifications: [],
};

function useMemory() {
  return useMemoryStore();
}

const columnCache = new Map<string, Promise<boolean>>();

async function hasColumn(table: string, column: string): Promise<boolean> {
  if (useMemory()) return true;
  const key = `${table}.${column}`;
  if (!columnCache.has(key)) {
    columnCache.set(key, (async () => {
      try {
        const { error } = await getSupabaseClient().from(table).select(column).limit(1);
        return !error;
      } catch {
        return false;
      }
    })());
  }
  return columnCache.get(key)!;
}

async function hasTable(table: string): Promise<boolean> {
  if (useMemory()) return true;
  return hasColumn(table, 'id');
}

async function filterKnownColumns(table: string, row: AnyRecord): Promise<AnyRecord> {
  if (useMemory()) return row;
  const filtered: AnyRecord = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined && await hasColumn(table, key)) filtered[key] = value;
  }
  return filtered;
}

function isUuid(value: unknown): boolean {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const MANUFACTURER_ROLES = new Set(['processor', 'producer', 'sme', 'sme_owner']);

function batchOwnerId(batch: AnyRecord): string | undefined {
  const id = batch.manufacturer_id || batch.processor_id || batch.producer_id;
  return typeof id === 'string' ? id : undefined;
}

export function canAccessBatch(batch: AnyRecord, userId?: string, role?: string): boolean {
  if (!userId) return false;
  if (role === 'admin' || role === 'inspector') return true;
  const owner = batchOwnerId(batch);
  if (!owner) return role !== undefined && MANUFACTURER_ROLES.has(role);
  return owner === userId;
}

async function resolveManufacturerDisplayName(manufacturerId?: string): Promise<string | null> {
  if (!manufacturerId || !isUuid(manufacturerId)) return null;
  if (useMemory()) return 'Demo Manufacturer';
  try {
    const { data } = await getSupabaseClient()
      .from('users')
      .select('name, company_name')
      .eq('id', manufacturerId)
      .maybeSingle();
    return data?.company_name || data?.name || null;
  } catch {
    return null;
  }
}

function dbStatus(status: string): string {
  const map: Record<string, string> = {
    evaluation_failed: 'pending',
    evaluation_passed: 'pending',
    awaiting_shipment: 'pending',
    shipped: 'dispatched',
    under_review: 'inspected',
    rejected: 'pending',
    approved: 'certified',
    expired: 'certified',
    revoked: 'certified',
  };
  return map[status] || status;
}

function requestMessage(request: AnyRecord): string {
  return JSON.stringify({ __kind: 'verification_request', ...request });
}

function parseRequestMessage(row: AnyRecord): AnyRecord {
  try {
    const parsed = JSON.parse(row.message || '{}');
    if (parsed.__kind === 'verification_request') {
      return {
        ...parsed,
        id: row.id,
        created_at: row.created_at || parsed.created_at,
      };
    }
  } catch { /* legacy notification body */ }
  return {
    id: row.id,
    batch_id: row.batch_id,
    manufacturer_id: row.user_id,
    inspector_id: row.user_id,
    status: 'awaiting_shipment',
    preliminary_trust_score: null,
    evaluation_summary: {},
    created_at: row.created_at,
  };
}

async function decorateBatch(batch: AnyRecord): Promise<AnyRecord> {
  const events = await getProvenanceEvents(batch.id);
  const decorated = { ...batch };
  for (const event of events) {
    const data = event.data || {};
    if (data.lifecycle && typeof data.lifecycle === 'object') Object.assign(decorated, data.lifecycle);
    if (data.evaluation) {
      decorated.evaluation_summary = decorated.evaluation_summary || data.evaluation;
      decorated.evaluation_breakdown = decorated.evaluation_breakdown || data.evaluationBreakdown;
      decorated.category = decorated.category || data.category;
    }
    if (event.type === 'approved') {
      decorated.status = decorated.status === 'certified' ? 'approved' : (decorated.status || 'approved');
    }
  }
  return decorated;
}

export function resetBatchVerificationMemoryForTests() {
  memory.batches = [];
  memory.verificationRequests = [];
  memory.provenanceRecords = [];
  memory.qrScans = [];
  memory.notifications = [];
}

export function getBatchVerificationMemoryForTests() {
  return memory;
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeCategory(input?: string): ProductCategory {
  const raw = (input || '').toLowerCase().trim();
  if ((PRODUCT_CATEGORIES as readonly string[]).includes(raw)) return raw as ProductCategory;
  if (/dairy|milk|yog/i.test(raw)) return 'dairy';
  if (/pharma|vaccine|medicine|cold/i.test(raw)) return 'pharma';
  if (/retail|fruit|vegetable|produce/i.test(raw)) return 'retail';
  if (/manufactur|industrial|feedstock/i.test(raw)) return 'manufacturing';
  return 'organic';
}

function normalizeRatio(value: unknown, category: ProductCategory): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parts = value.split(':').map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
    if (parts.length === 2 && parts[1] !== 0) return parts[0] / parts[1];
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  const std = tryGetStandard(category);
  return std?.requiredRatio ?? 0;
}

function readMetric(body: AnyRecord, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && value !== '') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return fallback;
}

export function evaluateBatchPayload(body: AnyRecord) {
  const category = normalizeCategory(body.category || body.product_category || body.product_type || body.feedstock_type);
  const standard = tryGetStandard(category)!;
  const metrics = {
    pH: readMetric(body, ['pH', 'ph'], (standard.phRange[0] + standard.phRange[1]) / 2),
    ec: readMetric(body, ['ec', 'EC'], (standard.ecRange[0] + standard.ecRange[1]) / 2),
    temperatureCelsius: readMetric(body, ['temperatureCelsius', 'temperature_celsius', 'temperature', 'temp'], (standard.tempRange[0] + standard.tempRange[1]) / 2),
    em1Ratio: normalizeRatio(body.em1Ratio ?? body.em1_ratio ?? body.ratio, category),
    fermentationDays: readMetric(body, ['fermentationDays', 'fermentation_days', 'days'], standard.minFermentationDays),
  };

  const trust = calculateTrustScore({
    category,
    ...metrics,
  });

  const bstiCredential = String(body.bstiCredential || body.bsti_credential || body.inspector_certification_id || '').trim();
  const failures = [...trust.notes];
  if (standard.requiresBSTI && !isValidBSTICredential(bstiCredential)) {
    failures.push('Valid BSTI credential is required for this category');
  }

  const passed = trust.isViable && failures.length === 0;
  return {
    passed,
    category,
    trustScore: trust.score,
    summary: {
      passed,
      status: passed ? 'evaluation_passed' : 'evaluation_failed',
      score: trust.score,
      grade: trust.grade,
      reference: trust.reference,
      failures,
      standard: {
        label: standard.label,
        requiresBSTI: standard.requiresBSTI,
        reference: standard.reference,
      },
    },
    breakdown: {
      metrics,
      components: trust.breakdown,
      notes: trust.notes,
      bstiCredential: bstiCredential || null,
    },
  };
}

function publicBaseUrl() {
  return publicBackendUrl();
}

export function buildPublicVerifyUrl(batchId: string, hash: string) {
  return `${publicBaseUrl()}/api/verify/${encodeURIComponent(batchId)}?hash=${encodeURIComponent(hash)}`;
}

function certificateExpiryFor(category: ProductCategory) {
  const daysByCategory: Record<ProductCategory, number> = {
    organic: 180,
    retail: 30,
    pharma: 365,
    dairy: 14,
    manufacturing: 365,
  };
  return addDays(new Date(), daysByCategory[category]).toISOString();
}

function certNumber(batchNumber: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `CLX-${stamp}-${batchNumber.replace(/[^A-Z0-9]/gi, '').slice(-8).toUpperCase()}-${suffix}`;
}

function hashIp(raw: string) {
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

async function resolveInspectorId(): Promise<string> {
  if (useMemory()) return 'demo-inspector-id';
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('users').select('id').in('role', ['inspector', 'admin']).limit(1).maybeSingle();
  return data?.id || 'demo-inspector-id';
}

async function notify(userId: string | null | undefined, type: string, title: string, body: string, batchId?: string) {
  if (!userId || !isUuid(userId)) {
    if (useMemory()) {
      memory.notifications.unshift({
        id: randomUUID(),
        user_id: null,
        type,
        title,
        body,
        message: `${title}: ${body}`,
        severity: type.includes('failed') || type.includes('rejected') ? 'error' : 'info',
        read: false,
        batch_id: batchId,
        is_read: false,
        created_at: nowIso(),
      });
    }
    return;
  }
  await createNotification(userId, type, title, body, { batchId });
}

function selectBatchFields() {
  return '*';
}

async function getBatchByIdOrNumber(id: string): Promise<AnyRecord | null> {
  if (useMemory()) {
    return memory.batches.find((b) => b.id === id || b.batch_number === id) || null;
  }
  const supabase = getSupabaseClient();
  const byId = await supabase.from('batches').select(selectBatchFields()).eq('id', id).maybeSingle();
  if (byId.data) return decorateBatch(byId.data);
  const byNumber = await supabase.from('batches').select(selectBatchFields()).eq('batch_number', id).maybeSingle();
  return byNumber.data ? decorateBatch(byNumber.data) : null;
}

async function updateBatch(id: string, updates: AnyRecord): Promise<AnyRecord> {
  if (useMemory()) {
    const index = memory.batches.findIndex((b) => b.id === id || b.batch_number === id);
    if (index < 0) throw new Error('Batch not found');
    memory.batches[index] = { ...memory.batches[index], ...updates, updated_at: nowIso() };
    return memory.batches[index];
  }
  const supabase = getSupabaseClient();
  const dbUpdates = await filterKnownColumns('batches', {
    ...updates,
    status: updates.status ? dbStatus(updates.status) : undefined,
  });
  const { data, error } = await supabase.from('batches').update(dbUpdates).eq('id', id).select(selectBatchFields()).single();
  if (error || !data) throw new Error(error?.message || 'Batch update failed');
  return { ...(await decorateBatch(data)), ...updates };
}

async function appendProvenance(batchId: string, type: any, data: AnyRecord, actor?: string): Promise<ProvenanceEvent> {
  const existing = await getProvenanceEvents(batchId);
  const event = appendEvent(existing as ProvenanceEvent[], type, data, actor);
  const row = { ...event, batch_id: batchId };
  if (useMemory()) {
    memory.provenanceRecords.push(row);
    return event;
  }
  let dbRow: AnyRecord;
  if (await hasColumn('provenance_records', 'seq')) {
    dbRow = await filterKnownColumns('provenance_records', row);
  } else {
    const eventType = type === 'dispatched' ? 'dispatch' : type === 'genesis' ? 'qa' : 'delivery';
    dbRow = await filterKnownColumns('provenance_records', {
      batch_id: batchId,
      event_type: eventType,
      event_data: { ...event, lifecycle: data.lifecycle, data },
      prev_hash: event.prev_hash,
      current_hash: event.current_hash,
      actor,
      created_at: event.timestamp,
    });
  }
  const { error } = await getSupabaseClient().from('provenance_records').insert(dbRow);
  if (error) throw new Error(error.message);
  return event;
}

export async function getProvenanceEvents(batchId: string): Promise<AnyRecord[]> {
  if (useMemory()) {
    return memory.provenanceRecords
      .filter((event) => event.batch_id === batchId)
      .sort((a, b) => Number(a.seq) - Number(b.seq));
  }
  if (await hasColumn('provenance_records', 'seq')) {
    const { data, error } = await getSupabaseClient()
      .from('provenance_records')
      .select('seq, type, actor, data, prev_hash, current_hash, timestamp')
      .eq('batch_id', batchId)
      .order('seq', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }
  const { data, error } = await getSupabaseClient()
    .from('provenance_records')
    .select('event_type, event_data, actor, prev_hash, current_hash, created_at')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row: AnyRecord, index: number) => ({
    seq: row.event_data?.seq ?? index,
    type: row.event_data?.type ?? row.event_type,
    actor: row.actor,
    data: row.event_data?.data ?? row.event_data ?? {},
    prev_hash: row.prev_hash,
    current_hash: row.current_hash,
    timestamp: row.event_data?.timestamp ?? row.created_at,
  }));
}

export async function createBatchWithEvaluation(body: AnyRecord, manufacturerId: string) {
  const evaluation = evaluateBatchPayload(body);
  const batchNumber = body.batch_number || `BCH-${Date.now().toString().slice(-6)}`;
  const createdAt = nowIso();
  const base = {
    id: randomUUID(),
    batch_number: batchNumber,
    product_name: body.product_name || 'Unnamed Product',
    product_type: body.product_type || evaluation.category,
    category: evaluation.category,
    feedstock_type: body.feedstock_type || body.product_type || evaluation.category,
    ingredients: body.ingredients || null,
    certification_claims: body.certification_claims || null,
    weight_kg: Number(body.weight_kg ?? 100),
    packaging_type: body.packaging_type || 'Standard',
    destination_zone: body.destination_zone || 'Old Dhaka',
    processor_id: isUuid(manufacturerId) ? manufacturerId : undefined,
    producer_id: isUuid(manufacturerId) ? manufacturerId : undefined,
    manufacturer_id: isUuid(manufacturerId) ? manufacturerId : undefined,
    status: evaluation.passed ? 'awaiting_shipment' : 'evaluation_failed',
    evaluation_summary: evaluation.summary,
    evaluation_breakdown: evaluation.breakdown,
    trust_score: evaluation.trustScore,
    is_locked: false,
    created_at: createdAt,
  };

  let batch: AnyRecord;
  if (useMemory()) {
    memory.batches.unshift(base);
    batch = base;
  } else {
    const insertRow = await filterKnownColumns('batches', {
      ...base,
      status: dbStatus(base.status),
    });
    const { data, error } = await getSupabaseClient().from('batches').insert(insertRow).select(selectBatchFields()).single();
    if (error || !data) throw new Error(error?.message || 'Batch insert failed');
    batch = { ...base, ...(data as AnyRecord) };
  }

  await appendProvenance(batch.id, 'genesis', {
    batch_number: batch.batch_number,
    product_name: batch.product_name,
    evaluation: evaluation.summary,
    evaluationBreakdown: evaluation.breakdown,
    category: evaluation.category,
    lifecycle: {
      status: base.status,
      evaluation_summary: evaluation.summary,
      evaluation_breakdown: evaluation.breakdown,
      trust_score: evaluation.trustScore,
      category: evaluation.category,
      weight_kg: base.weight_kg,
      packaging_type: base.packaging_type,
      destination_zone: base.destination_zone,
      manufacturer_id: manufacturerId,
    },
  }, 'system');
  batch = await decorateBatch(batch);

  let verificationRequest = null;
  if (evaluation.passed) {
    const inspectorId = await resolveInspectorId();
    const request = {
      id: randomUUID(),
      batch_id: batch.id,
      manufacturer_id: manufacturerId,
      inspector_id: inspectorId,
      inspector_certification_id: body.inspector_certification_id || 'DEMO-INSPECTOR-CERT-ID',
      status: 'awaiting_shipment',
      preliminary_trust_score: evaluation.trustScore,
      evaluation_summary: evaluation.summary,
      created_at: nowIso(),
    };
    if (useMemory()) {
      memory.verificationRequests.unshift(request);
      verificationRequest = request;
    } else if (await hasTable('verification_requests')) {
      const { data, error } = await getSupabaseClient().from('verification_requests').insert(request).select('*').single();
      if (error) throw new Error(error.message);
      verificationRequest = data;
    } else {
      const notification = {
        id: request.id,
        user_id: isUuid(inspectorId) ? inspectorId : null,
        type: 'verification_request',
        batch_id: batch.id,
        message: requestMessage(request),
        severity: 'info',
        read: false,
        created_at: request.created_at,
      };
      const { data, error } = await getSupabaseClient()
        .from('notifications')
        .insert(await filterKnownColumns('notifications', notification))
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      verificationRequest = parseRequestMessage(data);
    }
    await notify(manufacturerId, 'evaluation_passed', 'Evaluation passed', `Batch ${batch.batch_number} passed automated BARI/BSTI screening and is ready to ship.`, batch.id);
    await notify(inspectorId, 'verification_request', 'New verification request', `Batch ${batch.batch_number} is awaiting shipment for inspection.`, batch.id);
  } else {
    await notify(manufacturerId, 'evaluation_failed', 'Evaluation failed', `Batch ${batch.batch_number} failed automated screening: ${evaluation.summary.failures.join('; ')}`, batch.id);
  }

  return { batch, evaluation, verificationRequest };
}

export async function listBatches(query: AnyRecord, access?: { userId?: string; role?: string }) {
  if (isProduction() && !isSupabaseConfigured()) {
    throw new Error('Supabase is required for batch registry in production');
  }
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || query.limit || 25)));
  const search = String(query.search || '').trim().toLowerCase();
  const status = String(query.status || '').trim();
  const category = String(query.category || '').trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (useMemory()) {
    let rows = [...memory.batches];
    if (access?.userId && access.role && MANUFACTURER_ROLES.has(access.role)) {
      rows = rows.filter((b) => batchOwnerId(b) === access.userId);
    }
    if (status) rows = rows.filter((b) => b.status === status);
    if (category) rows = rows.filter((b) => (b.category || b.product_type) === category);
    if (search) {
      rows = rows.filter((b) => [b.batch_number, b.product_name, b.feedstock_type].some((v) => String(v || '').toLowerCase().includes(search)));
    }
    const total = rows.length;
    return { rows: rows.slice(from, from + pageSize), page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
  }

  let dbQuery = getSupabaseClient()
    .from('batches')
    .select(selectBatchFields(), { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (access?.userId && access.role && MANUFACTURER_ROLES.has(access.role)) {
    if (await hasColumn('batches', 'manufacturer_id')) {
      dbQuery = dbQuery.eq('manufacturer_id', access.userId);
    } else if (await hasColumn('batches', 'processor_id')) {
      dbQuery = dbQuery.eq('processor_id', access.userId);
    }
  }
  if (status && ['pending', 'active', 'certified', 'dispatched', 'delivered', 'created', 'inspected', 'in_transit', 'sme_inventory', 'sold'].includes(status)) {
    dbQuery = dbQuery.eq('status', status);
  }
  if (category && await hasColumn('batches', 'category')) dbQuery = dbQuery.eq('category', category);
  if (search) dbQuery = dbQuery.or(`batch_number.ilike.%${search}%,product_name.ilike.%${search}%,feedstock_type.ilike.%${search}%`);
  const { data, error, count } = await dbQuery;
  if (error) throw new Error(error.message);
  let rows = await Promise.all((data || []).map((row: AnyRecord) => decorateBatch(row)));
  if (status && !['pending', 'active', 'certified', 'dispatched', 'delivered', 'created', 'inspected', 'in_transit', 'sme_inventory', 'sold'].includes(status)) {
    rows = rows.filter((row) => row.status === status);
  }
  if (category && !await hasColumn('batches', 'category')) rows = rows.filter((row) => row.category === category);
  const total = count || rows.length;
  return { rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getBatchDetail(id: string, access?: { userId?: string; role?: string }) {
  const batch = await getBatchByIdOrNumber(id);
  if (!batch) return null;
  if (access?.userId && !canAccessBatch(batch, access.userId, access.role)) {
    return null;
  }
  const requests = useMemory()
    ? memory.verificationRequests.filter((r) => r.batch_id === batch.id)
    : await getRequestsForBatch(batch.id);
  const provenance = await getProvenanceEvents(batch.id);
  return { ...batch, verification_requests: requests, provenance };
}

export async function guardedUpdateBatch(id: string, updates: AnyRecord, access?: { userId?: string; role?: string }) {
  const batch = await getBatchByIdOrNumber(id);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (access?.userId && !canAccessBatch(batch, access.userId, access.role)) {
    return { status: 403, error: 'You do not have access to modify this batch' };
  }
  if (batch.is_locked || ['approved', 'expired', 'revoked'].includes(batch.status)) {
    return { status: 403, error: 'Approved or locked batches are immutable' };
  }
  const coreFields = ['product_name', 'product_type', 'feedstock_type', 'ingredients', 'certification_claims', 'weight_kg', 'packaging_type'];
  const sanitized: AnyRecord = {};
  for (const key of coreFields) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }
  const updated = await updateBatch(batch.id, sanitized);
  return { status: 200, batch: updated };
}

export async function shipBatch(id: string, access: { userId: string; role?: string }) {
  const batch = await getBatchByIdOrNumber(id);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (!canAccessBatch(batch, access.userId, access.role)) {
    return { status: 403, error: 'You do not have access to ship this batch' };
  }
  if (batch.status !== 'awaiting_shipment') {
    return { status: 400, error: `Invalid status transition: ${batch.status} -> shipped. Expected awaiting_shipment.` };
  }
  const shippedAt = nowIso();
  const shipmentToken = `ship_${randomBytes(16).toString('hex')}`;
  const updated = await updateBatch(batch.id, {
    status: 'shipped',
    shipment_token: shipmentToken,
    shipment_dispatched_at: shippedAt,
  });
  await appendProvenance(batch.id, 'dispatched', {
    shipmentToken,
    shippedAt,
    lifecycle: {
      status: 'shipped',
      shipment_token: shipmentToken,
      shipment_dispatched_at: shippedAt,
    },
  }, access.userId);
  await updateVerificationRequestByBatch(batch.id, { status: 'shipped', shipped_at: shippedAt });
  const request = await getLatestRequestForBatch(batch.id);
  await notify(request?.inspector_id, 'product_shipped', 'Product shipped', `Batch ${batch.batch_number} has been shipped for inspection.`, batch.id);
  return { batch: updated, shipmentToken, shippedAt };
}

async function getLatestRequestForBatch(batchId: string) {
  if (useMemory()) return memory.verificationRequests.find((r) => r.batch_id === batchId) || null;
  if (!await hasTable('verification_requests')) {
    const rows = await getRequestsForBatch(batchId);
    return rows[0] || null;
  }
  const { data } = await getSupabaseClient()
    .from('verification_requests')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function getRequestsForBatch(batchId: string) {
  if (useMemory()) return memory.verificationRequests.filter((r) => r.batch_id === batchId);
  if (await hasTable('verification_requests')) {
    const { data } = await getSupabaseClient()
      .from('verification_requests')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });
    return data || [];
  }
  const { data, error } = await getSupabaseClient()
    .from('notifications')
    .select('*')
    .eq('type', 'verification_request')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(parseRequestMessage);
}

async function updateVerificationRequestByBatch(batchId: string, updates: AnyRecord) {
  if (useMemory()) {
    memory.verificationRequests = memory.verificationRequests.map((r) => (r.batch_id === batchId ? { ...r, ...updates } : r));
    return;
  }
  if (!await hasTable('verification_requests')) {
    const rows = await getRequestsForBatch(batchId);
    await Promise.all(rows.map((row) => updateVerificationRequest(row.id, updates)));
    return;
  }
  await getSupabaseClient().from('verification_requests').update(updates).eq('batch_id', batchId);
}

export async function listVerificationRequests(query: AnyRecord, inspectorId?: string) {
  const status = String(query.status || '').trim();
  if (useMemory()) {
    let rows = [...memory.verificationRequests];
    if (inspectorId && inspectorId !== 'test-user') rows = rows.filter((r) => r.inspector_id === inspectorId);
    if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  }
  if (await hasTable('verification_requests')) {
    let dbQuery = getSupabaseClient()
      .from('verification_requests')
      .select('*, batches(*)')
      .order('created_at', { ascending: false });
    if (inspectorId) dbQuery = dbQuery.eq('inspector_id', inspectorId);
    if (status) dbQuery = dbQuery.eq('status', status);
    const { data, error } = await dbQuery;
    if (error) throw new Error(error.message);
    return data || [];
  }
  const { data, error } = await getSupabaseClient()
    .from('notifications')
    .select('*')
    .eq('type', 'verification_request')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const requests: AnyRecord[] = await Promise.all((data || []).map(async (row: AnyRecord) => {
    const request = parseRequestMessage(row);
    const batch = await getBatchByIdOrNumber(request.batch_id);
    return { ...request, batches: batch };
  }));
  return status ? requests.filter((request) => request.status === status) : requests;
}

async function getVerificationRequest(id: string) {
  if (useMemory()) return memory.verificationRequests.find((r) => r.id === id) || null;
  if (!await hasTable('verification_requests')) {
    const { data } = await getSupabaseClient().from('notifications').select('*').eq('id', id).maybeSingle();
    return data ? parseRequestMessage(data) : null;
  }
  const { data } = await getSupabaseClient().from('verification_requests').select('*').eq('id', id).maybeSingle();
  return data || null;
}

async function updateVerificationRequest(id: string, updates: AnyRecord) {
  if (useMemory()) {
    const index = memory.verificationRequests.findIndex((r) => r.id === id);
    if (index < 0) throw new Error('Verification request not found');
    memory.verificationRequests[index] = { ...memory.verificationRequests[index], ...updates };
    return memory.verificationRequests[index];
  }
  if (!await hasTable('verification_requests')) {
    const current = await getVerificationRequest(id);
    if (!current) throw new Error('Verification request not found');
    const next = { ...current, ...updates };
    const { data, error } = await getSupabaseClient()
      .from('notifications')
      .update(await filterKnownColumns('notifications', { message: requestMessage(next), read: next.status === 'approved' || next.status === 'rejected' }))
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Verification request update failed');
    return parseRequestMessage(data);
  }
  const { data, error } = await getSupabaseClient().from('verification_requests').update(updates).eq('id', id).select('*').single();
  if (error || !data) throw new Error(error?.message || 'Verification request update failed');
  return data;
}

export async function markReceived(requestId: string, inspectorId: string, role?: string) {
  const request = await getVerificationRequest(requestId);
  if (!request) return { status: 404, error: 'Verification request not found' };
  if (role !== 'admin' && request.inspector_id && request.inspector_id !== inspectorId) {
    return { status: 403, error: 'This verification request is assigned to another inspector' };
  }
  const batch = await getBatchByIdOrNumber(request.batch_id);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (batch.status !== 'shipped') {
    return { status: 400, error: `Invalid status transition: ${batch.status} -> under_review. Expected shipped.` };
  }
  const receivedAt = nowIso();
  const updatedBatch = await updateBatch(batch.id, { status: 'under_review', inspector_received_at: receivedAt });
  const updatedRequest = await updateVerificationRequest(requestId, { status: 'under_review', received_at: receivedAt });
  await appendProvenance(batch.id, 'received', {
    receivedAt,
    lifecycle: {
      status: 'under_review',
      inspector_received_at: receivedAt,
    },
  }, inspectorId);
  await notify(request.manufacturer_id, 'product_received', 'Product received by inspector', `Batch ${batch.batch_number} is now under review.`, batch.id);
  return { batch: updatedBatch, verificationRequest: updatedRequest };
}

function validateRejection(reasons: unknown, notes?: string) {
  const list = Array.isArray(reasons) ? reasons.map(String) : [];
  const invalid = list.filter((reason) => !(REJECTION_REASONS as readonly string[]).includes(reason));
  if (list.length === 0) return 'At least one rejection reason is required';
  if (invalid.length) return `Unsupported rejection reason(s): ${invalid.join(', ')}`;
  if (list.includes('Other') && !String(notes || '').trim()) return 'Notes are mandatory when Other is selected';
  return null;
}

export async function submitVerdict(requestId: string, body: AnyRecord, inspectorId: string, role?: string) {
  const verdict = String(body.verdict || '').toLowerCase();
  if (!['approved', 'rejected'].includes(verdict)) {
    return { status: 400, error: 'verdict must be approved or rejected' };
  }
  const request = await getVerificationRequest(requestId);
  if (!request) return { status: 404, error: 'Verification request not found' };
  if (role !== 'admin' && request.inspector_id && request.inspector_id !== inspectorId) {
    return { status: 403, error: 'This verification request is assigned to another inspector' };
  }
  const batch = await getBatchByIdOrNumber(request.batch_id);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (batch.status !== 'under_review') {
    return { status: 400, error: `Invalid status transition: ${batch.status} -> ${verdict}. Expected under_review.` };
  }

  const reviewedAt = nowIso();
  if (verdict === 'rejected') {
    const validationError = validateRejection(body.reasons || body.verdict_reasons, body.notes);
    if (validationError) return { status: 400, error: validationError };
    const reasons = body.reasons || body.verdict_reasons;
    const updatedBatch = await updateBatch(batch.id, {
      status: 'rejected',
      inspector_verdict: 'rejected',
      verdict_reasons: reasons,
    });
    const updatedRequest = await updateVerificationRequest(requestId, {
      status: 'rejected',
      reviewed_at: reviewedAt,
      verdict: 'rejected',
      verdict_reasons: reasons,
      notes: body.notes || null,
    });
    await appendProvenance(batch.id, 'rejected', {
      reasons,
      notes: body.notes || null,
      reviewedAt,
      lifecycle: {
        status: 'rejected',
        inspector_verdict: 'rejected',
        verdict_reasons: reasons,
      },
    }, inspectorId);
    await notify(request.manufacturer_id, 'batch_rejected', 'Batch rejected', `Batch ${batch.batch_number} was rejected: ${reasons.join(', ')}`, batch.id);
    return { batch: updatedBatch, verificationRequest: updatedRequest };
  }

  const category = normalizeCategory(batch.category || batch.product_type || batch.feedstock_type);
  const approvalEvent = await appendProvenance(batch.id, 'approved', {
    checklist: body.checklist || {},
    inspectorCertificationId: body.inspector_certification_id || request.inspector_certification_id,
    reviewedAt,
    lifecycle: {
      status: 'approved',
    },
  }, inspectorId);
  const verifyUrl = buildPublicVerifyUrl(batch.id, approvalEvent.current_hash);
  const qrImageData = await QRCode.toDataURL(verifyUrl, {
    width: 360,
    margin: 2,
    color: { dark: '#111827', light: '#FFFFFF' },
  });
  const expiry = certificateExpiryFor(category);
  const certificateNumber = certNumber(batch.batch_number || batch.id);
  const updates = {
    status: 'approved',
    inspector_verdict: 'approved',
    inspector_certification_id: body.inspector_certification_id || request.inspector_certification_id || 'DEMO-INSPECTOR-CERT-ID',
    approved_at: reviewedAt,
    locked_at: reviewedAt,
    is_locked: true,
    qr_code_url: verifyUrl,
    qr_image_data: qrImageData,
    qr_expiry_date: expiry,
    certificate_number: certificateNumber,
    current_provenance_hash: approvalEvent.current_hash,
  };
  const updatedBatch = await updateBatch(batch.id, updates);
  await appendProvenance(batch.id, 'verified', {
    certificateNumber,
    expiry,
    lifecycle: updates,
  }, inspectorId);
  const updatedRequest = await updateVerificationRequest(requestId, {
    status: 'approved',
    reviewed_at: reviewedAt,
    verdict: 'approved',
    verdict_reasons: [],
    notes: body.notes || null,
    inspector_certification_id: updates.inspector_certification_id,
  });
  await notify(request.manufacturer_id, 'qr_ready', 'QR certificate ready', `Batch ${batch.batch_number} is approved. QR certificate ${certificateNumber} is ready.`, batch.id);
  return { batch: updatedBatch, verificationRequest: updatedRequest };
}

export async function getApprovedQr(batchId: string) {
  const batch = await getBatchByIdOrNumber(batchId);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (batch.status !== 'approved' || !batch.qr_image_data) {
    return { status: 400, error: 'QR code is only available for approved batches' };
  }
  return {
    status: 200,
    data: {
      batchId: batch.id,
      batchNumber: batch.batch_number,
      verificationUrl: batch.qr_code_url,
      qrImageData: batch.qr_image_data,
      expiryDate: batch.qr_expiry_date,
      certificateNumber: batch.certificate_number,
    },
  };
}

export async function verifyPublicBatch(batchId: string, hash?: string, scan?: { ip?: string; userAgent?: string }) {
  const batch = await getBatchByIdOrNumber(batchId);
  if (!batch) return { status: 404, error: 'Batch not found' };
  const events = await getProvenanceEvents(batch.id);
  const chainCheck = verifyChain(events as ProvenanceEvent[]);
  const latestHash = events.length ? events[events.length - 1].current_hash : batch.current_provenance_hash;
  const hashMatches = Boolean(hash && (hash === batch.current_provenance_hash || hash === latestHash));
  const now = new Date();
  const expiryDate = batch.qr_expiry_date ? new Date(batch.qr_expiry_date) : null;
  const isExpired = Boolean(expiryDate && expiryDate.getTime() < now.getTime());
  const isRevoked = batch.status === 'revoked' || Boolean(batch.revoked_at);
  const statusReturned = isRevoked
    ? 'Revoked'
    : !chainCheck.verified || !hashMatches
      ? 'Tamper Warning'
      : isExpired || batch.status === 'expired'
        ? 'Expired Certification'
        : batch.status === 'approved'
          ? 'Valid'
          : 'Not Valid';

  if (scan) {
    const scanRow = {
      batch_id: batch.id,
      scanned_at: nowIso(),
      ip_hash: hashIp(scan.ip || 'unknown'),
      user_agent: String(scan.userAgent || 'unknown').slice(0, 255),
      status_returned: statusReturned,
    };
    if (useMemory()) memory.qrScans.push(scanRow);
    else filterKnownColumns('qr_scans', scanRow)
      .then((row) => getSupabaseClient().from('qr_scans').insert(row))
      .then(() => undefined);
  }

  const manufacturerDisplayName = await resolveManufacturerDisplayName(
    batch.manufacturer_id || batch.processor_id || batch.producer_id,
  );

  return {
    status: 200,
    data: {
      batchId: batch.id,
      batchNumber: batch.batch_number,
      productName: batch.product_name,
      category: batch.category || batch.product_type,
      manufacturerDisplayName: manufacturerDisplayName || 'Certified Manufacturer',
      approvalDate: batch.approved_at,
      expiryDate: batch.qr_expiry_date,
      revokedAt: batch.revoked_at,
      revocationReason: batch.revocation_reason,
      evaluationSummary: batch.evaluation_summary,
      evaluationBreakdown: batch.evaluation_breakdown,
      trustScore: batch.trust_score,
      inspectorCertificationId: batch.inspector_certification_id,
      certificateNumber: batch.certificate_number,
      provenanceHash: batch.current_provenance_hash || latestHash,
      hashMatches,
      chainVerified: chainCheck.verified,
      chainReason: chainCheck.reason,
      certificateStatus: statusReturned,
      status: batch.status,
      pdfUrl: `${publicBaseUrl()}/api/verify/${encodeURIComponent(batch.id)}/certificate.pdf?hash=${encodeURIComponent(hash || batch.current_provenance_hash || '')}`,
    },
  };
}

export async function revokeBatch(
  batchId: string,
  access: { userId: string; role?: string },
  reason: string,
) {
  if (access.role !== 'admin' && access.role !== 'inspector') {
    return { status: 403, error: 'Only admin or inspector can revoke certificates' };
  }
  const batch = await getBatchByIdOrNumber(batchId);
  if (!batch) return { status: 404, error: 'Batch not found' };
  if (batch.status !== 'approved' && batch.status !== 'expired') {
    return { status: 400, error: 'Only approved certificates can be revoked' };
  }
  const revokedAt = nowIso();
  const updated = await updateBatch(batch.id, {
    status: 'revoked',
    revoked_at: revokedAt,
    revocation_reason: reason,
  });
  await appendProvenance(batch.id, 'rejected', {
    revocationReason: reason,
    revokedAt,
    lifecycle: { status: 'revoked', revoked_at: revokedAt, revocation_reason: reason },
  }, access.userId);
  await notify(batchOwnerId(batch), 'batch_rejected', 'Certificate revoked', `Batch ${batch.batch_number} certificate revoked: ${reason}`, batch.id);
  return { status: 200, batch: updated };
}
