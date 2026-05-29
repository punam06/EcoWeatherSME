/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — ORDER EXECUTION SERVICE
 * File: src/lib/services/orderExecution.service.ts
 *
 * Implements transaction execution: initiate, confirm, cancel,
 * and auto-recommendation using Supabase exact schema keys.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { setPendingOrder, getSession, clearPendingOrder, PendingOrder } from './chatSession.service';
import { searchProducts, Product } from './productSearch.service';

export interface OrderResult {
  success: boolean;
  requiresAuth?: boolean;
  message: string;
  orderId?: string;
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

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Database connection is temporarily offline. Please try again later.',
    };
  }

  const { productId, quantity, totalBdt } = session.pendingOrder;

  try {
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
 * Gets a single highest-rated product matching type/crop.
 */
export async function getAutoRecommendation(
  productType?: string,
  cropType?: string
): Promise<Product | undefined> {
  const products = await searchProducts(productType, cropType);
  return products[0]; // Already sorted descending by trust_score/dvs
}
