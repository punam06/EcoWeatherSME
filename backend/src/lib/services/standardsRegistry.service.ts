/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — STANDARDS REGISTRY
 * File: src/lib/services/standardsRegistry.service.ts
 *
 * Central lookup of category-specific quality standards. Adding
 * a new product category means adding a new entry to `STANDARDS`
 * and a new value to the `ProductCategory` union in `types.ts`.
 *
 * References are citable Bangladesh regulatory / research bodies:
 *  - BARI = Bangladesh Agricultural Research Institute
 *  - BSTI = Bangladesh Standards and Testing Institution
 *  - DGDA = Directorate General of Drug Administration
 *  - BFSA = Bangladesh Food Safety Authority
 * ═══════════════════════════════════════════════════════════════
 */

import { ProductCategory, ProductStandard } from '../types';

/** BSTI license format: "BSTI-" followed by 4+ digits. */
export const BSTI_REGEX = /^BSTI-\d{4,}$/;

export function isValidBSTICredential(value: string): boolean {
  return BSTI_REGEX.test(value);
}

/** Canonical list — used for seed scripts and admin UIs. */
export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'organic',
  'retail',
  'pharma',
  'dairy',
  'manufacturing',
] as const;

const STANDARDS: Record<ProductCategory, ProductStandard> = {
  organic: {
    category: 'organic',
    label: 'Organic Compost (BARI aligned)',
    phRange: [6.5, 7.5],
    ecRange: [1.5, 3.5],
    tempRange: [25, 35],
    requiredRatio: 0.001, // 1:1000 EM-1
    minFermentationDays: 21,
    requiresBSTI: false,
    reference: 'BARI Composting Manual 2019, §4.2',
    weights: { ph: 0.25, ec: 0.2, temp: 0.15, ratio: 0.2, days: 0.2 },
  },
  retail: {
    category: 'retail',
    label: 'Retail Produce (BSTI BDS 1701)',
    phRange: [5.5, 7.0],
    ecRange: [1.0, 2.5],
    tempRange: [15, 30],
    requiredRatio: 0, // retail produce is not biologically inoculated
    minFermentationDays: 0,
    requiresBSTI: true,
    reference: 'BSTI BDS 1701:2018 — Fresh Fruits & Vegetables',
    weights: { ph: 0.2, ec: 0.15, temp: 0.4, ratio: 0.05, days: 0.2 },
  },
  pharma: {
    category: 'pharma',
    label: 'Pharmaceutical Cold-Chain (DGDA)',
    phRange: [6.0, 8.0],
    ecRange: [0.5, 2.0],
    tempRange: [2, 8],
    requiredRatio: 0,
    minFermentationDays: 0,
    requiresBSTI: true,
    reference: 'DGDA Schedule M, Cold-Chain Annexure 2021',
    weights: { ph: 0.15, ec: 0.1, temp: 0.55, ratio: 0.05, days: 0.15 },
  },
  dairy: {
    category: 'dairy',
    label: 'Dairy & Milk Products (BFSA)',
    phRange: [6.4, 6.8],
    ecRange: [0.4, 1.2],
    tempRange: [2, 6],
    requiredRatio: 0,
    minFermentationDays: 0,
    requiresBSTI: true,
    reference: 'BFSA Dairy Product Standard 2020, §3.1',
    weights: { ph: 0.2, ec: 0.15, temp: 0.5, ratio: 0.05, days: 0.1 },
  },
  manufacturing: {
    category: 'manufacturing',
    label: 'Industrial Feedstock (BSTI BDS 425)',
    phRange: [6.0, 8.5],
    ecRange: [1.0, 4.0],
    tempRange: [10, 40],
    requiredRatio: 0,
    minFermentationDays: 0,
    requiresBSTI: true,
    reference: 'BSTI BDS 425:2007 — Industrial Bio-substrates',
    weights: { ph: 0.2, ec: 0.2, temp: 0.25, ratio: 0.1, days: 0.25 },
  },
};

/**
 * Returns the standard for a category. Throws if the category is
 * unknown — callers that want a graceful fallback should use
 * `tryGetStandard` instead.
 */
export function getStandard(category: ProductCategory): ProductStandard {
  const std = STANDARDS[category];
  if (!std) {
    throw new Error(
      `Unknown product category "${category}". ` +
        `Add it to STANDARDS in standardsRegistry.service.ts.`,
    );
  }
  return std;
}

/**
 * Same as `getStandard` but returns null when the category is
 * unknown — useful for input validation paths.
 */
export function tryGetStandard(
  category: string,
): ProductStandard | null {
  if (Object.prototype.hasOwnProperty.call(STANDARDS, category)) {
    return STANDARDS[category as ProductCategory];
  }
  return null;
}

/**
 * Returns the list of categories that require a BSTI credential
 * at ingest time. Used by the QA route to gate writes.
 */
export function categoriesRequiringBSTI(): ProductCategory[] {
  return Object.values(STANDARDS)
    .filter((s) => s.requiresBSTI)
    .map((s) => s.category);
}
