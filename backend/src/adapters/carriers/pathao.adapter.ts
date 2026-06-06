/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — PATHAO CARRIER ADAPTER
 * File: src/adapters/carriers/pathao.adapter.ts
 *
 * Adapter for the Pathao courier API.
 * When PATHAO_CLIENT_ID/SECRET are not configured, returns
 * realistic demo tracking data for the UI pipeline.
 *
 * API docs: https://developers.pathao.com (simulated)
 * ═══════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch';
import type { TrackingResult, TrackingEvent } from './redx.adapter';

export type { TrackingResult, TrackingEvent };

const PATHAO_BASE_URL = 'https://api-hermes.pathao.com/aladdin/api/v1';

let pathaoToken: string | null = null;
let tokenExpiry = 0;

/**
 * Authenticates with the Pathao API and caches the token.
 * Returns null when credentials are missing.
 */
async function getPathaoToken(): Promise<string | null> {
  const clientId = process.env.PATHAO_CLIENT_ID;
  const clientSecret = process.env.PATHAO_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;
  if (pathaoToken && Date.now() < tokenExpiry) return pathaoToken;

  try {
    const res = await fetch(`${PATHAO_BASE_URL}/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        username: process.env.PATHAO_USERNAME ?? '',
        password: process.env.PATHAO_PASSWORD ?? '',
      }),
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    pathaoToken = data.access_token ?? null;
    tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000 - 60000;
    return pathaoToken;
  } catch {
    return null;
  }
}

/**
 * Fetches tracking data for a given Pathao consignment ID.
 * Falls back to deterministic demo data when credentials are absent.
 */
export async function getPathaoTracking(consignmentId: string): Promise<TrackingResult> {
  const token = await getPathaoToken();

  if (!token) {
    return generateDemoTracking(consignmentId, 'Pathao');
  }

  try {
    const url = `${PATHAO_BASE_URL}/orders/${encodeURIComponent(consignmentId)}/info`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[PathaoAdapter] API returned ${res.status} for consignment ${consignmentId}`);
      return generateDemoTracking(consignmentId, 'Pathao');
    }

    const data: any = await res.json();
    const order = data.data ?? {};

    return {
      trackingId: consignmentId,
      carrier: 'Pathao',
      currentStatus: order.order_status ?? 'Unknown',
      estimatedDelivery: null, // Pathao doesn't expose ETA in standard API
      events: (order.timeline ?? []).map((e: any): TrackingEvent => ({
        timestamp: e.created_at ?? new Date().toISOString(),
        status: e.title ?? 'Unknown',
        location: e.location ?? 'Dhaka',
        description: e.description ?? '',
      })),
      source: 'live',
    };
  } catch (err) {
    console.error('[PathaoAdapter] Fetch failed:', err instanceof Error ? err.message : String(err));
    return generateDemoTracking(consignmentId, 'Pathao');
  }
}

// ── Demo Data Generator ───────────────────────────────────────────────────────

function generateDemoTracking(trackingId: string, carrier: string): TrackingResult {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();

  return {
    trackingId,
    carrier,
    currentStatus: 'Processing',
    estimatedDelivery: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    events: [
      {
        timestamp: twoHoursAgo,
        status: 'Order Created',
        location: 'Seller Warehouse, Mirpur',
        description: 'Shipment created and assigned to Pathao courier.',
      },
      {
        timestamp: hourAgo,
        status: 'Picked Up',
        location: 'Mirpur Pathao Hub',
        description: 'Package collected by Pathao rider.',
      },
      {
        timestamp: now.toISOString(),
        status: 'Processing',
        location: 'Pathao Gulshan Sorting Centre',
        description: 'Package is being sorted for delivery route.',
      },
    ],
    source: 'demo',
  };
}
