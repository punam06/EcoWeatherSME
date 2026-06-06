/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — AI COST SHIELD MIDDLEWARE
 * File: src/middleware/aiCostShield.ts
 *
 * Purpose:
 *  1. Counts Groq API calls per IP/userId over a 15-min window.
 *  2. Enforces a budget cap (default: 50 AI calls / 15 min per IP).
 *  3. Logs every call to an in-memory usage ledger (no DB needed).
 *  4. Exposes a usage snapshot via getUsageReport().
 * ═══════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';

// ── Configuration ────────────────────────────────────────────────────────────

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_BUDGET_CALLS = 50; // per IP per window

// Estimated cost constants (USD) for Groq Llama-3.3-70b-versatile
// https://console.groq.com/docs/openai — approximate pricing
const COST_PER_INPUT_TOKEN = 0.00000059;   // $0.59 / 1M input tokens
const COST_PER_OUTPUT_TOKEN = 0.00000079;  // $0.79 / 1M output tokens

// ── In-Memory Usage Store ────────────────────────────────────────────────────

interface WindowEntry {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  windowStart: number;
}

const usageStore = new Map<string, WindowEntry>();

/** Returns the key used for the usage store. Prefers userId over IP. */
function getKey(req: Request): string {
  const user = (req as any).user;
  const userId = user?.id ?? user?.user_metadata?.id;
  if (userId) return `user:${userId}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

/** Cleans up expired windows to prevent memory leak. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of usageStore.entries()) {
    if (now - entry.windowStart > WINDOW_MS) {
      usageStore.delete(key);
    }
  }
}

/** Increments call/token counters, resetting the window if stale. */
export function recordUsage(key: string, inputTokens: number, outputTokens: number): void {
  const now = Date.now();
  const existing = usageStore.get(key);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    usageStore.set(key, { calls: 1, inputTokens, outputTokens, windowStart: now });
  } else {
    existing.calls += 1;
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that enforces AI call budget per user/IP.
 * Place BEFORE the AI route handler to block over-budget callers.
 *
 * @param budgetCalls - maximum AI calls per 15-min window (default: 50)
 */
export function aiCostShield(budgetCalls: number = DEFAULT_BUDGET_CALLS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    pruneExpired();

    const key = getKey(req);
    const now = Date.now();
    const entry = usageStore.get(key);

    if (entry && now - entry.windowStart <= WINDOW_MS) {
      if (entry.calls >= budgetCalls) {
        const resetInMs = WINDOW_MS - (now - entry.windowStart);
        const resetInSec = Math.ceil(resetInMs / 1000);
        res.status(429).json({
          success: false,
          error: 'AI budget limit reached.',
          message: `You have used ${entry.calls} AI calls in the last 15 minutes. Limit: ${budgetCalls}. Reset in ${resetInSec}s.`,
          retryAfterSeconds: resetInSec,
        });
        return;
      }
    }

    // Record this call with a rough token estimate (will be updated later if tokens known)
    recordUsage(key, 0, 0);

    next();
  };
}

// ── Usage Report ─────────────────────────────────────────────────────────────

export interface UsageReportEntry {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  windowStart: string;
}

/**
 * Returns the current usage snapshot for all active windows.
 * Used by GET /api/ai/cost-report.
 */
export function getUsageReport(): UsageReportEntry[] {
  pruneExpired();
  const report: UsageReportEntry[] = [];

  for (const [key, entry] of usageStore.entries()) {
    const estimatedCostUSD =
      entry.inputTokens * COST_PER_INPUT_TOKEN +
      entry.outputTokens * COST_PER_OUTPUT_TOKEN;

    report.push({
      key,
      calls: entry.calls,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(6)),
      windowStart: new Date(entry.windowStart).toISOString(),
    });
  }

  return report.sort((a, b) => b.calls - a.calls);
}

/**
 * Returns aggregate totals across all active windows.
 */
export function getAggregateStats() {
  pruneExpired();

  let totalCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const entry of usageStore.values()) {
    totalCalls += entry.calls;
    totalInputTokens += entry.inputTokens;
    totalOutputTokens += entry.outputTokens;
  }

  const estimatedCostUSD =
    totalInputTokens * COST_PER_INPUT_TOKEN +
    totalOutputTokens * COST_PER_OUTPUT_TOKEN;

  return {
    totalCalls,
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(6)),
    activeWindows: usageStore.size,
    windowMs: WINDOW_MS,
    generatedAt: new Date().toISOString(),
  };
}
