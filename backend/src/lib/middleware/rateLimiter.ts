/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — RATE LIMITER MIDDLEWARE
 * File: src/lib/middleware/rateLimiter.ts
 *
 * Implements robust IP-based rate limiting using express-rate-limit.
 * ═══════════════════════════════════════════════════════════════
 */

import rateLimit from 'express-rate-limit';

// Global API Rate Limiter: 100 requests per 15 minutes per IP
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests. Please try again after 15 minutes.',
  },
});

// Strict AI/RAG Rate Limiter: 20 requests per 15 minutes per IP
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI search and agent limits reached. Please try again after 15 minutes.',
  },
});

// Strict per-minute AI limiter: 30 requests per 60 seconds per IP
// Applied directly on Groq-backed routes (recommend, agent, chat).
export const strictAiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI request rate too high. Maximum 30 AI requests per minute. Please slow down.',
  },
});
