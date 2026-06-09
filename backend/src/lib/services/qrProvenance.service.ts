/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — QR PROVENANCE SERVICE
 * File: src/lib/services/qrProvenance.service.ts
 *
 * Producer intake → trust score evaluation → cryptographic hash
 * → batch persistence → public verification URL.
 *
 * Inspector scan → status transition → metrics lock → custody
 * ledger append.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto';
import {
  InitialMetrics,
  ProductCategory,
  QRGenerateResult,
  QRInspectResult,
  QRSMEClaimResult,
} from '../types';
import {
  QRGenerateRequest,
  QRInitialMetrics,
  QRInspectRequest,
  QRSMEClaimRequest,
} from '../../api/schemas';
import { calculateOptimalSaleWindow } from './saleWindow.service';
import { calculateTrustScore, TrustScoreInput } from './trustScore.service';
import { getStandard } from './standardsRegistry.service';
import { canonicalize } from './qaIngestion.service';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

// ─── Constants ─────────────────────────────────────────────────

const VERIFY_BASE = (
  process.env.FRONTEND_URL || 'https://ecoweathersme.onrender.com'
).replace(/\/+$/, '');

// ─── Public Result Types ───────────────────────────────────────

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ─── Helpers ───────────────────────────────────────────────────

const midpoint = (range: [number, number]): number =>
  (range[0] + range[1]) / 2;

export function buildVerificationUrl(batchId: string): string {
  return `${VERIFY_BASE}/verify/${batchId}`;
}

/**
 * Maps producer-declared metrics to the full TrustScoreInput
 * expected by the scoring engine. Missing optional fields are
 * filled from category standards (midpoint temp, required ratio,
 * minimum fermentation days).
 */
export function buildTrustScoreInput(metrics: QRInitialMetrics): TrustScoreInput {
  const std = getStandard(metrics.category);
  return {
    category: metrics.category,
    pH: metrics.ph,
    ec: metrics.ec,
    temperatureCelsius:
      metrics.temperature_celsius ?? midpoint(std.tempRange),
    em1Ratio: metrics.em1_ratio ?? std.requiredRatio,
    fermentationDays:
      metrics.fermentation_days ?? std.minFermentationDays,
  };
}

export interface BirthCertificatePayload {
  ph: number;
  ec: number;
  moisture_pct: number;
  category: ProductCategory;
  fermentation_days: number;
  temperature_celsius: number;
  em1_ratio: number;
  trust_score: number;
  grade: string;
  created_at: string;
}

/**
 * SHA-256 over the canonical birth-certificate blob. Stored on
 * the batch so downstream verify endpoints can detect tampering.
 */
export function signBirthCertificate(payload: BirthCertificatePayload): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

export function areInitialMetricsLocked(metrics: InitialMetrics | null | undefined): boolean {
  return metrics?.locked === true;
}

function toStoredMetrics(
  metrics: QRInitialMetrics,
  provenanceHash: string,
): InitialMetrics {
  return {
    ph: metrics.ph,
    ec: metrics.ec,
    moisture_pct: metrics.moisture_pct,
    category: metrics.category,
    fermentation_days: metrics.fermentation_days,
    temperature_celsius: metrics.temperature_celsius,
    em1_ratio: metrics.em1_ratio,
    locked: false,
    provenance_hash: provenanceHash,
  };
}

function parseInitialMetrics(raw: unknown): InitialMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (
    typeof m.ph !== 'number' ||
    typeof m.ec !== 'number' ||
    typeof m.moisture_pct !== 'number' ||
    typeof m.category !== 'string'
  ) {
    return null;
  }
  return {
    ph: m.ph,
    ec: m.ec,
    moisture_pct: m.moisture_pct,
    category: m.category as ProductCategory,
    fermentation_days:
      typeof m.fermentation_days === 'number' ? m.fermentation_days : undefined,
    temperature_celsius:
      typeof m.temperature_celsius === 'number' ? m.temperature_celsius : undefined,
    em1_ratio: typeof m.em1_ratio === 'number' ? m.em1_ratio : undefined,
    locked: m.locked === true,
    provenance_hash:
      typeof m.provenance_hash === 'string' ? m.provenance_hash : undefined,
  };
}

