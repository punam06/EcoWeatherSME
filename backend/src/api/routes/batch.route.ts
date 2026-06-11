import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { authenticateJWT, optionalJWT, getRequestUserId, getRequestUserRole } from '../../middleware/authenticateJWT';
import { requireRoles } from '../../middleware/roleGuard';
import {
  createBatchWithEvaluation,
  getBatchDetail,
  guardedUpdateBatch,
  listBatches,
  revokeBatch,
  shipBatch,
} from '../../lib/services/batchVerification.service';

const router = Router();

const CreateBatchSchema = z.object({
  product_name: z.string().min(1).max(255).optional(),
  product_type: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  feedstock_type: z.string().min(1).max(255).optional(),
  ingredients: z.any().optional(),
  certification_claims: z.any().optional(),
  weight_kg: z.coerce.number().min(0).max(1000000).optional(),
  packaging_type: z.string().min(1).max(100).optional(),
  destination_zone: z.string().min(1).max(100).optional(),
  processor_id: z.string().min(1).max(100).optional(),
  manufacturer_id: z.string().min(1).max(100).optional(),
  batch_number: z.string().min(1).max(100).optional(),
  pH: z.coerce.number().min(0).max(14).optional(),
  ph: z.coerce.number().min(0).max(14).optional(),
  ec: z.coerce.number().min(0).max(20).optional(),
  EC: z.coerce.number().min(0).max(20).optional(),
  temperature: z.coerce.number().min(-50).max(100).optional(),
  temp: z.coerce.number().min(-50).max(100).optional(),
  temperatureCelsius: z.coerce.number().min(-50).max(100).optional(),
  temperature_celsius: z.coerce.number().min(-50).max(100).optional(),
  em1Ratio: z.union([z.coerce.number(), z.string()]).optional(),
  em1_ratio: z.union([z.coerce.number(), z.string()]).optional(),
  ratio: z.union([z.coerce.number(), z.string()]).optional(),
  fermentationDays: z.coerce.number().int().min(0).max(3650).optional(),
  fermentation_days: z.coerce.number().int().min(0).max(3650).optional(),
  bstiCredential: z.string().max(100).optional(),
  bsti_credential: z.string().max(100).optional(),
  inspector_certification_id: z.string().max(100).optional(),
}).passthrough();

const UpdateBatchSchema = z.object({
  product_name: z.string().min(1).max(255).optional(),
  product_type: z.string().min(1).max(255).optional(),
  feedstock_type: z.string().min(1).max(255).optional(),
  ingredients: z.any().optional(),
  certification_claims: z.any().optional(),
  weight_kg: z.coerce.number().min(0).max(1000000).optional(),
  packaging_type: z.string().min(1).max(100).optional(),
  destination_zone: z.string().min(1).max(100).optional(),
}).strict();

const RevokeSchema = z.object({
  reason: z.string().min(3).max(2000),
}).strict();

const RecordReadingsSchema = z.object({
  pH: z.coerce.number().min(0).max(14).optional(),
  EC: z.coerce.number().min(0).max(20).optional(),
  temperature: z.coerce.number().min(-50).max(100).optional(),
  em1_ratio: z.string().min(1).max(50).optional(),
  fermentation_days: z.coerce.number().int().min(0).max(365).optional(),
}).strict();

function accessContext(req: Request) {
  return { userId: getRequestUserId(req), role: getRequestUserRole(req) };
}

router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listBatches(req.query, accessContext(req));
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    const ctx = accessContext(req);
    const batch = await getBatchDetail(id, ctx.userId ? ctx : undefined);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found' });
      return;
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  authenticateJWT,
  requireRoles('processor', 'producer', 'sme', 'sme_owner', 'buyer', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
        return;
      }
      const userId = getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const manufacturerId = parsed.data.manufacturer_id || parsed.data.processor_id || userId;
      const result = await createBatchWithEvaluation(parsed.data, manufacturerId);
      res.status(201).json({
        success: true,
        data: result.batch,
        evaluation: result.evaluation,
        verificationRequest: result.verificationRequest,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/:id',
  authenticateJWT,
  requireRoles('processor', 'producer', 'sme', 'sme_owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UpdateBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
        return;
      }
      const result = await guardedUpdateBatch(req.params.id, parsed.data, accessContext(req));
      if (result.error) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result.batch });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/ship',
  authenticateJWT,
  requireRoles('processor', 'producer', 'sme', 'sme_owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const result = await shipBatch(req.params.id, { userId, role: getRequestUserRole(req) });
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
  '/:id/revoke',
  authenticateJWT,
  requireRoles('inspector', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = RevokeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
        return;
      }
      const userId = getRequestUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      const result = await revokeBatch(req.params.id, { userId, role: getRequestUserRole(req) }, parsed.data.reason);
      if (result.error) {
        res.status(result.status).json({ success: false, error: result.error });
        return;
      }
      res.json({ success: true, data: result.batch });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/:id/readings', authenticateJWT, requireRoles('processor', 'producer', 'admin'), async (req: Request, res: Response) => {
  try {
    const parsed = RecordReadingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('iot_readings').insert({
        batch_id: req.params.id,
        ph: parsed.data.pH,
        ec: parsed.data.EC,
        temperature: parsed.data.temperature,
        em1_ratio: parsed.data.em1_ratio,
        fermentation_days: parsed.data.fermentation_days,
      }).select('*').single();
      if (!error && data) {
        res.status(201).json({ success: true, data });
        return;
      }
    }
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ success: false, error: 'IoT readings require Supabase in production' });
      return;
    }
    res.status(201).json({ success: true, data: { id: `rdg-${Date.now()}`, batch_id: req.params.id, ...parsed.data } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record readings' });
  }
});

router.get('/:id/readings', async (req: Request, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabaseClient().from('iot_readings').select('*').eq('batch_id', req.params.id);
      if (!error && data) {
        res.json({ success: true, data });
        return;
      }
    }
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve readings' });
  }
});

router.get('/:id/scans', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.json({ success: true, data: { scans: [], total: 0 } });
      return;
    }
    const { data, error } = await getSupabaseClient()
      .from('qr_scans')
      .select('id, user_agent, ip_hash, scanned_at, status_returned')
      .eq('batch_id', req.params.id)
      .order('scanned_at', { ascending: false })
      .limit(50);
    if (error) {
      res.json({ success: true, data: { scans: [], total: 0 } });
      return;
    }
    res.json({ success: true, data: { scans: data || [], total: data?.length || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch scan history' });
  }
});

export default router;
