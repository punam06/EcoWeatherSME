/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — STANDARDS REGISTRY (Trust Layer v2)
 * File: lib/services/standardsRegistry.service.ts
 *
 * Replaces the hardcoded BARI EM-1 ranges in trustScore.service.ts
 * with a product-category-aware lookup table. The math in
 * calculateTrustScore is unchanged in spirit — it now reads its
 * acceptable ranges, required ratio, and BSTI gating from this
 * registry, so the same function scores organic biofertilizer,
 * retail FMCG, pharma cold-chain, dairy, and industrial chemicals.
 *
 * Bangladesh context:
 *   - organic   → BARI EM-1 biofertilizer (the original use case)
 *   - retail    → Packaged FMCG (shelf-life, packaging integrity)
 *   - pharma    → DGDA-regulated; BSTI inspector required
 *   - dairy     → Pasteurized milk; BSTI inspector required
 *   - manufacturing → Industrial chemicals (no pH gating)
 * ═══════════════════════════════════════════════════════════════
 */

import { ProductCategory, ProductStandard } from '../types';

/**
 * Canonical standards for each product category. Tuned to be
 * defensible at the AI BuildFest demo: every value can be cited.
 */
export const STANDARDS: Record<ProductCategory, ProductStandard> = {
  organic: {
    category: 'organic',
    displayName: 'Organic Biofertilizer (BARI EM-1)',
    phRange: [3.5, 7.5],
    ecRange: [2.5, 5.0],
    tempRange: [25, 35],
    requiredRatio: '1:1:20',
    minFermentationDays: 7,
    maxFermentationDays: 14,
    requiresBSTI: false,
    weights: { ph: 30, ec: 6, temp: 1.2, ratio: 5, days: 10 },
  },
  retail: {
    category: 'retail',
    displayName: 'Retail FMCG / Packaged Goods',
    // Retail goods do not use pH; a null range disables that dimension.
    phRange: null,
    // EC is reinterpreted as packaging moisture-integrity index (0-10).
    ecRange: [0, 10],
    // Cold-chain tolerance is wider than biological fermentation.
    tempRange: [10, 32],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 365,
    requiresBSTI: false,
    weights: { ph: 0, ec: 4, temp: 2.0, ratio: 0, days: 0.5 },
  },
  pharma: {
    category: 'pharma',
    displayName: 'Pharmaceuticals (DGDA regulated)',
    // pH 4.5-7.5 is the safe window for most oral liquids / syrups.
    phRange: [4.5, 7.5],
    // EC is reinterpreted as dissolved-solids / impurity index (0-5).
    ecRange: [0, 5],
    // Cold-chain must hold 2-8°C; excursions are penalized heavily.
    tempRange: [2, 8],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 180,
    requiresBSTI: true,
    weights: { ph: 6, ec: 6, temp: 4.0, ratio: 0, days: 0.2 },
  },
  dairy: {
    category: 'dairy',
    displayName: 'Dairy / Pasteurized Milk',
    // Fresh milk pH 6.5-6.8; spoilage pushes it down rapidly.
    phRange: [6.5, 6.8],
    // EC reinterpreted as bacterial load (CFU proxy 0-10).
    ecRange: [0, 10],
    // Cold-chain must hold 2-6°C.
    tempRange: [2, 6],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 7,
    requiresBSTI: true,
    weights: { ph: 10, ec: 8, temp: 3.5, ratio: 0, days: 1.5 },
  },
  manufacturing: {
    category: 'manufacturing',
    displayName: 'Manufacturing / Industrial Chemicals',
    // pH irrelevant for most industrial chemicals (lubricants, solvents).
    phRange: null,
    // EC reinterpreted as contamination (ppm 0-100).
    ecRange: [0, 100],
    // Storage temp window 15-30°C.
    tempRange: [15, 30],
    requiredRatio: null,
    minFermentationDays: 0,
    maxFermentationDays: 365,
    requiresBSTI: false,
    weights: { ph: 0, ec: 0.2, temp: 1.5, ratio: 0, days: 0.1 },
  },
};

/** List every supported category (useful for the demo "category picker"). */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'organic',
  'retail',
  'pharma',
  'dairy',
  'manufacturing',
];

/**
 * Returns the standard for a category. Throws on unknown input so callers
 * can fail fast rather than silently score against a missing rulebook.
 */
export function getStandard(category: ProductCategory): ProductStandard {
  const std = STANDARDS[category];
  if (!std) {
    throw new Error(
      `[standardsRegistry] Unknown product category: '${category}'. ` +
      `Supported: ${PRODUCT_CATEGORIES.join(', ')}`
    );
  }
  return std;
}

/** Safe lookup returning undefined instead of throwing. */
export function tryGetStandard(category: string): ProductStandard | undefined {
  return (STANDARDS as Record<string, ProductStandard | undefined>)[category];
}

/**
 * Validates the BSTI credential format used by inspector reports for
 * sensitive categories. Strictly: "BSTI-" followed by 4+ digits.
 * Mirrored on the backend route and reused by the UI for early warnings.
 */
const BSTI_REGEX = /^BSTI-\d{4,}$/;
export function isValidBSTICredential(credential: string | undefined | null): boolean {
  return typeof credential === 'string' && BSTI_REGEX.test(credential);
}
