/**
 * ECOSORTHA AI — ORDER LIFECYCLE AUDIT LOGGING
 * File: src/lib/services/orderLifecycleLog.service.ts
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

export type OrderLifecycleEvent = 'created' | 'confirmed' | 'dispatched' | 'received';

export interface OrderLifecycleLogInput {
  orderId: string;
  event: OrderLifecycleEvent;
  sessionId?: string;
  buyerId?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persists structured lifecycle transition to order_lifecycle_logs (non-blocking).
 */
export function logOrderLifecycleEvent(input: OrderLifecycleLogInput): void {
  if (!isSupabaseConfigured()) {
    console.info('[OrderLifecycleLog]', input.event, input.orderId, input.metadata ?? {});
    return;
  }

  const supabase = getSupabaseClient();
  void (async () => {
    try {
      const { error } = await supabase.from('order_lifecycle_logs').insert({
        order_id: input.orderId,
        event: input.event,
        session_id: input.sessionId ?? null,
        buyer_id: input.buyerId ?? null,
        from_status: input.fromStatus ?? null,
        to_status: input.toStatus ?? null,
        metadata: input.metadata ?? {},
      });
      if (error) {
        console.warn('[OrderLifecycleLog] insert failed:', error.message);
      }
    } catch (err) {
      console.warn('[OrderLifecycleLog] unexpected error:', err);
    }
  })();
}
