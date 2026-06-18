import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../lib/supabase';
import { authenticateJWT } from '../../middleware/authenticateJWT';

const router = Router();

router.get('/', authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('products').select('*');
    
    if (error) {
      console.error('[Products] Error fetching products:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch products' });
      return;
    }
    
    // Add default icon, badge, category mappings if needed for UI, or assume they are in DB
    const processed = data?.map(p => ({
      ...p,
      icon: p.icon || '📦',
      dvs: p.dvs || 85
    })) || [];

    res.json({ success: true, data: processed });
  } catch (err) {
    console.error('[Products] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
