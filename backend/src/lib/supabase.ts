/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — SUPABASE CLIENT
 * File: src/lib/supabase.ts
 *
 * Singleton Supabase client using service role key for server-side
 * operations. All DB access goes through this client — no raw SQL.
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Polyfill WebSocket for older Node.js versions
if (typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    console.warn('WebSocket polyfill not loaded');
  }
}

let _client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client.
 * Throws if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

/**
 * Returns true if Supabase env vars are configured (non-empty, non-placeholder).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return (
    url.length > 0 &&
    key.length > 0 &&
    !url.includes('your-project-id') &&
    !key.includes('your-')
  );
}
