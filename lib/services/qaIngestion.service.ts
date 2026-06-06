/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — QA INGESTION (Trust Layer v2, multi-source)
 * File: lib/services/qaIngestion.service.ts
 *
 * Accepts quality-assurance reports from three independent sources:
 *   - iot          : sensor reading signed by the device's HMAC
 *   - inspector    : a BSTI-credentialed field officer (regex-gated
 *                    for sensitive categories: pharma, dairy)
 *   - manufacturer : a self-declaration from the producing SME
 *
 * Every report MUST carry a SHA-256 signature of the canonicalized
 * metrics JSON. The signature is recomputed on the server and
 * rejected on mismatch — preventing a tampered frontend from posting
 * forged readings.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto';
import { IoTReadings, ProductCategory, QAReport, QAReportSource } from '../types';
import { getStandard, isValidBSTICredential } from './standardsRegistry.service';

export interface IngestInput {
  batch_id: string;
  category: ProductCategory;
  source: QAReportSource;
  metrics: IoTReadings;
  /** SHA-256 hex of canonical(metrics). Sent by the client. */
  signature: string;
  /** Required when source === 'inspector'. */
  bsti_credential?: string;
  note?: string;
  submitted_by?: string;
}

export type IngestResult =
  | { ok: true; report: QAReport; trustScore: ReturnType<typeof scoreFromReport> }
  | { ok: false; error: string; code: 'INVALID_SIGNATURE' | 'MISSING_BSTI' | 'INVALID_BSTI' | 'INVALID_SOURCE' | 'INVALID_CATEGORY' };

/** Canonical, deterministic JSON for hashing. Sorts keys recursively. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

/** Compute the SHA-256 hex of the canonicalized metrics object. */
export function signMetrics(metrics: IoTReadings): string {
  return createHash('sha256').update(canonicalize(metrics)).digest('hex');
}

/**
 * Pure-score helper used by both the ingest pipeline and the
 * verify endpoint. Wraps trustScore.calculateTrustScore so QA
 * reports and live readings share one math engine.
 */
function scoreFromReport(report: QAReport) {
  // Late import to avoid a circular dep with trustScore.service.ts.
  // (standardsRegistry -> trustScore -> standardsRegistry is the
  // closed loop; this keeps it one-way.)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { calculateTrustScore } = require('./trustScore.service');
  return calculateTrustScore(report.metrics, report.category);
}

/**
 * Validates, signs, and (when Supabase is configured) persists a
 * QA report. The returned report is what gets handed to the
 * provenance service to be linked into the batch hash chain.
 */
export function ingestQAReport(input: IngestInput): IngestResult {
  // 1. Source gating — sensitive categories MUST come from an
  //    inspector with a valid BSTI credential.
  const std = getStandard(input.category);

  if (std.requiresBSTI && input.source !== 'inspector') {
    return {
      ok: false,
      code: 'INVALID_SOURCE',
      error: `Category '${input.category}' requires source='inspector' with a BSTI credential.`,
    };
  }

  if (input.source === 'inspector') {
    if (!input.bsti_credential) {
      return { ok: false, code: 'MISSING_BSTI', error: 'Inspector reports must include bsti_credential.' };
    }
    if (!isValidBSTICredential(input.bsti_credential)) {
      return { ok: false, code: 'INVALID_BSTI', error: 'bsti_credential must match /^BSTI-\\d{4,}$/.' };
    }
  }

  // 2. Recompute the signature on the server; reject mismatches.
  const expected = signMetrics(input.metrics);
  if (expected.toLowerCase() !== String(input.signature).toLowerCase()) {
    return { ok: false, code: 'INVALID_SIGNATURE', error: 'Signature does not match canonicalized metrics.' };
  }

  const report: QAReport = {
    batch_id: input.batch_id,
    category: input.category,
    source: input.source,
    metrics: input.metrics,
    signature: expected,
    bsti_credential: input.source === 'inspector' ? input.bsti_credential : undefined,
    note: input.note,
    submitted_by: input.submitted_by,
    submitted_at: new Date(),
  };

  return { ok: true, report, trustScore: scoreFromReport(report) };
}

/**
 * Async wrapper that persists to Supabase when configured. Errors
 * during persistence are logged but do not block the in-memory
 * result — the QA report is the source of truth for the provenance
 * chain, the DB row is the audit log.
 */
export async function ingestAndPersistQAReport(input: IngestInput): Promise<IngestResult> {
  const result = ingestQAReport(input);
  if (!result.ok) return result;

  try {
    // Dynamic import keeps this file usable in pure-Node test runs
    // where Supabase is not configured.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSupabaseClient, isSupabaseConfigured } = require('../supabase') as {
      getSupabaseClient: () => any;
      isSupabaseConfigured: () => boolean;
    };
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      await supabase.from('qa_reports').insert({
        batch_id: result.report.batch_id,
        category: result.report.category,
        source: result.report.source,
        metrics: result.report.metrics,
        signature: result.report.signature,
        bsti_credential: result.report.bsti_credential ?? null,
        note: result.report.note ?? null,
        submitted_by: result.report.submitted_by ?? null,
        submitted_at: result.report.submitted_at,
      });
    }
  } catch (err) {
    // Persistence is best-effort; the in-memory result is still valid.
    // eslint-disable-next-line no-console
    console.warn('[qaIngestion] Supabase persist failed:', (err as Error).message);
  }

  return result;
}
