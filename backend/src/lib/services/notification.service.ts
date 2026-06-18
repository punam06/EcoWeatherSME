/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — NOTIFICATION SERVICE
 * Unified notification persistence + realtime fan-out.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { allowMemoryFallback } from '../runtimeConfig';
import { publishNotification } from './notificationStream.service';

export type NotificationType =
  | 'trust_pass'
  | 'trust_fail'
  | 'temp_alert'
  | 'dispatch_approved'
  | 'dispatch_rejected'
  | 'order_update'
  | 'budget_alert'
  | 'verification_request'
  | 'evaluation_failed'
  | 'evaluation_passed'
  | 'product_shipped'
  | 'product_received'
  | 'batch_rejected'
  | 'qr_ready';

export interface NotificationRow {
  id: string;
  user_id: string | null;
  type: NotificationType | string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  batch_id?: string;
  destination_zone?: string;
}

const localNotifications: NotificationRow[] = [];
const LOCAL_NOTIFICATIONS_MAX = 500;

export function getLocalNotifications(userId?: string): NotificationRow[] {
  if (!userId) return [...localNotifications];
  return localNotifications.filter((n) => n.user_id === userId);
}

export function addLocalNotification(
  notif: Omit<NotificationRow, 'id' | 'created_at' | 'is_read'> & { id?: string },
): NotificationRow {
  const newNotif: NotificationRow = {
    ...notif,
    id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    is_read: false,
  };
  localNotifications.unshift(newNotif);
  if (localNotifications.length > LOCAL_NOTIFICATIONS_MAX) {
    localNotifications.length = LOCAL_NOTIFICATIONS_MAX;
  }
  if (newNotif.user_id) publishNotification(newNotif.user_id, newNotif);
  return newNotif;
}

export function markLocalNotificationAsRead(id: string): boolean {
  const item = localNotifications.find((n) => n.id === id);
  if (item) {
    item.is_read = true;
    return true;
  }
  return false;
}

export function markAllLocalNotificationsAsRead(userId?: string): void {
  localNotifications.forEach((n) => {
    if (!userId || n.user_id === userId) n.is_read = true;
  });
}

export async function createNotification(
  userId: string | null | undefined,
  type: NotificationType | string,
  title: string,
  body: string,
  extras?: { batchId?: string; destinationZone?: string; id?: string },
): Promise<NotificationRow | null> {
  if (!userId) return null;

  const row: NotificationRow = {
    id: extras?.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    type,
    title,
    body,
    is_read: false,
    created_at: new Date().toISOString(),
    batch_id: extras?.batchId,
    destination_zone: extras?.destinationZone,
  };

  if (allowMemoryFallback() && !isSupabaseConfigured()) {
    localNotifications.unshift(row);
    if (localNotifications.length > LOCAL_NOTIFICATIONS_MAX) {
      localNotifications.length = LOCAL_NOTIFICATIONS_MAX;
    }
    publishNotification(userId, row);
    return row;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const insertRow: Record<string, unknown> = {
        user_id: userId,
        type,
        title,
        body,
        is_read: false,
      };
      if (extras?.batchId) insertRow.batch_id = extras.batchId;
      if (extras?.destinationZone) insertRow.destination_zone = extras.destinationZone;

      const { data, error } = await supabase
        .from('notifications')
        .insert(insertRow)
        .select('*')
        .single();

      if (!error && data) {
        const persisted = data as NotificationRow;
        publishNotification(userId, persisted);
        return persisted;
      }
      console.error('[NotificationService] Insert failed:', error?.message);
    } catch (err) {
      console.error('[NotificationService] Unexpected error:', err instanceof Error ? err.message : String(err));
    }
  }

  if (allowMemoryFallback()) {
    localNotifications.unshift(row);
    if (localNotifications.length > LOCAL_NOTIFICATIONS_MAX) {
      localNotifications.length = LOCAL_NOTIFICATIONS_MAX;
    }
    publishNotification(userId, row);
    return row;
  }

  return null;
}

export async function listNotificationsForUser(userId: string, limit = 50): Promise<NotificationRow[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && data) return data as NotificationRow[];
  }
  return getLocalNotifications(userId).slice(0, limit);
}
