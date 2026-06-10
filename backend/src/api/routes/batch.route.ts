import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getBatchesList, addBatch, updateBatchInStore, getBatchFromStore, deleteBatchFromStore } from '../../lib/services/batchStore.service';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { requireRoles } from '../../middleware/roleGuard';

const router = Router();

const CreateBatchSchema = z.object({
  product_name: z.string().min(1).max(255).optional(),
  product_type: z.string().min(1).max(255).optional(),
  // feedstock_type is an alias sent by ProducerDashboard — accepted here to
  // avoid silent data loss from Zod's .strict() unknown-key rejection.
  feedstock_type: z.string().min(1).max(255).optional(),
  weight_kg: z.coerce.number().min(0).max(1000000).optional(),
  packaging_type: z.string().min(1).max(100).optional(),
  destination_zone: z.string().min(1).max(100).optional(),
  processor_id: z.string().min(1).max(100).optional(),
  batch_number: z.string().min(1).max(100).optional(),
}).strict();

const UpdateBatchSchema = z.object({
  product_name: z.string().min(1).max(255).optional(),
  product_type: z.string().min(1).max(255).optional(),
  weight_kg: z.coerce.number().min(0).max(1000000).optional(),
  packaging_type: z.string().min(1).max(100).optional(),
  destination_zone: z.string().min(1).max(100).optional(),
  processor_id: z.string().min(1).max(100).optional(),
  batch_number: z.string().min(1).max(100).optional(),
  status: z.enum(['pending', 'certified', 'dispatched', 'delivered']).optional(),
  trust_score: z.number().min(0).max(100).optional(),
  qr_code_url: z.string().optional(),
  certificate_url: z.string().optional(),
}).strict();

const CertifyBatchSchema = z.object({
  batchId: z.string().min(1).max(100).optional(),
  trustScore: z.coerce.number().min(0).max(100).optional(),
}).strict();

const RecordReadingsSchema = z.object({
  pH: z.coerce.number().min(0).max(14).optional(),
  EC: z.coerce.number().min(0).max(20).optional(),
  temperature: z.coerce.number().min(-50).max(100).optional(),
  em1_ratio: z.string().min(1).max(50).optional(),
  fermentation_days: z.coerce.number().int().min(0).max(365).optional(),
}).strict();

// GET /api/batches
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const rawProcessorId = req.query.processor_id;
    const processorId = typeof rawProcessorId === 'string' ? rawProcessorId.trim() : undefined;
    if (processorId && (processorId.length === 0 || processorId.length > 100)) {
      res.status(400).json({ success: false, error: 'Invalid processor_id format' });
      return;
    }
    
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      let query = supabase.from('batches').select('*').order('created_at', { ascending: false });
      if (processorId) {
        query = query.eq('processor_id', processorId);
      }
      const { data, error } = await query;
      if (!error && data) {
        res.json({ success: true, data });
        return;
      }
      console.warn('Supabase fetch failed, falling back to batchStore:', error);
    }
    
    // In-memory fallback
    let list = getBatchesList();
    if (processorId) {
      list = list.filter(b => b.processor_id === processorId);
    }
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Fetch batches error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve batches' });
  }
});

// GET /api/batches/:id
router.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('batches').select('*').eq('id', id).single();
      if (!error && data) {
        res.json({ success: true, data });
        return;
      }
    }
    
    const batch = getBatchFromStore(id);
    if (batch) {
      res.json({ success: true, data: batch });
    } else {
      res.status(404).json({ success: false, error: 'Batch not found' });
    }
  } catch (error) {
    console.error('Fetch batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve batch' });
  }
});

