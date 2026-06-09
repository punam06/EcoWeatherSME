import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../lib/supabase';
import { authenticateJWT } from '../../middleware/authenticateJWT';

const router = Router();

router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    // Assuming req.user is set by authenticateJWT
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Profile] Error fetching profile:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch profile' });
      return;
    }

    res.json({ success: true, data: data || { full_name: 'Demo User', badge_id: 'INS-8422-CLX', pref_zone: 'Mirpur', heatwave_alerts: true } });
  } catch (err) {
    console.error('[Profile] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.put('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { full_name, badge_id, pref_zone, heatwave_alerts } = req.body;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name,
        badge_id,
        pref_zone,
        heatwave_alerts,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[Profile] Error updating profile:', error);
      res.status(500).json({ success: false, error: 'Failed to update profile' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Profile] Server error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
