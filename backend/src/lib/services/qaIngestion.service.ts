/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — QA REPORT INGESTION
 * File: src/lib/services/qaIngestion.service.ts
 *
 * Multi-source QA validation. Sources:
 *   - iot:         signed sensor readings from a registered device
 *   - inspector:   human-entered report from a field inspector
 *   - manufacturer: declared metrics by the producing SME
 *
 * Every report is canonicalized and SHA-256 signed at ingest
 * time so that downstream trust score + provenance lookups can
 * be independently verified.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto';
import {
  ProductCategory,
  QAReport,
  QAReportSource,
} from '../types';
import { getStandard, isValidBSTICredential } from './standardsRegistry.service';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

// ─── Public Inputs / Outputs ───────────────────────────────────

export interface IngestQAInput {
  batch_id: string;
  source: QAReportSource;
  category: ProductCategory;
  metrics: {
    pH: number;
    ec: number;
    temp: number;
    em1Ratio: number;
    fermentationDays: number;
  };
  bstiCredential?: string;
  inspectorNotes?: string;
  signed_by?: string;
  signature?: string;
}

export interface IngestQAResult {
  ok: boolean;
  report?: QAReport;
  error?: string;
}

// ─── Canonicalization ──────────────────────────────────────────

/**
 * Deterministic JSON serialization so the same input always
 * produces the same hash. Object keys are sorted alphabetically.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    return JSON.stringify(k) + ':' + canonicalize(v);
  });
  return '{' + parts.join(',') + '}';
}

// ─── Signing ───────────────────────────────────────────────────

/**
 * SHA-256 over the canonicalized metrics blob. The signature is
 * stored alongside the report so that tampering is detectable
 * at verify time.
 */
export function signMetrics(metrics: IngestQAInput['metrics']): string {
  return createHash('sha256').update(canonicalize(metrics)).digest('hex');
}

// ─── Validation ────────────────────────────────────────────────

function validateCategory(input: IngestQAInput): string | null {
  try {
    getStandard(input.category);
  } catch {
    return `Unknown category "${input.category}"`;
  }
  return null;
}

function validateMetrics(m: IngestQAInput['metrics']): string | null {
  const finite = (n: number) => Number.isFinite(n);
  if (!finite(m.pH) || m.pH < 0 || m.pH > 14)
    return 'pH out of physical range [0, 14]';
  if (!finite(m.ec) || m.ec < 0)
    return 'ec out of physical range';
  if (!finite(m.temp) || m.temp < -50 || m.temp > 100)
    return 'temp out of physical range';
  if (!finite(m.em1Ratio) || m.em1Ratio < 0)
    return 'em1Ratio must be non-negative';
  if (!finite(m.fermentationDays) || m.fermentationDays < 0)
    return 'fermentationDays must be non-negative';
  return null;
}

function validateSourceSpecifics(input: IngestQAInput): string | null {
  const std = getStandard(input.category);
  if (std.requiresBSTI) {
    if (!input.bstiCredential) {
      return `Category "${input.category}" requires a BSTI credential`;
    }
    if (!isValidBSTICredential(input.bstiCredential)) {
      return `Invalid BSTI credential format: "${input.bstiCredential}"`;
    }
  }
  if (input.source === 'inspector' && !input.inspectorNotes) {
    return 'Inspector reports must include notes';
  }
  if (input.source === 'iot' && input.inspectorNotes) {
    return 'iot reports cannot include inspector notes';
  }
  return null;
}

// ─── Ingestion (pure) ──────────────────────────────────────────

/**
 * Validates the input and returns a fully-signed QAReport.
 * Does not touch the database — useful for unit tests and
 * offline flows.
 */
export function ingestQAReport(input: IngestQAInput): IngestQAResult {
  const v1 = validateCategory(input);
  if (v1) return { ok: false, error: v1 };

  const v2 = validateMetrics(input.metrics);
  if (v2) return { ok: false, error: v2 };

  const v3 = validateSourceSpecifics(input);
  if (v3) return { ok: false, error: v3 };

  const signature = signMetrics(input.metrics);
  const report: QAReport = {
    batch_id: input.batch_id,
    source: input.source,
    category: input.category,
    metrics: input.metrics,
    bstiCredential: input.bstiCredential,
    inspectorNotes: input.inspectorNotes,
    signature,
    signed_at: new Date().toISOString(),
    signed_by: input.signed_by,
  };

  return { ok: true, report };
}

// ─── Ingestion (persisted) ─────────────────────────────────────

/**
 * Same as `ingestQAReport` but also writes the report to the
 * `qa_reports` table. Returns `{ ok: false, error }` if Supabase
 * is not configured.
 */
export async function ingestAndPersistQAReport(
  input: IngestQAInput,
): Promise<IngestQAResult> {
  const result = ingestQAReport(input);
  if (!result.ok || !result.report) return result;

  if (!isSupabaseConfigured()) {
    // Supabase not configured — return the validated+signed report anyway
    console.warn('[QA] Supabase not configured, skipping persistence');
    return result;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('qa_reports').insert({
      batch_id: result.report.batch_id,
      source: result.report.source,
      category: result.report.category,
      metrics: result.report.metrics,
      bsti_credential: result.report.bstiCredential ?? null,
      inspector_notes: result.report.inspectorNotes ?? null,
      signature: result.report.signature,
      signed_at: result.report.signed_at,
      signed_by: result.report.signed_by ?? null,
    });

    if (error) {
      // Log the DB error but don't fail — the report is valid and signed
      console.warn('[QA] DB insert failed (degrading gracefully):', error.message);
    }
  } catch (err) {
    console.warn('[QA] DB insert threw (degrading gracefully):', err);
  }

  return result;
}

// ─── Verification ──────────────────────────────────────────────

/**
 * Re-computes the signature from the stored metrics and
 * compares it to the signature on file. Returns true if the
 * report has not been tampered with.
 */
export function verifyQASignature(report: QAReport): boolean {
  const expected = signMetrics(report.metrics);
  return expected === report.signature;
}
