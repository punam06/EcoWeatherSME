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
    const { productName, quantity, farmerId, query, language, sessionId } = req.body;

    // If it's a traditional text query instead of direct order values, fall back to processMessage
    if (query && !productName) {
      const normalizedQuery = dialectNormalizer(query);
      const detectedLanguage = detectLanguageFromText(normalizedQuery);
      const finalLanguage = (language && language !== 'en') ? language : detectedLanguage;

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
      return;
    }

    // Direct transactional order pipeline
    const finalQuantity = typeof quantity === 'number' ? quantity : parseInt(quantity || '1', 10) || 1;
    const buyerId = farmerId || 'demo-farmer-id';

    const { getSupabaseClient, isSupabaseConfigured } = require('../../lib/supabase');
    if (!isSupabaseConfigured()) {
      res.status(500).json({ success: false, error: 'Database is not configured or is offline.' });
      return;
    }

    const supabase = getSupabaseClient();

    // 1. Query Supabase products table
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');

    if (prodError) {
      res.status(500).json({ success: false, error: 'Failed to query product catalog' });
      return;
    }

    // 2. Find the best matching product
    const lowerSearch = (productName || 'fertilizer').toLowerCase();
    const matched = products?.find((p: any) => 
      p.name.toLowerCase().includes(lowerSearch) || 
      (p.description && p.description.toLowerCase().includes(lowerSearch))
    ) || products?.[0]; // Fallback to first if no matches found

    if (!matched) {
      res.status(404).json({ success: false, error: 'No products available to order' });
      return;
    }

    // 3. Insert into orders table with status 'pending'
    const totalBdt = matched.price_bdt * finalQuantity;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        product_id: matched.id,
        quantity: finalQuantity,
        totalBdt,
        status: 'pending'
      })
      .select('*')
      .single();

    if (orderError) {
      res.status(500).json({ success: false, error: `Failed to place order: ${orderError.message}` });
      return;
    }

    // 4. Return confirmation with order ID, product name, quantity
    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        productName: matched.name,
        quantity: finalQuantity,
        totalBdt,
        message: `আপনার অর্ডার সফলভাবে নেওয়া হয়েছে: ${matched.name}, পরিমাণ: ${finalQuantity}।`
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
