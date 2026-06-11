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
  | 'budget_alert'
  | 'verification_request';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  batch_id?: string;
  destination_zone?: string;
}

const localNotifications: NotificationRow[] = [
  {
    id: "notif-1",
    user_id: "demo-user-id",
    type: "verification_request",
    title: "New Verification Request",
    body: "SME Owner has submitted Batch BCH-3522026 for Quality & Trust Verification.",
    is_read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    batch_id: "BCH-3522026",
    destination_zone: "Old Dhaka"
  }
];

export function getLocalNotifications(): NotificationRow[] {
  return localNotifications;
}

export function addLocalNotification(notif: Omit<NotificationRow, 'id' | 'created_at' | 'is_read'> & { id?: string }): NotificationRow {
  const newNotif: NotificationRow = {
    ...notif,
    id: notif.id || `notif-${Date.now()}`,
    created_at: new Date().toISOString(),
    is_read: false
  };
  localNotifications.unshift(newNotif);
  return newNotif;
}

export function markLocalNotificationAsRead(id: string): boolean {
  const item = localNotifications.find(n => n.id === id);
  if (item) {
    item.is_read = true;
    return true;
  }
  return false;
}

export function markAllLocalNotificationsAsRead(): void {
  localNotifications.forEach(n => n.is_read = true);
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
  // Try adding locally first
  addLocalNotification({
    user_id: userId,
    type,
    title,
    body
  });

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
