import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getBatchesList, addBatch, updateBatchInStore, getBatchFromStore, deleteBatchFromStore } from '../../lib/services/batchStore.service';

const router = Router();

// GET /api/batches
router.get('/', async (req: Request, res: Response) => {
  try {
    const processorId = req.query.processor_id as string;
    
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      product_name, 
      product_type, 
      weight_kg, 
      packaging_type, 
      destination_zone, 
      processor_id,
      batch_number
    } = req.body;

    const displayBatchId = batch_number || `BCH-${Date.now().toString().slice(-6)}`;
    const weightNum = parseFloat(weight_kg ?? '100') || 100;
    
    const batchData = {
      batch_number: displayBatchId,
      product_name: product_name || 'Unnamed Organic Product',
      product_type: product_type || 'Bio-Slurry',
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
            feedstock_type: batchData.product_type,
            trust_score: batchData.trust_score,
            processor_id: processor_id || undefined,
            weight_kg: batchData.weight_kg,
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
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
router.post('/certify', async (req: Request, res: Response) => {
  try {
    const { batchId, trustScore } = req.body;
    const finalTrustScore = typeof trustScore === 'number' ? trustScore : parseInt(trustScore ?? '80', 10) || 80;
    
    // Generate actual batch ID if none provided
    const displayBatchId = batchId || `BCH-${Date.now().toString().slice(-6)}`;
    
    // Create the public verification URL
    const verificationUrl = `https://ecosortha.build/verify/${displayBatchId}`;
    
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
router.post('/:id/readings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pH, EC, temperature, em1_ratio, fermentation_days } = req.body;
    
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
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

export default router;