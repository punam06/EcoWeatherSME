/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — QA INGESTION ROUTE
 * File: src/api/routes/qa.route.ts
 *
 *   POST /api/qa/submit   — accept a QA report from iot / inspector / manufacturer
 *   GET  /api/qa/categories — list the supported product categories
 *
 * Validation is via Zod (`IngestQARequestSchema`). Persistence
 * and signing are handled by `qaIngestion.service.ts`.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { IngestQARequestSchema } from '../schemas';
import {
  ingestAndPersistQAReport,
  verifyQASignature,
} from '../../lib/services/qaIngestion.service';
import { PRODUCT_CATEGORIES, getStandard } from '../../lib/services/standardsRegistry.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

/**
 * GET /api/qa/categories
 *
 * Public list of supported product categories with their
 * acceptable parameter ranges. Useful for the frontend to
 * render a category picker without a separate standards
 * catalog call.
 */
router.get('/categories', (_req: Request, res: Response): void => {
  const data = PRODUCT_CATEGORIES.map((cat) => {
    const std = getStandard(cat);
    return {
      category: std.category,
      label: std.label,
      phRange: std.phRange,
      ecRange: std.ecRange,
      tempRange: std.tempRange,
      minFermentationDays: std.minFermentationDays,
      requiresBSTI: std.requiresBSTI,
      reference: std.reference,
    };
  });
  res.status(200).json({ success: true, data });
});

/**
 * POST /api/qa/submit
 *
 * Body: IngestQARequest (validated by Zod)
 * Response: { success: true, data: { signature, signed_at } }
 *
 * Returns 400 on validation failure, 422 on semantic errors
 * (e.g. BSTI missing for a sensitive category), 500 on
 * unexpected errors.
 */
router.post(
  '/submit',
  authenticateJWT,
  requireRole('inspector'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate
      const parsed = IngestQARequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: (parsed.error as ZodError).issues,
        });
        return;
      }

      // 2. Ingest (validate + sign) and persist
      const result = await ingestAndPersistQAReport(parsed.data);
      if (!result.ok || !result.report) {
        res.status(422).json({
          success: false,
          error: result.error ?? 'Ingestion failed',
        });
        return;
      }

      // 3. Respond with the signature so the client can cross-check
      res.status(201).json({
        success: true,
        data: {
          batch_id: result.report.batch_id,
          signature: result.report.signature,
          signed_at: result.report.signed_at,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/qa/:batch_id
 *
 * Returns all QA reports for a batch. Lightweight public
 * inspection endpoint — no PII returned, only the metrics
 * and signatures.
 */
router.get(
  '/:batch_id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { batch_id } = req.params;
      if (!batch_id || batch_id.length > 100) {
        res.status(400).json({ success: false, error: 'Invalid batch_id' });
        return;
      }

      if (!isSupabaseConfigured()) {
        res.status(503).json({ success: false, error: 'Supabase not configured' });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('qa_reports')
        .select('id, batch_id, source, category, metrics, bsti_credential, inspector_notes, signature, signed_at, signed_by')
        .eq('batch_id', batch_id)
        .order('signed_at', { ascending: true });

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      const verified = (data ?? []).map((row) => ({
        ...row,
        signature_valid: verifyQASignature({
          batch_id: row.batch_id,
          source: row.source,
          category: row.category,
          metrics: row.metrics,
          bstiCredential: row.bsti_credential ?? undefined,
          inspectorNotes: row.inspector_notes ?? undefined,
          signature: row.signature,
          signed_at: row.signed_at,
          signed_by: row.signed_by ?? undefined,
        }),
      }));

      res.status(200).json({ success: true, data: verified });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

