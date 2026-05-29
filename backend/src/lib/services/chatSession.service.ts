/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — CHAT SESSION SERVICE
 * File: src/lib/services/chatSession.service.ts
 *
 * Simple in-memory session store managing multi-turn conversation
 * state, pending orders, and automatic cache pruning on boot.
 * ═══════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';

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
  farmerId?: string;
  history: ChatMessage[];
  pendingOrder?: PendingOrder;
  lastSeenProducts?: any[];
  lastActive: number;
}

const sessions = new Map<string, ChatSession>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes TTL

/**
 * Creates a brand new chat session.
 */
export function createSession(farmerId?: string): ChatSession {
  const sessionId = uuidv4();
  const session: ChatSession = {
    sessionId,
    farmerId,
    history: [],
    lastActive: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

/**
 * Retrieves an existing session, updating its activity timestamp.
 */
export function getSession(sessionId: string): ChatSession | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActive = Date.now();
  }
  return session;
}

/**
 * Appends a message to the session's chat history.
 */
export function appendMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const session = getSession(sessionId);
  if (session) {
    session.history.push({ role, content });
    session.lastActive = Date.now();
  }
}

/**
 * Stores a pending order in the session.
 */
export function setPendingOrder(sessionId: string, pendingOrder?: PendingOrder): void {
  const session = getSession(sessionId);
  if (session) {
    session.pendingOrder = pendingOrder;
    session.lastActive = Date.now();
  }
}

/**
 * Clears the pending order from the session.
 */
export function clearPendingOrder(sessionId: string): void {
  const session = getSession(sessionId);
  if (session) {
    delete session.pendingOrder;
    session.lastActive = Date.now();
  }
}

/**
 * Deletes a session completely (e.g. on chat end).
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Prunes expired sessions from the store.
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
