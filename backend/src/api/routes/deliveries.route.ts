import { Router, Request, Response } from 'express';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { authenticateJWT } from '../../middleware/authenticateJWT';

const router = Router();

// Mock fallback for deliveries if the table doesn't exist
const MOCK_DELIVERIES = [
  { id: "SH-102", batchId: "BCH-1082", origin: "Savár Farm", dest: "Kamrangirchar", eta: "45 mins", temp: "29.4°C", status: "in-transit", optimized: false },
  { id: "SH-105", batchId: "BCH-2144", origin: "Gazipur Facility", dest: "Mirpur", eta: "1.2 hours", temp: "28.1°C", status: "in-transit", optimized: false }
];

router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      res.json({ success: true, data: MOCK_DELIVERIES, isMock: true });
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('deliveries').select('*');
    
    if (error) {
      console.warn('[Deliveries] Query error, returning mock data:', error.message);
      res.json({ success: true, data: MOCK_DELIVERIES, isMock: true });
      return;
    }

    if (!data || data.length === 0) {
      res.json({ success: true, data: MOCK_DELIVERIES, isMock: true });
      return;
    }
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Deliveries] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.put('/:id/acknowledge', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      res.json({ success: true, message: 'Mock acknowledged', isMock: true });
      return;
    }

    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'delivered', eta: 'completed' })
      .eq('id', id);

    if (error) {
      console.warn('[Deliveries] Acknowledge error:', error.message);
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Deliveries] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.put('/:id/optimize', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
      res.json({ success: true, message: 'Mock optimized', isMock: true });
      return;
    }

    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('deliveries')
      .update({ optimized: true, temp: "26.5°C", eta: "50 mins" })
      .eq('id', id);

    if (error) {
      console.warn('[Deliveries] Optimize error:', error.message);
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Deliveries] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
