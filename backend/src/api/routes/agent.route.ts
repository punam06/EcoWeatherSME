/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT CHAT & TRANSACTION COMMERCE ROUTES
 * File: src/api/routes/agent.route.ts
 *
 * Implements agent messaging, dialect normalization, and dedicated
 * voice commerce transaction endpoints with Zod validation.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiRateLimiter } from '../../lib/middleware/rateLimiter';
import { isContentClean } from '../../lib/utils/moderationFilter';
import { detectLanguageFromText, dialectNormalizer } from '../../lib/utils/languageNormalizer';
import { processMessage } from '../../lib/services/agentOrchestrator.service';

const router = Router();

const AgentMessageSchema = z.object({
  query: z
    .string({ required_error: 'query is required' })
    .min(1, 'query cannot be empty')
    .max(2000, 'query too long'),
  language: z.enum(['en', 'bn'], { required_error: 'language must be en or bn' }),
  sessionId: z.string().optional(),
  farmerId: z.string().optional(),
});

/**
 * POST /api/agent/message
 */
router.post('/message', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = AgentMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const { query, language, sessionId, farmerId } = parsed.data;
    
    // Normalise incoming dialects / accent variants (Sylheti, Chittagonian, North Bengal)
    const normalizedQuery = dialectNormalizer(query);
    
    // Auto-detect language if the user sent the default 'en'
    const detectedLanguage = detectLanguageFromText(normalizedQuery);
    const finalLanguage = language !== 'en' ? language : detectedLanguage;

    // Safety moderation check
    if (!isContentClean(normalizedQuery)) {
      res.status(400).json({
        success: false,
        error: finalLanguage === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    const agentResult = await processMessage(normalizedQuery, finalLanguage, sessionId, farmerId);

    res.status(200).json({
      success: true,
      data: agentResult,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agent/voice-message
 * Voice transcripts forwarded to agent pipeline. Same handler.
 */
router.post('/voice-message', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = AgentMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const { query, language, sessionId, farmerId } = parsed.data;

    // Normalise incoming dialects / accent variants
    const normalizedQuery = dialectNormalizer(query);

    // Auto-detect language if the user sent the default 'en'
    const detectedLanguage = detectLanguageFromText(normalizedQuery);
    const finalLanguage = language !== 'en' ? language : detectedLanguage;

    // Safety moderation check
    if (!isContentClean(normalizedQuery)) {
      res.status(400).json({
        success: false,
        error: finalLanguage === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    const agentResult = await processMessage(normalizedQuery, finalLanguage, sessionId, farmerId);

    res.status(200).json({
      success: true,
      data: agentResult,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders/voice (also mounted as /api/agent/orders/voice)
 * Direct transactional agent endpoint. Parses speech intent, queries catalog,
 * and submits orders with Zod validation, rate limiting, and dialect normalization.
 */
router.post('/orders/voice', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = AgentMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const { query, language, sessionId, farmerId } = parsed.data;

    // Normalise dialect variants to standard terms first
    const normalizedQuery = dialectNormalizer(query);

    // Auto-detect language
    const detectedLanguage = detectLanguageFromText(normalizedQuery);
    const finalLanguage = language !== 'en' ? language : detectedLanguage;

    // Safety moderation check
    if (!isContentClean(normalizedQuery)) {
      res.status(400).json({
        success: false,
        error: finalLanguage === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    // Call the orchestrator to execute the agentic order flow
    const agentResult = await processMessage(normalizedQuery, finalLanguage, sessionId, farmerId);

    res.status(200).json({
      success: true,
      data: agentResult,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
