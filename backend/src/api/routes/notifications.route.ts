/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — NOTIFICATIONS ROUTE
 * File: src/api/routes/notifications.route.ts
 *
 *   GET    /api/notifications         — fetch all for user, with unread count
 *   PATCH  /api/notifications/:id/read — mark single as read
 *   PATCH  /api/notifications/read-all — mark all as read
 *
 * All endpoints require authenticateJWT.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

const router = Router();

/** Extracts the authenticated user's UUID from the JWT middleware result. */
function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id ?? user?.user_metadata?.id ?? null;
}

// ── GET /api/notifications ─────────────────────────────────────────────────────

/**
 * Fetch all notifications for the authenticated user, ordered by
 * created_at DESC. Response includes an `unreadCount` field.
 */
router.get(
  '/',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'User ID not found in token' });
        return;
      }

      if (!isSupabaseConfigured()) {
        res.json({ success: true, data: { notifications: [], unreadCount: 0 } });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      const notifications = data ?? [];
      const unreadCount = notifications.filter((n: any) => !n.is_read).length;

      res.json({ success: true, data: { notifications, unreadCount } });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/notifications/read-all ─────────────────────────────────────────

/**
 * Mark all notifications as read for the authenticated user.
 * NOTE: This route MUST be registered before /:id/read to avoid
 * Express routing "read-all" as an id parameter.
 */
router.patch(
  '/read-all',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'User ID not found in token' });
        return;
      }

      if (!isSupabaseConfigured()) {
        res.json({ success: true, data: { updated: 0 } });
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      res.json({ success: true, data: { message: 'All notifications marked as read' } });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────

/**
 * Mark a single notification as read. Only the owning user can
 * mark their own notifications — we filter by user_id in the query.
 */
router.patch(
  '/:id/read',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'User ID not found in token' });
        return;
      }

      const { id } = req.params;
      if (!id || id.length > 100) {
        res.status(400).json({ success: false, error: 'Invalid notification ID' });
        return;
      }

      if (!isSupabaseConfigured()) {
        res.json({ success: true, data: { updated: 0 } });
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId) // RLS safety: users can only update their own
        .select('*')
        .maybeSingle();

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      if (!data) {
        res.status(404).json({ success: false, error: 'Notification not found or already read' });
        return;
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
