/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — CHAT SESSION SERVICE (HYBRID)
 * File: src/lib/services/chatSession.service.ts
 *
 * Hybrid session store: in-memory Map for hot-path access +
 * Supabase `agent_sessions` table for cross-restart persistence.
 *
 * On first request for a sessionId, the service checks Supabase.
 * After that, writes are batched async to avoid blocking responses.
 * ═══════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingOrder {
  productId: string;
  productName: string;
  priceBdt: number;
  quantity: number;
  totalBdt: number;
  farmerId?: string;
}

export interface ChatSession {
  sessionId: string;
  userId?: string;
  farmerId?: string;
  history: ChatMessage[];
  pendingOrder?: PendingOrder;
  lastSeenProducts?: any[];
  lastActive: number;
}

// ── In-memory hot cache ───────────────────────────────────────────────────────
const sessions = new Map<string, ChatSession>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// ── DB Sync helpers ──────────────────────────────────────────────────────────

/**
 * Asynchronously persists a session to Supabase (fire-and-forget).
 * Keeps the hot path non-blocking.
 */
function persistSessionAsync(session: ChatSession): void {
  if (!isSupabaseConfigured()) return;

  (async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.from('agent_sessions').upsert(
        {
          session_id: session.sessionId,
          user_id: session.userId || null,
          farmer_id: session.farmerId || null,
          history: session.history as any,
          pending_order: session.pendingOrder ? (session.pendingOrder as any) : null,
          last_seen_products: session.lastSeenProducts ? (session.lastSeenProducts as any) : null,
          last_active: new Date(session.lastActive).toISOString(),
          expires_at: new Date(session.lastActive + SESSION_TTL).toISOString(),
        },
        { onConflict: 'session_id' }
      );
    } catch (err) {
      // Non-critical — in-memory session still valid
      console.warn('[ChatSession] Failed to persist to Supabase:', err);
    }
  })();
}

/**
 * Attempts to restore a session from Supabase if not in cache.
 */
async function restoreSessionFromDB(sessionId: string): Promise<ChatSession | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return undefined;

    const restored: ChatSession = {
      sessionId: data.session_id,
      userId: data.user_id || undefined,
      farmerId: data.farmer_id || undefined,
      history: Array.isArray(data.history) ? data.history : [],
      pendingOrder: data.pending_order || undefined,
      lastSeenProducts: data.last_seen_products || undefined,
      lastActive: Date.now(),
    };

    sessions.set(sessionId, restored);
    console.log(`[ChatSession] Restored session ${sessionId} from DB (${restored.history.length} messages)`);
    return restored;
  } catch (err) {
    console.warn('[ChatSession] Failed to restore session from DB:', err);
    return undefined;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a brand new chat session.
 */
export function createSession(farmerId?: string, userId?: string): ChatSession {
  const sessionId = `${userId || farmerId || 'guest'}_${Date.now()}`;
  const session: ChatSession = {
    sessionId,
    userId,
    farmerId,
    history: [],
    lastActive: Date.now(),
  };
  sessions.set(sessionId, session);
  persistSessionAsync(session);
  return session;
}

/**
 * Retrieves an existing session (from memory or DB), updating its activity timestamp.
 * Must be awaited for the first lookup to support DB restoration.
 */
export async function getSessionAsync(sessionId: string): Promise<ChatSession | undefined> {
  let session = sessions.get(sessionId);
  if (session) {
    session.lastActive = Date.now();
    return session;
  }
  // Not in memory — try DB restore
  return restoreSessionFromDB(sessionId);
}

/**
 * Synchronous get (in-memory only). Use getSessionAsync on first lookup.
 */
export function getSession(sessionId: string): ChatSession | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActive = Date.now();
  }
  return session;
}

/**
 * Appends a message to the session's chat history and persists async.
 */
export function appendMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.history.push({ role, content });
    session.lastActive = Date.now();
    // Debounce: persist every 2 messages to reduce DB writes
    if (session.history.length % 2 === 0) {
      persistSessionAsync(session);
    }
  }
}

/**
 * Stores a pending order in the session.
 */
export function setPendingOrder(sessionId: string, pendingOrder?: PendingOrder): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.pendingOrder = pendingOrder;
    session.lastActive = Date.now();
    persistSessionAsync(session);
  }
}

/**
 * Clears the pending order from the session.
 */
export function clearPendingOrder(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    delete session.pendingOrder;
    session.lastActive = Date.now();
    persistSessionAsync(session);
  }
}

/**
 * Deletes a session completely.
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
  if (isSupabaseConfigured()) {
    (async () => {
      try {
        const supabase = getSupabaseClient();
        await supabase.from('agent_sessions').delete().eq('session_id', sessionId);
      } catch { /* silently ignore */ }
    })();
  }
}

/**
 * Prunes expired sessions from the in-memory store.
 */
export function pruneSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}

/**
 * Starts a background interval to prune expired sessions.
 */
export function startSessionPruningInterval(): void {
  setInterval(pruneSessions, 5 * 60 * 1000); // Every 5 minutes
}
