/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — NOTIFICATION SERVICE
 * File: src/lib/services/notification.service.ts
 *
 * Helper to create and persist notifications for authenticated
 * users. Called from Trust Score, DVS, and Order pipelines.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

/** Allowed notification type values — must mirror the DB CHECK constraint. */
export type NotificationType =
  | 'trust_pass'
  | 'trust_fail'
  | 'temp_alert'
  | 'dispatch_approved'
  | 'dispatch_rejected'
  | 'order_update'
  | 'budget_alert';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Creates a notification row in Supabase.
 * Best-effort: logs a warning but never throws, so calling pipelines
 * are never interrupted by notification failures.
 *
 * @param userId  - UUID of the target user
 * @param type    - One of NotificationType
 * @param title   - Short headline shown in the drawer header
 * @param body    - Full description text
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return; // Gracefully skip when DB is not configured
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      is_read: false,
    });

    if (error) {
      console.error('[NotificationService] Insert failed:', error.message);
    }
  } catch (err) {
    console.error('[NotificationService] Unexpected error:', err instanceof Error ? err.message : String(err));
  }
}
