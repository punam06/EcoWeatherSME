/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — AI CHAT LIFECYCLE & VOICE RECOMMEND ROUTES
 * File: src/api/routes/aiChat.route.ts
 *
 * Implements AI session management, speech recommendation,
 * and rate-limited conversational groundings.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiRateLimiter } from '../../lib/middleware/rateLimiter';
import { isContentClean } from '../../lib/utils/moderationFilter';
import { detectLanguageFromText } from '../../lib/utils/languageNormalizer';
import { createSession, destroySession } from '../../lib/services/chatSession.service';
import { processMessage } from '../../lib/services/agentOrchestrator.service';

const router = Router();

const StartSessionSchema = z.object({
  farmerId: z.string().optional(),
});

const EndSessionSchema = z.object({
  sessionId: z.string({ required_error: 'sessionId is required' }),
});

/**
 * POST /api/ai/chat/start
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = StartSessionSchema.safeParse(req.body);
    const farmerId = parsed.success ? parsed.data.farmerId : undefined;
    const session = createSession(farmerId);
    res.status(200).json({ success: true, data: { sessionId: session.sessionId } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/chat/message
 */
router.post('/message', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = z.object({
      query: z.string().min(1),
      language: z.enum(['en', 'bn']),
      sessionId: z.string(),
      farmerId: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }

    const { query, language, sessionId, farmerId } = parsed.data;

    // Auto-detect language if the user sent the default 'en'
    const detectedLanguage = detectLanguageFromText(query);
    const finalLanguage = language !== 'en' ? language : detectedLanguage;

    if (!isContentClean(query)) {
      res.status(400).json({ success: false, error: 'Moderation check failed' });
      return;
    }

    const result = await processMessage(query, finalLanguage, sessionId, farmerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/ai/chat/end
 */
router.delete('/end', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = EndSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }
    destroySession(parsed.data.sessionId);
    res.status(200).json({ success: true, message: 'Session ended successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/voice-recommend
 */
router.post('/voice-recommend', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = z.object({
      query: z.string().min(1),
      language: z.enum(['en', 'bn']),
      sessionId: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }

    const { query, language, sessionId } = parsed.data;

    // Auto-detect language if the user sent the default 'en'
    const detectedLanguage = detectLanguageFromText(query);
    const finalLanguage = language !== 'en' ? language : detectedLanguage;

    if (!isContentClean(query)) {
      res.status(400).json({ success: false, error: 'Moderation check failed' });
      return;
    }

    const result = await processMessage(query, finalLanguage, sessionId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
