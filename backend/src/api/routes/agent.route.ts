/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT CHAT ROUTES
 * File: src/api/routes/agent.route.ts
 *
 * Implements agent messaging and voice transcripts routing with
 * Zod validation, moderation safety checks, and rate limiting.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiRateLimiter } from '../../lib/middleware/rateLimiter';
import { isContentClean } from '../../lib/utils/moderationFilter';
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

    // Safety moderation check
    if (!isContentClean(query)) {
      res.status(400).json({
        success: false,
        error: language === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    const agentResult = await processMessage(query, language, sessionId, farmerId);

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

    // Safety moderation check
    if (!isContentClean(query)) {
      res.status(400).json({
        success: false,
        error: language === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    const agentResult = await processMessage(query, language, sessionId, farmerId);

    res.status(200).json({
      success: true,
      data: agentResult,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
