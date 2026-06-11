/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — QR PROVENANCE ROUTE
 * File: src/api/routes/qr.route.ts
 *
 *   POST /api/qr/generate       — producer intake + trust score + QR URL
 *   POST /api/qr/inspect/:id    — inspector verification + metrics lock
 *   POST /api/qr/sme-claim/:id — SME inventory save + sale window engine
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  BatchUuidParamSchema,
  QRGenerateRequestSchema,
  QRInspectRequestSchema,
  QRSMEClaimRequestSchema,
} from '../schemas';
import {
  claimSMEBatch,
  generateQRBatch,
  inspectQRBatch,
} from '../../lib/services/qrProvenance.service';
import { getApprovedQr } from '../../lib/services/batchVerification.service';
import { authenticateJWT, requireRole } from '../../middleware/authenticateJWT';

const router = Router();

router.get(
  '/:batchId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await getApprovedQr(req.params.batchId);
      if (result.status !== 200) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/qr/generate
 *
 * Body: { initial_metrics: { ph, ec, moisture, category, ... }, ... }
 * Response: { success: true, data: QRGenerateResult }
 */
router.post(
  '/generate',
  authenticateJWT,
  requireRole('producer', 'processor'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = QRGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: (parsed.error as ZodError).issues,
        });
        return;
      }

      const actorId = (req as Request & { user?: { id: string } }).user?.id;
      const result = await generateQRBatch(parsed.data, actorId);

      if (!result.ok || !result.data) {
        res.status(result.status ?? 422).json({
          success: false,
          error: result.error ?? 'QR generation failed',
        });
        return;
      }

      res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/qr/inspect/:id
 *
 * Transitions batch created → inspected, locks initial_metrics,
 * and appends an inspection event to batch_custody_ledger.
 */
router.post(
  '/inspect/:id',
  authenticateJWT,
  requireRole('inspector'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParsed = BatchUuidParamSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid batch id',
          details: (idParsed.error as ZodError).issues,
        });
        return;
      }

      const bodyParsed = QRInspectRequestSchema.safeParse(req.body ?? {});
      if (!bodyParsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: (bodyParsed.error as ZodError).issues,
        });
        return;
      }

      const inspectorId = (req as Request & { user?: { id: string } }).user?.id;
      if (!inspectorId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await inspectQRBatch(
        idParsed.data,
        bodyParsed.data,
        inspectorId,
      );

      if (!result.ok || !result.data) {
        res.status(result.status ?? 422).json({
          success: false,
          error: result.error ?? 'Inspection failed',
        });
        return;
      }

      res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  },
);

function hashClientIp(req: Request): string {
  const raw =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return `h_${Math.abs(h).toString(36)}`;
}

/**
 * POST /api/qr/sme-claim/:id
 *
 * SME owner scans QR → inventory save + predictive sale window.
 */
router.post(
  '/sme-claim/:id',
  authenticateJWT,
  requireRole('sme_owner', 'buyer', 'processor'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParsed = BatchUuidParamSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid batch id',
          details: (idParsed.error as ZodError).issues,
        });
        return;
      }

      const bodyParsed = QRSMEClaimRequestSchema.safeParse(req.body ?? {});
      if (!bodyParsed.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: (bodyParsed.error as ZodError).issues,
        });
        return;
      }

      const smeOwnerId = (req as Request & { user?: { id: string } }).user?.id;
      if (!smeOwnerId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await claimSMEBatch(
        idParsed.data,
        bodyParsed.data,
        smeOwnerId,
        hashClientIp(req),
      );

      if (!result.ok || !result.data) {
        res.status(result.status ?? 422).json({
          success: false,
          error: result.error ?? 'SME claim failed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        product_saved: result.data.product_saved,
        recommendations: result.data.recommendations,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
