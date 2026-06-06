/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — PRODUCT SEARCH SERVICE
 * File: src/lib/services/productSearch.service.ts
 *
 * Queries the Supabase product catalog using exact schema definitions.
 * Returns up to 3 products sorted by trust_score/dvs descending.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';

export interface Product {
  id: string;
  batch_id?: string;
  name: string;
  description?: string;
  price_bdt: number;
  quantity: number;
  trust_score: number;
  dvs: number;
  created_at?: string;
  original_price_bdt?: number;
  discount_percent?: number;
  is_clearance?: boolean;
}

/**
 * Calculates decay-based spot pricing.
 * If product's dvs is low (< 75), it means the transit risk is high (short TST).
 * We discount the price dynamically to clear inventory locally and prevent total biological spoilage.
 */
export function calculateSpotPrice(basePrice: number, dvsScore: number): { currentPrice: number; discountPercent: number; isClearance: boolean } {
  if (dvsScore >= 80) {
    return { currentPrice: basePrice, discountPercent: 0, isClearance: false };
  }
  
  // Moderate risk: 10% discount
  if (dvsScore >= 70) {
    const currentPrice = Math.round(basePrice * 0.90);
    return { currentPrice, discountPercent: 10, isClearance: false };
  }
  
  // High transit decay risk: 30% discount (Clearance alert)
  if (dvsScore >= 60) {
    const currentPrice = Math.round(basePrice * 0.70);
    return { currentPrice, discountPercent: 30, isClearance: true };
  }
  
  // Critical decay risk: 50% discount to dump stock before total degradation
  const currentPrice = Math.round(basePrice * 0.50);
  return { currentPrice, discountPercent: 50, isClearance: true };
}

/**
 * Queries Supabase catalog for products.
 * Filters by productType/cropType keywords if present in description or name.
 */
export async function searchProducts(productType?: string, cropType?: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[ProductSearch] Supabase is not configured. Returning empty catalog.');
    return [];
  }

  try {
    const supabase = getSupabaseClient();
    let query = supabase.from('products').select('*');

    // Run query
    const { data, error } = await query;
    if (error) {
      console.error('[ProductSearch] Supabase query error:', error.message);
      return [];
    }

    let rawProducts: any[] = data || [];
    
    // Map dynamic spot pricing based on DVS score
    let products: Product[] = rawProducts.map((p) => {
      const dvsVal = p.dvs || 75;
      const basePrice = p.price_bdt || 150;
      const spot = calculateSpotPrice(basePrice, dvsVal);
      return {
        id: p.id,
        batch_id: p.batch_id,
        name: p.name,
        description: p.description,
        price_bdt: spot.currentPrice,
        quantity: p.quantity || 100,
        trust_score: p.trust_score || 80,
        dvs: dvsVal,
        created_at: p.created_at,
        original_price_bdt: basePrice,
        discount_percent: spot.discountPercent,
        is_clearance: spot.isClearance
      };
    });

    // Filter by productType if specified
    if (productType) {
      const pType = productType.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(pType) ||
          (p.description && p.description.toLowerCase().includes(pType))
      );
    }

    // Filter by cropType if specified
    if (cropType) {
      const cType = cropType.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(cType) ||
          (p.description && p.description.toLowerCase().includes(cType))
      );
    }

    // Sort by trust_score descending, then dvs descending
    products.sort((a, b) => b.trust_score - a.trust_score || b.dvs - a.dvs);

    // Return top 3 products max
    return products.slice(0, 3);
  } catch (err) {
    console.error('[ProductSearch] Unexpected search error:', err);
    return [];
  }
}
