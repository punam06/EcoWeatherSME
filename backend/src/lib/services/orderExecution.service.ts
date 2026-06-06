/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — ORDER EXECUTION SERVICE
 * File: src/lib/services/orderExecution.service.ts
 *
 * Implements transaction execution: initiate, confirm, cancel,
 * and auto-recommendation using Supabase exact schema keys.
 * ═══════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { setPendingOrder, getSession, clearPendingOrder, PendingOrder } from './chatSession.service';
import { searchProducts, Product } from './productSearch.service';
import { logOrderLifecycleEvent } from './orderLifecycleLog.service';

export interface OrderAuditContext {
  sessionId?: string;
  buyerId?: string;
  note?: string;
}

let memoryOrderStore: Map<string, OrderRecord> | null = null;

/** Enables in-memory order store for integration tests. */
export function enableMemoryOrderStoreForTests(): void {
  memoryOrderStore = new Map();
}

export function resetMemoryOrderStoreForTests(): void {
  memoryOrderStore?.clear();
}

export function seedMemoryOrder(order: OrderRecord): void {
  if (!memoryOrderStore) {
    throw new Error('Memory order store is not enabled');
  }
  memoryOrderStore.set(order.id, order);
}

function useMemoryStore(): boolean {
  return memoryOrderStore !== null;
}

export function isMemoryOrderStoreEnabled(): boolean {
  return useMemoryStore();
}

export interface OrderResult {
  success: boolean;
  requiresAuth?: boolean;
  message: string;
  orderId?: string;
}

export interface OrderRecord {
  id: string;
  buyer_id: string;
  product_id: string | null;
  quantity: number;
  totalBdt: number;
  status: string;
  created_at: string;
}

export interface OrderStatusResult {
  success: boolean;
  message: string;
  order?: OrderRecord;
}

function mapOrderRow(row: Record<string, unknown>): OrderRecord {
  return {
    id: String(row.id),
    buyer_id: String(row.buyer_id),
    product_id: row.product_id != null ? String(row.product_id) : null,
    quantity: Number(row.quantity),
    totalBdt: Number(row.totalBdt ?? row.total_bdt ?? 0),
    status: String(row.status),
    created_at: String(row.created_at),
  };
}

/**
 * Initiates a pending order in session storage.
 */
export function initiateOrder(
  sessionId: string,
  product: Product,
  quantity: number,
  farmerId?: string
): PendingOrder {
  const pending: PendingOrder = {
    productId: product.id,
    productName: product.name,
    priceBdt: product.price_bdt,
    quantity,
    totalBdt: product.price_bdt * quantity,
    farmerId,
  };
  setPendingOrder(sessionId, pending);
  return pending;
}

/**
 * Confirms and submits the pending order to Supabase.
 */
export async function confirmOrder(sessionId: string, farmerId?: string): Promise<OrderResult> {
  const session = getSession(sessionId);
  if (!session || !session.pendingOrder) {
    return {
      success: false,
      message: 'No pending order found for this session.',
    };
  }

  const actualFarmerId = farmerId || session.farmerId;
  if (!actualFarmerId) {
    return {
      success: false,
      requiresAuth: true,
      message: 'Please log in to complete your purchase.',
    };
  }

  if (!useMemoryStore() && !isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Database connection is temporarily offline. Please try again later.',
    };
  }

  const { productId, quantity, totalBdt } = session.pendingOrder;

  try {
    if (useMemoryStore()) {
      const orderId = uuidv4();
      const createdAt = new Date().toISOString();
      const record: OrderRecord = {
        id: orderId,
        buyer_id: actualFarmerId,
        product_id: productId,
        quantity,
        totalBdt,
        status: 'pending',
        created_at: createdAt,
      };
      memoryOrderStore!.set(orderId, record);
      clearPendingOrder(sessionId);
      logOrderLifecycleEvent({
        orderId,
        event: 'created',
        sessionId,
        buyerId: actualFarmerId,
        fromStatus: null,
        toStatus: 'pending',
      });
      logOrderLifecycleEvent({
        orderId,
        event: 'confirmed',
        sessionId,
        buyerId: actualFarmerId,
        fromStatus: null,
        toStatus: 'pending',
        metadata: { productId, quantity, totalBdt },
      });
      return {
        success: true,
        message: 'Your order has been placed successfully!',
        orderId,
      };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('orders')
      .insert({
        buyer_id: actualFarmerId,
        product_id: productId,
        quantity,
        totalBdt,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[OrderExecution] Failed to insert order:', error.message);
      return {
        success: false,
        message: `Failed to confirm order: ${error.message}`,
      };
    }

    const orderId = String(data?.id);
    logOrderLifecycleEvent({
      orderId,
      event: 'created',
      sessionId,
      buyerId: actualFarmerId,
      fromStatus: null,
      toStatus: 'pending',
    });
    logOrderLifecycleEvent({
      orderId,
      event: 'confirmed',
      sessionId,
      buyerId: actualFarmerId,
      fromStatus: null,
      toStatus: 'pending',
      metadata: { productId, quantity, totalBdt },
    });

    // Clear pending order from session state
    clearPendingOrder(sessionId);

    return {
      success: true,
      message: 'Your order has been placed successfully!',
      orderId: data?.id,
    };
  } catch (err) {
    console.error('[OrderExecution] Unexpected error during confirmation:', err);
    return {
      success: false,
      message: 'An unexpected error occurred while placing your order.',
    };
  }
}

/**
 * Cancels the pending order in the session.
 */
export function cancelOrder(sessionId: string): void {
  clearPendingOrder(sessionId);
}

/**
 * Fetches a single order by id.
 */
export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  if (useMemoryStore()) {
    return memoryOrderStore!.get(orderId) ?? null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error || !data) {
      return null;
    }
    return mapOrderRow(data as Record<string, unknown>);
  } catch (err) {
    console.error('[OrderExecution] getOrderById failed:', err);
    return null;
  }
}