// POST /api/batches
router.post('/', authenticateJWT, requireRoles('sme', 'sme_owner', 'buyer'), async (req: Request, res: Response) => {
  try {
    const parsed = CreateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const { 
      product_name, 
      product_type, 
      feedstock_type,
      weight_kg, 
      packaging_type, 
      destination_zone, 
      processor_id,
      batch_number
    } = parsed.data;
    // Use feedstock_type as fallback alias for product_type (sent by ProducerDashboard)
    const resolvedProductType = product_type || feedstock_type;

    const displayBatchId = batch_number || `BCH-${Date.now().toString().slice(-6)}`;
    const weightNum = weight_kg ?? 100;
    
    const batchData = {
      batch_number: displayBatchId,
      product_name: product_name || 'Unnamed Organic Product',
      product_type: resolvedProductType || 'Bio-Slurry',
      weight_kg: weightNum,
      packaging_type: packaging_type || 'Standard',
      destination_zone: destination_zone || 'Old Dhaka',
      status: 'pending' as const,
      trust_score: 0,
      processor_id: processor_id || 'demo-processor-id'
    };

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('batches')
          .insert({
            batch_number: batchData.batch_number,
            product_name: batchData.product_name,
            feedstock_type: resolvedProductType || batchData.product_type,
            trust_score: batchData.trust_score,
            processor_id: processor_id || undefined,
            weight_kg: batchData.weight_kg,
            packaging_type: batchData.packaging_type,
            destination_zone: batchData.destination_zone,
            status: 'pending'
          })
          .select('*')
          .single();
        
        if (!error && data) {
          // Sync to local memory as well
          addBatch({ ...batchData, id: data.id });
          res.status(201).json({ success: true, data });
          return;
        }
        console.warn('Supabase batch creation failed, using fallback:', error);
      } catch (err) {
        console.warn('Supabase batch creation threw, using fallback:', err);
      }
    }

    // In-memory fallback
    const newBatch = addBatch(batchData);
    res.status(201).json({ success: true, data: newBatch });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to create new batch registry' });
  }
});

// PUT /api/batches/:id
router.put('/:id', authenticateJWT, requireRoles('processor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    const parsed = UpdateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const updates = parsed.data;
    
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('batches').update(updates).eq('id', id).select('*').single();
      if (!error && data) {
        updateBatchInStore(id, data);
        res.json({ success: true, data });
        return;
      }
    }
    
    const updated = updateBatchInStore(id, updates);
    if (updated) {
      res.json({ success: true, data: updated });
    } else {
      res.status(404).json({ success: false, error: 'Batch not found to update' });
    }
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to update batch' });
  }
});

// POST /api/batches/certify
router.post('/certify', authenticateJWT, requireRoles('processor'), async (req: Request, res: Response) => {
  try {
    const parsed = CertifyBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const { batchId, trustScore } = parsed.data;
    const finalTrustScore = trustScore ?? 80;
    
    // Generate actual batch ID if none provided
    const displayBatchId = batchId || `BCH-${Date.now().toString().slice(-6)}`;
    
    // Create the public verification URL — uses FRONTEND_URL env (set in .env to
    // https://ecoweathersme.onrender.com) so QRs always resolve to the live SPA,
    // which deep-links to the Tracking view via ?batch=<id>.
    const frontendBase = (process.env.FRONTEND_URL || 'https://ecoweathersme.onrender.com')
      .replace(/\/+$/, ''); // strip trailing slash
    const verificationUrl = `${frontendBase}/?batch=${displayBatchId}`;
    
    // Generate QR code data URL (Base64 image) securely on the backend
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // Update status in store or Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('batches')
          .update({ 
            qr_code_url: qrCodeDataUrl, 
            certificate_url: verificationUrl,
            status: 'certified',
            trust_score: finalTrustScore
          })
          .eq('batch_number', displayBatchId)
          .select('*')
          .single();
        
        if (!error && data) {
          updateBatchInStore(displayBatchId, { 
            status: 'certified', 
            trust_score: finalTrustScore,
            qr_code_url: qrCodeDataUrl,
            certificate_url: verificationUrl
          });
        }
      } catch (err) {
        console.warn('Supabase certify update failed, fallback to store update:', err);
      }
    }

    // Always keep store in sync
    updateBatchInStore(displayBatchId, {
      status: 'certified',
      trust_score: finalTrustScore,
      qr_code_url: qrCodeDataUrl,
      certificate_url: verificationUrl
    });
    
    res.json({
      success: true,
      data: {
        batchId: displayBatchId,
        verificationUrl,
        qrCodeDataUrl,
        certifiedAt: new Date().toISOString(),
        trustScore: finalTrustScore
      }
    });
  } catch (error) {
    console.error('QR Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate cryptographic QR code' });
  }
});

