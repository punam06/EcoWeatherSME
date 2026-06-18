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
import nodemailer from 'nodemailer';
import { authenticateJWT, getRequestUserId } from '../../middleware/authenticateJWT';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { listNotificationsForUser } from '../../lib/services/notification.service';
import { subscribeUserNotifications } from '../../lib/services/notificationStream.service';
import { resolveUserForToken } from '../../middleware/authenticateJWT';

const router = Router();

/** Extracts the authenticated user's UUID from the JWT middleware result. */
function getUserId(req: Request): string | null {
  return getRequestUserId(req) ?? null;
}

// ── GET /api/notifications/stream (SSE) ───────────────────────────────────────

router.get(
  '/stream',
  async (req: Request, res: Response): Promise<void> => {
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (queryToken && !(req as any).user) {
      const user = await resolveUserForToken(queryToken);
      if (user) (req as any).user = user;
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader && !queryToken) {
      res.status(401).json({ success: false, error: 'Missing authorization' });
      return;
    }

    if (!(req as any).user) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'User ID not found in token' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ type: 'connected', userId, at: new Date().toISOString() });

    const unsubscribe = subscribeUserNotifications(userId, (notification) => {
      send({ type: 'notification', notification });
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
);

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

      if (!isSupabaseConfigured() && process.env.NODE_ENV !== 'production') {
        const { getLocalNotifications } = require('../../lib/services/notification.service');
        const notifications = getLocalNotifications(userId);
        const unreadCount = notifications.filter((n: any) => !n.is_read).length;
        res.json({ success: true, data: { notifications, unreadCount } });
        return;
      }

      const notifications = await listNotificationsForUser(userId, 50);
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
        const { markAllLocalNotificationsAsRead } = require('../../lib/services/notification.service');
        markAllLocalNotificationsAsRead(userId);
        res.json({ success: true, data: { message: 'All notifications marked as read' } });
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
        const { markLocalNotificationAsRead } = require('../../lib/services/notification.service');
        markLocalNotificationAsRead(id);
        res.json({ success: true, data: { id, is_read: true } });
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── POST /api/notifications/webhook-email ─────────────────────────────────────
router.post(
  '/webhook-email',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { record } = req.body;
      if (!record) {
        res.status(400).json({ success: false, error: 'Missing notification record' });
        return;
      }

      const { user_id, role, title, body, type } = record;

      if (!isSupabaseConfigured()) {
        res.status(503).json({ success: false, error: 'Supabase is not configured' });
        return;
      }

      const supabase = getSupabaseClient();
      let recipientEmails: string[] = [];

      // 1. Resolve email addresses from the public users table
      if (user_id) {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('id', user_id)
          .maybeSingle();
        if (!error && data?.email) {
          recipientEmails.push(data.email);
        }
      } else if (role) {
        // Map user roles for legacy and compatibility matching
        let rolesToQuery = [role];
        if (role === 'admin') {
          rolesToQuery = ['admin', 'inspector'];
        } else if (role === 'buyer') {
          rolesToQuery = ['buyer', 'consumer', 'sme_owner'];
        } else if (role === 'sme owner' || role === 'sme_owner') {
          rolesToQuery = ['sme_owner', 'buyer', 'producer', 'processor'];
        }

        const { data, error } = await supabase
          .from('users')
          .select('email')
          .in('role', rolesToQuery);
        
        if (!error && data) {
          recipientEmails = data.map((u: any) => u.email).filter(Boolean);
        }
      }

      if (recipientEmails.length === 0) {
        res.json({ success: true, message: 'No recipient emails found' });
        return;
      }

      // 2. Setup Transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // 3. Select Color Theme and Header Title
      let accentColor = '#10B981'; // Green
      const titleHeader = escapeHtml(title || 'ClimaLogix AI Notification');
      if (type === 'verification_request' || type === 'temp_alert') {
        accentColor = '#EF4444'; // Red
      } else if (type === 'order_update') {
        accentColor = '#3B82F6'; // Blue
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; background: #0B0F19; color: #F1F5F9; padding: 40px 10px; margin: 0; min-height: 100%;">
          <div style="max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid ${accentColor}; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #F9FAFB; font-size: 24px; font-weight: bold; margin: 0;">ClimaLogix AI</h1>
              <p style="color: #9CA3AF; font-size: 13px; margin: 4px 0 0 0;">ClimateShield Notification Service</p>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.02); border-left: 4px solid ${accentColor}; padding: 20px; border-radius: 8px; margin-bottom: 28px;">
              <h3 style="color: ${accentColor}; margin: 0 0 10px 0; font-size: 18px;">${titleHeader}</h3>
              <p style="color: #E5E7EB; font-size: 15px; line-height: 1.6; margin: 0;">${escapeHtml(body || '')}</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://backsme.onrender.com" style="background-color: ${accentColor}; color: #0B0F17; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block;">
                Go to ClimaLogix Dashboard
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #1F2937; margin: 28px 0;" />
            <div style="text-align: center; font-size: 11px; color: #4B5563;">
              <p style="margin: 0;">This email is protected by ClimaLogix AI Cryptographic Proof & ESG Shield.</p>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"ClimaLogix AI" <${process.env.SMTP_USER}>`,
        to: recipientEmails.join(','),
        subject: `🔔 ClimaLogix: ${titleHeader}`,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Webhook] Sent notification email to: ${recipientEmails.join(', ')}`);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/notifications/request-verification ──────────────────────────────
router.post(
  '/request-verification',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { batchId, destinationZone } = req.body;
      if (!batchId) {
        res.status(400).json({ success: false, error: 'batchId is required' });
        return;
      }

      // Check for duplicate verification request
      const { getLocalNotifications } = require('../../lib/services/notification.service');
      const existing = getLocalNotifications(getUserId(req));
      const duplicate = existing.find((n: any) => n.type === 'verification_request' && n.batch_id === batchId);
      if (duplicate) {
        res.status(409).json({ success: false, error: 'Verification request already submitted for this batch' });
        return;
      }
      
      const title = 'New Verification Request';
      const body = `SME Owner has submitted Batch ${batchId} for Quality & Trust Verification.`;
      
      // 1. Add locally
      const { addLocalNotification } = require('../../lib/services/notification.service');
      addLocalNotification({
        user_id: getUserId(req) || 'system',
        type: 'verification_request',
        title,
        body,
        batch_id: batchId,
        destination_zone: destinationZone || 'Old Dhaka'
      });
      
      // 2. Add to Supabase for all inspectors/admins
      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseClient();
          // Find all inspectors/admins
          const { data: users } = await supabase.from('users').select('id').in('role', ['admin', 'inspector']);
          if (users && users.length > 0) {
            const inserts = users.map((u: any) => ({
              user_id: u.id,
              type: 'verification_request',
              title,
              body,
              is_read: false
            }));
            await supabase.from('notifications').insert(inserts);
          }
        } catch (err) {
          console.warn('Failed to insert verification request to Supabase:', err);
        }
      }
      
      res.status(201).json({ success: true, message: 'Verification request sent successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