/**
 * Marks order as dispatched (pending → processing).
 */
export async function dispatchOrder(orderId: string, audit?: OrderAuditContext): Promise<OrderStatusResult> {
  // existing dispatch implementation
  if (!useMemoryStore() && !isSupabaseConfigured()) {
    return { success: false, message: 'Database connection is temporarily offline.' };
  }

  const existing = await getOrderById(orderId);
  if (!existing) {
    return { success: false, message: 'Order not found.' };
  }
  if (existing.status !== 'pending') {
    return {
      success: false,
      message: `Cannot dispatch order in status "${existing.status}". Expected "pending".`,
      order: existing,
    };
  }

  try {
    if (useMemoryStore()) {
      const updated: OrderRecord = { ...existing, status: 'processing' };
      memoryOrderStore!.set(orderId, updated);
      logOrderLifecycleEvent({
        orderId,
        event: 'dispatched',
        sessionId: audit?.sessionId,
        buyerId: audit?.buyerId ?? existing.buyer_id,
        fromStatus: 'pending',
        toStatus: 'processing',
        metadata: audit?.note ? { note: audit.note } : undefined,
      });
      return {
        success: true,
        message: 'Order dispatched successfully.',
        order: updated,
      };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, message: error?.message ?? 'Failed to dispatch order.' };
    }

    const order = mapOrderRow(data as Record<string, unknown>);
    logOrderLifecycleEvent({
      orderId,
      event: 'dispatched',
      sessionId: audit?.sessionId,
      buyerId: audit?.buyerId ?? order.buyer_id,
      fromStatus: 'pending',
      toStatus: 'processing',
      metadata: audit?.note ? { note: audit.note } : undefined,
    });

    return {
      success: true,
      message: 'Order dispatched successfully.',
      order,
    };
  } catch (err) {
    console.error('[OrderExecution] dispatchOrder failed:', err);
    return { success: false, message: 'An unexpected error occurred while dispatching the order.' };
  }
}

/**
 * Confirms order receipt (processing → completed).
 */
export async function completeOrderReceipt(orderId: string, audit?: OrderAuditContext): Promise<OrderStatusResult> {
  // existing receipt implementation

  if (!useMemoryStore() && !isSupabaseConfigured()) {
    return { success: false, message: 'Database connection is temporarily offline.' };
  }

  const existing = await getOrderById(orderId);
  if (!existing) {
    return { success: false, message: 'Order not found.' };
  }
  if (existing.status !== 'processing') {
    return {
      success: false,
      message: `Cannot confirm receipt for status "${existing.status}". Expected "processing".`,
      order: existing,
    };
  }

  try {
    if (useMemoryStore()) {
      const updated: OrderRecord = { ...existing, status: 'completed' };
      memoryOrderStore!.set(orderId, updated);
      logOrderLifecycleEvent({
        orderId,
        event: 'received',
        sessionId: audit?.sessionId,
        buyerId: audit?.buyerId ?? existing.buyer_id,
        fromStatus: 'processing',
        toStatus: 'completed',
        metadata: audit?.note ? { note: audit.note } : undefined,
      });
      return {
        success: true,
        message: 'Order receipt confirmed successfully.',
        order: updated,
      };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId)
      .eq('status', 'processing')
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, message: error?.message ?? 'Failed to confirm receipt.' };
    }

    const order = mapOrderRow(data as Record<string, unknown>);
    logOrderLifecycleEvent({
      orderId,
      event: 'received',
      sessionId: audit?.sessionId,
      buyerId: audit?.buyerId ?? order.buyer_id,
      fromStatus: 'processing',
      toStatus: 'completed',
      metadata: audit?.note ? { note: audit.note } : undefined,
    });

    return {
      success: true,
      message: 'Order receipt confirmed successfully.',
      order,
    };
  } catch (err) {
    console.error('[OrderExecution] completeOrderReceipt failed:', err);
    return { success: false, message: 'An unexpected error occurred while confirming receipt.' };
  }
}

/**
 * Gets a single highest-rated product matching type/crop.
 */
export async function getAutoRecommendation(
  productType?: string,
  cropType?: string
): Promise<Product | undefined> {
  const products = await searchProducts(productType, cropType);
  return products[0]; // Already sorted descending by trust_score/dvs
}