// Readings stubs so they are handled cleanly inside batchRouter
router.post('/:id/readings', authenticateJWT, requireRoles('processor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    const parsed = RecordReadingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      return;
    }
    const { pH, EC, temperature, em1_ratio, fermentation_days } = parsed.data;
    
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('iot_readings').insert({
        batch_id: id,
        ph: pH,
        ec: EC,
        temperature,
        em1_ratio,
        fermentation_days
      }).select('*').single();
      if (!error && data) {
        res.status(201).json({ success: true, data });
        return;
      }
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: `rdg-${Date.now().toString().slice(-6)}`,
        batch_id: id,
        ph: pH || 4.1,
        ec: EC || 3.4,
        temperature: temperature || 28,
        em1_ratio: em1_ratio || '1:1:20',
        fermentation_days: fermentation_days || 9,
        recorded_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to record readings' });
  }
});

router.get('/:id/readings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('iot_readings').select('*').eq('batch_id', id);
      if (!error && data) {
        res.json({ success: true, data });
        return;
      }
    }
    
    res.json({
      success: true,
      data: [
        {
          id: `rdg-seed`,
          batch_id: id,
          ph: 4.1,
          ec: 3.4,
          temperature: 28,
          em1_ratio: '1:1:20',
          fermentation_days: 9,
          recorded_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve readings' });
  }
});

// DELETE /api/batches/:id
router.delete('/:id', authenticateJWT, requireRoles('processor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }
    
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('batches').delete().eq('id', id);
        if (!error) {
          deleteBatchFromStore(id);
          res.json({ success: true, message: 'Batch deleted successfully' });
          return;
        }
        console.warn('Supabase delete failed, using fallback:', error);
      } catch (err) {
        console.warn('Supabase delete threw, using fallback:', err);
      }
    }
    
    const deleted = deleteBatchFromStore(id);
    if (deleted) {
      res.json({ success: true, message: 'Batch deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Batch not found' });
    }
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete batch' });
  }
});

// GET /api/batches/:id/scans
// Returns the QR scan history for a batch — the source-to-consumer journey
// proof. Auth required (any authenticated user can view scan logs for
// transparency in the supply chain).
router.get('/:id/scans', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      res.status(400).json({ success: false, error: 'Valid batch ID is required' });
      return;
    }

    if (!isSupabaseConfigured()) {
      res.json({ success: true, data: { scans: [], total: 0 } });
      return;
    }

    const supabase = getSupabaseClient();

    // Try both batch_number and uuid-style id to be tolerant of input formats
    const { data: scans, error } = await supabase
      .from('qr_scans')
      .select('id, user_agent, ip_hash, scanned_at')
      .or(`batch_id.eq.${id},batch_id.eq.${encodeURIComponent(id)}`)
      .order('scanned_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet on first deploy — degrade gracefully
      console.warn('qr_scans query failed (table may not exist yet):', error.message);
      res.json({ success: true, data: { scans: [], total: 0 } });
      return;
    }

    res.json({
      success: true,
      data: {
        scans: (scans || []).map((s: any) => ({
          id: s.id,
          userAgent: s.user_agent,
          ipHash: s.ip_hash,
          scannedAt: s.scanned_at,
        })),
        total: scans?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('Get batch scans error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scan history' });
  }
});

export default router;