// ─── Producer Intake & QR Generation ───────────────────────────

export async function generateQRBatch(
  input: QRGenerateRequest,
  actorId?: string,
): Promise<ServiceResult<QRGenerateResult>> {
  const { initial_metrics: metrics } = input;
  const trustInput = buildTrustScoreInput(metrics);
  const trust = calculateTrustScore(trustInput);

  const createdAt = new Date().toISOString();
  const birthPayload: BirthCertificatePayload = {
    ph: metrics.ph,
    ec: metrics.ec,
    moisture_pct: metrics.moisture_pct,
    category: metrics.category,
    fermentation_days: trustInput.fermentationDays,
    temperature_celsius: trustInput.temperatureCelsius,
    em1_ratio: trustInput.em1Ratio,
    trust_score: trust.score,
    grade: trust.grade,
    created_at: createdAt,
  };
  const provenanceHash = signBirthCertificate(birthPayload);
  const storedMetrics = toStoredMetrics(metrics, provenanceHash);

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: 'Supabase not configured — cannot persist QR batch',
      status: 503,
    };
  }

  const producerId = input.producer_id ?? actorId;
  if (!producerId) {
    return {
      ok: false,
      error: 'producer_id is required (provide in body or authenticate as producer)',
      status: 400,
    };
  }

  const batchNumber = `QR-${Date.now().toString(36).toUpperCase()}`;
  const supabase = getSupabaseClient();

  const { data: batch, error: insertErr } = await supabase
    .from('batches')
    .insert({
      batch_number: batchNumber,
      product_name: input.product_name ?? `${getStandard(metrics.category).label} Batch`,
      feedstock_type: input.feedstock_type ?? metrics.category,
      status: 'created',
      trust_score: trust.score,
      producer_id: producerId,
      processor_id: producerId,
      initial_metrics: storedMetrics,
      is_sensor_verified: input.is_sensor_verified ?? false,
      certificate_url: null,
    })
    .select('id, batch_number, status, initial_metrics, created_at')
    .single();

  if (insertErr || !batch) {
    return {
      ok: false,
      error: insertErr?.message ?? 'Failed to create batch',
      status: 500,
    };
  }

  const verificationUrl = buildVerificationUrl(batch.id);

  const { error: urlErr } = await supabase
    .from('batches')
    .update({ certificate_url: verificationUrl })
    .eq('id', batch.id);

  if (urlErr) {
    console.warn('[QR] certificate_url update failed:', urlErr.message);
  }

  const { error: ledgerErr } = await supabase.from('batch_custody_ledger').insert({
    batch_id: batch.id,
    actor_id: producerId,
    action_type: 'production',
    metadata: {
      trust_score: trust.score,
      grade: trust.grade,
      provenance_hash: provenanceHash,
      category: metrics.category,
      moisture_pct: metrics.moisture_pct,
    },
  });

  if (ledgerErr) {
    console.warn('[QR] production ledger insert failed:', ledgerErr.message);
  }

  supabase
    .from('trust_score_logs')
    .insert({
      ph: metrics.ph,
      ec: metrics.ec,
      temperature: trustInput.temperatureCelsius,
      em1_ratio: trustInput.em1Ratio,
      fermentation_days: trustInput.fermentationDays,
      score: trust.score,
      grade: trust.grade,
      is_viable: trust.isViable,
    })
    .then(({ error }) => {
      if (error) console.warn('[QR] trust_score_logs insert failed:', error.message);
    });

  return {
    ok: true,
    data: {
      id: batch.id,
      batch_number: batch.batch_number,
      status: 'created',
      initial_metrics: storedMetrics,
      trust: {
        score: trust.score,
        grade: trust.grade,
        isViable: trust.isViable,
        reference: trust.reference,
        breakdown: trust.breakdown,
        notes: trust.notes,
      },
      provenance_hash: provenanceHash,
      verification_url: verificationUrl,
      created_at: batch.created_at ?? createdAt,
    },
  };
}

// ─── Inspector Batch Verification ──────────────────────────────

