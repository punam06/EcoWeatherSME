import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateJWT, getRequestUserId, getRequestUserRole } from '../../middleware/authenticateJWT';
import { requireRoles } from '../../middleware/roleGuard';
import {
  listVerificationRequests,
  markReceived,
  REJECTION_REASONS,
  submitVerdict,
} from '../../lib/services/batchVerification.service';

const router = Router();

const VerdictSchema = z.object({
  verdict: z.enum(['approved', 'rejected']),
  checklist: z.object({
    physical_condition: z.boolean().optional(),
    packaging_integrity: z.boolean().optional(),
    labeling_compliance: z.boolean().optional(),
    ingredient_match: z.boolean().optional(),
    certification_authenticity: z.boolean().optional(),
  }).partial().optional(),
  reasons: z.array(z.enum(REJECTION_REASONS)).optional(),
  verdict_reasons: z.array(z.enum(REJECTION_REASONS)).optional(),
  notes: z.string().max(2000).optional(),
  inspector_certification_id: z.string().max(100).optional(),
}).strict();

router.get(
  '/',
  authenticateJWT,
  requireRoles('inspector', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inspectorId = getRequestUserId(req);
      const role = getRequestUserRole(req);
      const rows = await listVerificationRequests(req.query, role === 'admin' ? undefined : inspectorId);
      res.json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/received',
  authenticateJWT,
  requireRoles('inspector', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inspectorId = getRequestUserId(req);
      if (!inspectorId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const result = await markReceived(req.params.id, inspectorId, getRequestUserRole(req));
      if (result.error) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/verdict',
  authenticateJWT,
  requireRoles('inspector', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = VerdictSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
        return;
      }
      const inspectorId = getRequestUserId(req);
      if (!inspectorId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const result = await submitVerdict(req.params.id, parsed.data, inspectorId, getRequestUserRole(req));
      if (result.error) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
