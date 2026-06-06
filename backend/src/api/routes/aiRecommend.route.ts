/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — AI RECOMMEND ROUTE
 * File: src/api/routes/aiRecommend.route.ts
 *
 * POST /api/ai/recommend
 * Validates input, runs Claude RAG similarity search query, logs to Supabase.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AIRecommendRequestSchema } from '../schemas';
import { queryClaudeRAG } from '../../lib/services/rag.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { aiRateLimiter } from '../../lib/middleware/rateLimiter';
import { isContentClean } from '../../lib/utils/moderationFilter';

const router = Router();

/**
 * POST /api/ai/recommend
 *
 * Body: { query: string, language: "bn" | "en" }
 * Response: { success: true, data: RAGResult }
 */
router.post('/', aiRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ── 1. Validate request body ───────────────────────────
    const parsed = AIRecommendRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: (parsed.error as ZodError).issues,
      });
      return;
    }

    const { query, language } = parsed.data;

    // ── 2. Safety Moderation Filter Check ──────────────────
    if (!isContentClean(query)) {
      res.status(400).json({
        success: false,
        error: language === 'bn'
          ? 'সংবেদনশীল বা অননুমোদিত কন্টেন্ট সনাক্ত করা হয়েছে।'
          : 'Sensitive or disallowed content detected in message.',
      });
      return;
    }

    // ── 3. Run Claude RAG query ────────────────────────────
    const ragResult = await queryClaudeRAG(query, language);

    // ── 4. Async log to Supabase (fire and forget) ─────────
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      supabase
        .from('rag_query_logs')
        .insert({
          query,
          language,
          answer: ragResult.answer,
          tokens_used: ragResult.tokensUsed,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[AIRecommend] Supabase log failed:', error.message);
          }
        });
    }

    // ── 5. Return result ───────────────────────────────────
    res.status(200).json({
      success: true,
      data: ragResult,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