export async function inspectQRBatch(
  batchId: string,
  input: QRInspectRequest,
  inspectorId: string,
): Promise<ServiceResult<QRInspectResult>> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: 'Supabase not configured — cannot inspect batch',
      status: 503,
    };
  }

  const supabase = getSupabaseClient();

  const { data: batch, error: fetchErr } = await supabase
    .from('batches')
    .select('id, status, inspector_id, initial_metrics')
    .eq('id', batchId)
    .single();

  if (fetchErr || !batch) {
    return { ok: false, error: 'Batch not found', status: 404 };
  }

  if (batch.status !== 'created') {
    return {
      ok: false,
      error: `Batch cannot be inspected from status "${batch.status}" — expected "created"`,
      status: 422,
    };
  }

  const metrics = parseInitialMetrics(batch.initial_metrics);
  if (!metrics) {
    return { ok: false, error: 'Batch has no valid initial_metrics', status: 422 };
  }

  if (areInitialMetricsLocked(metrics)) {
    return {
      ok: false,
      error: 'Initial metrics are locked and cannot be modified',
      status: 422,
    };
  }

  const inspectedAt = new Date().toISOString();
  const lockedMetrics: InitialMetrics = { ...metrics, locked: true };

  const { error: updateErr } = await supabase
    .from('batches')
    .update({
      status: 'inspected',
      inspector_id: inspectorId,
      initial_metrics: lockedMetrics,
    })
    .eq('id', batchId);

  if (updateErr) {
    return {
      ok: false,
      error: updateErr.message,
      status: 500,
    };
  }

  const ledgerMetadata: Record<string, unknown> = {
    notes: input.notes ?? null,
    bsti_ref: input.bsti_credential ?? null,
    initial_metrics_hash: metrics.provenance_hash ?? null,
    locked_at: inspectedAt,
    ...(input.metadata ?? {}),
  };

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from('batch_custody_ledger')
    .insert({
      batch_id: batchId,
      actor_id: inspectorId,
      action_type: 'inspection',
      gps_latitude: input.gps_latitude ?? null,
      gps_longitude: input.gps_longitude ?? null,
      metadata: ledgerMetadata,
    })
    .select('id')
    .single();

  if (ledgerErr || !ledgerRow) {
    return {
      ok: false,
      error: ledgerErr?.message ?? 'Failed to append inspection event',
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      id: batchId,
      status: 'inspected',
      inspector_id: inspectorId,
      initial_metrics: lockedMetrics,
      custody_event_id: ledgerRow.id,
      inspected_at: inspectedAt,
    },
  };
}

// ─── SME Inventory Intake & Sale Window ────────────────────────

const SME_CLAIMABLE_STATUSES = new Set(['inspected', 'in_transit']);

export async function claimSMEBatch(
  batchId: string,
  input: QRSMEClaimRequest,
  smeOwnerId: string,
  clientIpHash?: string,
): Promise<ServiceResult<QRSMEClaimResult>> {
  // Try Supabase first; fall back to in-memory batch store
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();

    const { data: batch, error: fetchErr } = await supabase
      .from('batches')
      .select(
        'id, status, sme_owner_id, trust_score, packaging_type, destination_zone, initial_metrics',
      )
      .eq('id', batchId)
      .single();

    if (!fetchErr && batch) {
      return claimSMEBatchFromDB(batch, batchId, input, smeOwnerId, clientIpHash);
    }
  }

  // Fallback: try in-memory batch store
  const { getBatchFromStore } = require('./batchStore.service');
  const localBatch = getBatchFromStore(batchId);
  if (!localBatch) {
    return { ok: false, error: 'Batch not found', status: 404 };
  }

  const zone = input.zone ?? localBatch.destination_zone ?? 'Old Dhaka';
  const recommendations = await calculateOptimalSaleWindow({
    zone,
    moisturePct: 45,
    trustScore: localBatch.trust_score ?? 70,
    packagingType: localBatch.packaging_type ?? 'Standard',
    category: 'organic',
  });

  return {
    ok: true,
    data: {
      product_saved: true,
      batch_id: batchId,
      status: 'sme_inventory',
      sme_owner_id: smeOwnerId,
      custody_event_id: 'simulated-' + batchId,
      recommendations: {
        best_sale_window: recommendations.best_sale_window,
        risk_level: recommendations.risk_level,
        days_viable: recommendations.days_viable,
      },
    },
  };
}

