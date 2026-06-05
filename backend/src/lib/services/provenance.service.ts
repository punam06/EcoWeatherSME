/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — PROVENANCE HASH CHAIN
 * File: src/lib/services/provenance.service.ts
 *
 * Append-only SHA-256 hash chain for batch lifecycle events.
 * Each event's `current_hash` is computed from:
 *
 *   sha256(prev_hash || event_type || canonical(event_data))
 *
 * Verifying a chain re-computes every hash from the genesis and
 * compares to the stored values. Any mismatch indicates a
 * tampered event.
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from 'crypto';
import { canonicalize } from './qaIngestion.service';
import {
  ProvenanceChain,
  ProvenanceEvent,
  ProvenanceEventType,
} from '../types';

// ─── Hashing Primitive ─────────────────────────────────────────

export const GENESIS_HASH = '0'.repeat(64);

function hashEvent(
  prev_hash: string,
  type: ProvenanceEventType,
  data: Record<string, unknown>,
): string {
  return createHash('sha256')
    .update(prev_hash)
    .update('|')
    .update(type)
    .update('|')
    .update(canonicalize(data))
    .digest('hex');
}

// ─── Event Building ────────────────────────────────────────────

export interface BuildEventInput {
  seq: number;
  type: ProvenanceEventType;
  actor?: string;
  data: Record<string, unknown>;
  prev_hash: string;
  timestamp?: string;
}

export function buildEvent(input: BuildEventInput): ProvenanceEvent {
  const ts = input.timestamp ?? new Date().toISOString();
  const current_hash = hashEvent(input.prev_hash, input.type, {
    ...input.data,
    __ts: ts,
  });
  return {
    seq: input.seq,
    type: input.type,
    actor: input.actor,
    data: input.data,
    prev_hash: input.prev_hash,
    current_hash,
    timestamp: ts,
  };
}

// ─── Append / Verify ───────────────────────────────────────────

export function appendEvent(
  chain: ProvenanceEvent[],
  type: ProvenanceEventType,
  data: Record<string, unknown>,
  actor?: string,
): ProvenanceEvent {
  const prev = chain.length === 0
    ? GENESIS_HASH
    : chain[chain.length - 1].current_hash;
  const seq = chain.length === 0 ? 0 : chain[chain.length - 1].seq + 1;
  return buildEvent({
    seq,
    type,
    actor,
    data,
    prev_hash: prev,
  });
}

/**
 * Verifies a chain by re-computing every event's hash from its
 * prev_hash and comparing. Returns `{ verified, reason }`.
 */
export function verifyChain(chain: ProvenanceEvent[]): {
  verified: boolean;
  reason?: string;
} {
  let prev = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const ev = chain[i];
    if (ev.prev_hash !== prev) {
      return {
        verified: false,
        reason: `event ${i}: prev_hash mismatch`,
      };
    }
    const expected = hashEvent(ev.prev_hash, ev.type, {
      ...ev.data,
      __ts: ev.timestamp,
    });
    if (expected !== ev.current_hash) {
      return {
        verified: false,
        reason: `event ${i}: current_hash mismatch (tampered)`,
      };
    }
    prev = ev.current_hash;
  }
  return { verified: true };
}

// ─── Chain Assembly ────────────────────────────────────────────

/**
 * Builds a ProvenanceChain view object with the head hash and
 * verification result. Pure function — does not touch the DB.
 */
export function assembleChain(
  batch_id: string,
  events: ProvenanceEvent[],
): ProvenanceChain {
  const head_hash =
    events.length === 0 ? GENESIS_HASH : events[events.length - 1].current_hash;
  const { verified } = verifyChain(events);
  return { batch_id, events, head_hash, verified };
}

// ─── Demo / Offline Helper ─────────────────────────────────────

/**
 * Builds a representative 3-event chain entirely offline —
 * genesis → dispatched → delivered — for live demos when the
 * database is not reachable.
 */
export function demoChain(batch_id: string): ProvenanceChain {
  const genesis = buildEvent({
    seq: 0,
    type: 'genesis',
    actor: 'system',
    data: { batch_id, note: 'batch created' },
    prev_hash: GENESIS_HASH,
    timestamp: '2026-06-01T08:00:00.000Z',
  });

  const dispatch = buildEvent({
    seq: 1,
    type: 'dispatched',
    actor: 'logistics-1',
    data: {
      batch_id,
      vehicle: 'DHK-1234',
      driver: 'rakib',
      temperatureCelsius: 22,
    },
    prev_hash: genesis.current_hash,
    timestamp: '2026-06-01T10:30:00.000Z',
  });

  const delivery = buildEvent({
    seq: 2,
    type: 'delivered',
    actor: 'receiver-7',
    data: {
      batch_id,
      receiver: 'greenmart-dhaka',
      temperatureCelsius: 23,
    },
    prev_hash: dispatch.current_hash,
    timestamp: '2026-06-01T13:15:00.000Z',
  });

  const events = [genesis, dispatch, delivery];
  return assembleChain(batch_id, events);
}
