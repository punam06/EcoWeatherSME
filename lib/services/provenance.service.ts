/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — PROVENANCE HASH CHAIN (Trust Layer v2)
 * File: lib/services/provenance.service.ts
 *
 * Replaces the old static QR code with a tamper-evident SHA-256
 * hash chain. Every batch event (qa, dispatch, delivery) is
 * hashed together with the previous event's hash, producing a
 * chain anyone can verify by recomputing from the public record.
 *
 * Why this matters for the demo:
 *   - A judge scans the QR, hits GET /api/verify/:batch_id, and
 *     sees the full chain. They can re-hash locally and prove no
 *     event was edited or removed.
 *   - Forged QA reports break the chain because their stored
 *     current_hash no longer matches a fresh recomputation.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto';
import { ProvenanceChain, ProvenanceEvent } from '../types';
import { canonicalize } from './qaIngestion.service';

export type ProvenanceEventType = ProvenanceEvent['event_type'];

/** Compute the hash for one event given its payload and the prev hash. */
export function hashEvent(
  prev_hash: string | null,
  event_type: ProvenanceEventType,
  event_data: Record<string, unknown>
): string {
  const payload = { prev_hash, event_type, event_data };
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

/** Build a single event with its computed hash. */
export function buildEvent(
  batch_id: string,
  event_type: ProvenanceEventType,
  event_data: Record<string, unknown>,
  prev_hash: string | null,
  actor?: string
): ProvenanceEvent {
  return {
    batch_id,
    event_type,
    event_data,
    prev_hash,
    current_hash: hashEvent(prev_hash, event_type, event_data),
    actor,
  };
}

/**
 * Append a new event to an existing chain. Returns the new event
 * AND the updated chain. Pure function — caller handles persistence.
 */
export function appendEvent(
  chain: ProvenanceEvent[],
  event_type: ProvenanceEventType,
  event_data: Record<string, unknown>,
  actor?: string
): ProvenanceEvent {
  if (chain.length === 0) {
    return buildEvent(event_data.batch_id as string ?? 'unknown', event_type, event_data, null, actor);
  }
  const last = chain[chain.length - 1];
  return buildEvent(last.batch_id, event_type, event_data, last.current_hash, actor);
}

/**
 * Verify an entire chain by recomputing every hash from scratch.
 * Returns the chain, whether it is tamper-free, and (if tampered)
 * the index of the first bad event. O(n) cost, no DB needed.
 */
export function verifyChain(batch_id: string, events: ProvenanceEvent[]): ProvenanceChain {
  let expectedPrev: string | null = null;
  let firstTamperedIndex: number | null = null;

  events.forEach((evt, idx) => {
    // The genesis event must have prev_hash === null.
    if (idx === 0 && evt.prev_hash !== null) {
      if (firstTamperedIndex === null) firstTamperedIndex = idx;
    }
    // Every subsequent event must point at the previous current_hash.
    if (idx > 0 && evt.prev_hash !== expectedPrev) {
      if (firstTamperedIndex === null) firstTamperedIndex = idx;
    }
    // Recompute and compare.
    const recomputed = hashEvent(evt.prev_hash, evt.event_type, evt.event_data);
    if (recomputed !== evt.current_hash && firstTamperedIndex === null) {
      firstTamperedIndex = idx;
    }
    expectedPrev = evt.current_hash;
  });

  return {
    batch_id,
    events,
    is_tamper_free: firstTamperedIndex === null,
    first_tampered_index: firstTamperedIndex,
  };
}

/**
 * Builds the genesis event for a batch — the first link in the
 * chain. It captures the batch's category and product name so a
 * consumer scanning the QR knows what they're looking at.
 */
export function genesisEvent(
  batch_id: string,
  event_data: Record<string, unknown>,
  actor = 'system'
): ProvenanceEvent {
  return buildEvent(batch_id, 'qa', event_data, null, actor);
}

/**
 * Convenience: produces a complete demo chain for a batch that has
 * one QA, one dispatch, and one delivery event. Used by the
 * /api/bi/impact and /api/verify endpoints when no DB events exist
 * yet, so the UI always has something to render.
 */
export function demoChain(batch_id: string, category: string, productName: string): ProvenanceChain {
  const genesis = buildEvent(batch_id, 'qa', {
    batch_id,
    category,
    product_name: productName,
    metrics_summary: { pH: 5.2, EC: 3.4, temp: 28, ratio: '1:1:20', days: 9 },
  }, null, 'iot-sensor-07');
  const dispatch = buildEvent(batch_id, 'dispatch', {
    batch_id,
    from: 'Savar Plant',
    to: 'Mirpur Warehouse',
    driver: 'demo-driver-01',
  }, genesis.current_hash, 'logistics-01');
  const delivery = buildEvent(batch_id, 'delivery', {
    batch_id,
    received_by: 'warehouse-mgr-mirpur',
    condition: 'good',
  }, dispatch.current_hash, 'warehouse-01');
  return verifyChain(batch_id, [genesis, dispatch, delivery]);
}
