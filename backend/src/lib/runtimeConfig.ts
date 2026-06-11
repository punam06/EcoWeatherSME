import { isSupabaseConfigured } from './supabase';

export const APP_NAME = 'ClimaLogix AI (ClimateShield)';
export const BACKEND_ENTRY = 'backend/src/app.ts → dist/app.js';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/** In-memory stores are allowed only in automated tests or explicit dev override. */
export function allowMemoryFallback(): boolean {
  if (isTest()) return true;
  if (process.env.ALLOW_MEMORY_FALLBACK === 'true' && !isProduction()) return true;
  return false;
}

export function useMemoryStore(): boolean {
  if (isProduction()) return false;
  if (allowMemoryFallback()) return !isSupabaseConfigured();
  return false;
}

export function requireSupabaseInProduction(): void {
  if (!isProduction()) return;
  if (!isSupabaseConfigured()) {
    console.error('[Startup] FATAL: Supabase is required in production (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[Startup] FATAL: JWT_SECRET must be set (recommended ≥64 chars) in production.');
    process.exit(1);
  }
}

export function publicBackendUrl(): string {
  return (
    process.env.PUBLIC_BACKEND_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.BACKEND_API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:5001'
  ).replace(/\/+$/, '');
}

export function publicFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://ecoweathersme.onrender.com'
  ).replace(/\/+$/, '');
}
