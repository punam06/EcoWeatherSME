/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — PRODUCT SEARCH SERVICE
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

    let products: Product[] = data || [];

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