async function claimSMEBatchFromDB(
  batch: any,
  batchId: string,
  input: QRSMEClaimRequest,
  smeOwnerId: string,
  clientIpHash?: string,
): Promise<ServiceResult<QRSMEClaimResult>> {
  const supabase = getSupabaseClient();

  if (batch.status === 'sme_inventory' && batch.sme_owner_id === smeOwnerId) {
    const metrics = parseInitialMetrics(batch.initial_metrics);
    const zone = input.zone ?? batch.destination_zone ?? 'Old Dhaka';
    const recommendations = await calculateOptimalSaleWindow({
      zone,
      moisturePct: metrics?.moisture_pct ?? 45,
      trustScore: batch.trust_score ?? 70,
      packagingType: batch.packaging_type ?? 'Standard',
      category: metrics?.category,
    });
    return {
      ok: true,
      data: {
        product_saved: true,
        batch_id: batchId,
        status: 'sme_inventory',
        sme_owner_id: smeOwnerId,
        custody_event_id: '',
        recommendations: {
          best_sale_window: recommendations.best_sale_window,
          risk_level: recommendations.risk_level,
          days_viable: recommendations.days_viable,
        },
      },
    };
  }

  if (!SME_CLAIMABLE_STATUSES.has(batch.status)) {
    return {
      ok: false,
      error: `Batch cannot be claimed from status "${batch.status}" — expected "inspected" or "in_transit"`,
      status: 422,
    };
  }

  if (batch.sme_owner_id && batch.sme_owner_id !== smeOwnerId) {
    return {
      ok: false,
      error: 'Batch has already been claimed by another SME owner',
      status: 409,
    };
  }

  const metrics = parseInitialMetrics(batch.initial_metrics);
  if (!metrics) {
    return { ok: false, error: 'Batch has no valid initial_metrics', status: 422 };
  }

  if (!areInitialMetricsLocked(metrics)) {
    return {
      ok: false,
      error: 'Initial metrics must be inspector-locked before SME claim',
      status: 422,
    };
  }

  const zone = input.zone ?? batch.destination_zone ?? 'Old Dhaka';
  const claimedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('batches')
    .update({
      status: 'sme_inventory',
      sme_owner_id: smeOwnerId,
    })
    .eq('id', batchId);

  if (updateErr) {
    return { ok: false, error: updateErr.message, status: 500 };
  }

  const recommendations = await calculateOptimalSaleWindow({
    zone,
    moisturePct: metrics.moisture_pct,
    trustScore: batch.trust_score ?? 70,
    packagingType: batch.packaging_type ?? 'Standard',
    category: metrics.category,
  });

  const ledgerMetadata: Record<string, unknown> = {
    storage_condition: input.storage_condition ?? 'shaded',
    ip_hash: clientIpHash ?? null,
    zone,
    trust_score: batch.trust_score,
    sale_window: recommendations.best_sale_window,
    risk_level: recommendations.risk_level,
    days_viable: recommendations.days_viable,
    climate_diagnostics: recommendations.diagnostics,
    claimed_at: claimedAt,
    ...(input.metadata ?? {}),
  };

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from('batch_custody_ledger')
    .insert({
      batch_id: batchId,
      actor_id: smeOwnerId,
      action_type: 'sme_receipt',
      gps_latitude: input.gps_latitude ?? null,
      gps_longitude: input.gps_longitude ?? null,
      metadata: ledgerMetadata,
    })
    .select('id')
    .single();

  if (ledgerErr || !ledgerRow) {
    return {
      ok: false,
      error: ledgerErr?.message ?? 'Failed to append SME receipt event',
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      product_saved: true,
      batch_id: batchId,
      status: 'sme_inventory',
      sme_owner_id: smeOwnerId,
      custody_event_id: ledgerRow.id,
      recommendations: {
        best_sale_window: recommendations.best_sale_window,
        risk_level: recommendations.risk_level,
        days_viable: recommendations.days_viable,
      },
    },
  };
}
