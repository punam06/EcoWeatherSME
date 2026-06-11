import { Client } from 'pg';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface DbHealthSnapshot {
  supabaseConfigured: boolean;
  supabaseReachable: boolean;
  postgresConfigured: boolean;
  postgresReachable: boolean;
  postgresLatencyMs: number | null;
  supabaseError: string | null;
  postgresError: string | null;
  serverTime: string | null;
}

function redactConnectionError(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .replace(/password=[^\s&]+/gi, 'password=***');
}

export async function checkPostgresConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  serverTime?: string;
  error?: string;
}> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return { ok: false, error: 'DATABASE_URL not configured' };
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('sslmode=require') || url.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 8000,
  });

  const started = Date.now();
  try {
    await client.connect();
    const result = await client.query('SELECT NOW() AS now');
    const serverTime = result.rows[0]?.now
      ? new Date(result.rows[0].now).toISOString()
      : undefined;
    return { ok: true, latencyMs: Date.now() - started, serverTime };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: redactConnectionError(message) };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function checkSupabaseRest(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase env vars not configured' };
  }
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('batches').select('id').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getDbHealthSnapshot(): Promise<DbHealthSnapshot> {
  const postgresConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const supabaseConfigured = isSupabaseConfigured();

  const pgResult = postgresConfigured
    ? await checkPostgresConnection()
    : { ok: false, error: 'DATABASE_URL not configured' as string };
  const sbResult = supabaseConfigured
    ? await checkSupabaseRest()
    : { ok: false, error: 'Supabase not configured' as string };

  return {
    supabaseConfigured,
    supabaseReachable: sbResult.ok,
    postgresConfigured,
    postgresReachable: pgResult.ok,
    postgresLatencyMs: pgResult.ok ? (pgResult.latencyMs ?? null) : null,
    supabaseError: sbResult.ok ? null : (sbResult.error ?? null),
    postgresError: pgResult.ok ? null : (pgResult.error ?? null),
    serverTime: pgResult.ok ? (pgResult.serverTime ?? null) : null,
  };
}
