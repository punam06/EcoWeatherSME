/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — REDX CARRIER ADAPTER
 * File: src/adapters/carriers/redx.adapter.ts
 *
 * Adapter for the REDX last-mile delivery API.
 * When REDX_API_KEY is not set, returns realistic demo tracking
 * data so the UI pipeline remains fully functional.
 *
 * API docs: https://docs.redx.com.bd (simulated)
 * ═══════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch';

export interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export interface TrackingResult {
  trackingId: string;
  carrier: string;
  currentStatus: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  source: 'live' | 'demo';
}

const REDX_BASE_URL = 'https://openapi.redx.com.bd/v1.0.0-beta';

/**
 * Fetches tracking data for a given REDX parcel ID.
 * Falls back to deterministic demo data when the API key is absent.
 */
export async function getRedxTracking(parcelId: string): Promise<TrackingResult> {
  const apiKey = process.env.REDX_API_KEY;

  if (!apiKey) {
    return generateDemoTracking(parcelId, 'RedX');
  }

  try {
    const url = `${REDX_BASE_URL}/parcel/info/${encodeURIComponent(parcelId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[RedxAdapter] API returned ${res.status} for parcel ${parcelId}`);
      return generateDemoTracking(parcelId, 'RedX');
    }

    const data: any = await res.json();

    return {
      trackingId: parcelId,
      carrier: 'RedX',
      currentStatus: data.parcel?.status ?? 'Unknown',
      estimatedDelivery: data.parcel?.estimated_delivery ?? null,
      events: (data.tracking_events ?? []).map((e: any): TrackingEvent => ({
        timestamp: e.time ?? new Date().toISOString(),
        status: e.status ?? 'Unknown',
        location: e.location ?? 'Bangladesh',
        description: e.note ?? '',
      })),
      source: 'live',
    };
  } catch (err) {
    console.error('[RedxAdapter] Fetch failed:', err instanceof Error ? err.message : String(err));
    return generateDemoTracking(parcelId, 'RedX');
  }
}

// ── Demo Data Generator ───────────────────────────────────────────────────────

function generateDemoTracking(trackingId: string, carrier: string): TrackingResult {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const estDelivery = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

  return {
    trackingId,
    carrier,
    currentStatus: 'In Transit',
    estimatedDelivery: estDelivery,
    events: [
      {
        timestamp: twoHoursAgo,
        status: 'Picked Up',
        location: 'Mirpur Hub, Dhaka',
        description: 'Parcel picked up from processor facility.',
      },
      {
        timestamp: hourAgo,
        status: 'In Transit',
        location: 'Tejgaon Distribution Centre, Dhaka',
        description: 'Parcel in transit to delivery zone.',
      },
      {
        timestamp: now.toISOString(),
        status: 'Out for Delivery',
        location: 'Old Dhaka Zone',
        description: 'Parcel out for final delivery.',
      },
    ],
    source: 'demo',
  };
}
