/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — RATE LIMITER MIDDLEWARE
 * File: src/lib/middleware/rateLimiter.ts
 *
 * In-memory IP/Session-based sliding window rate limiter for
 * AI/agent endpoints.
 * ═══════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 30; // Max 30 requests per minute

const requestLogs = new Map<string, number[]>();

export function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'global';
  const now = Date.now();

  let timestamps = requestLogs.get(key) || [];
  
  // Filter out timestamps outside the current window
  timestamps = timestamps.filter((time) => now - time < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again after a minute.',
    });
    return;
  }

  timestamps.push(now);
  requestLogs.set(key, timestamps);
  next();
}
