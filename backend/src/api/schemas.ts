/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — ZOD VALIDATION SCHEMAS
 * File: src/api/schemas.ts
 *
 * All incoming request body shapes validated with strict Zod schemas.
 * ═══════════════════════════════════════════════════════════════
 */

import { z } from 'zod';

// ─── Trust Score Schema ───────────────────────────────────────────────────────

export const TrustScoreRequestSchema = z.object({
  /** pH of biological material — must be between 0 and 14 */
  pH: z
    .number({ required_error: 'pH is required', invalid_type_error: 'pH must be a number' })
    .min(0, 'pH cannot be negative')
    .max(14, 'pH cannot exceed 14'),

  /** Electrical Conductivity in dS/m */
  ec: z
    .number({ required_error: 'ec is required', invalid_type_error: 'ec must be a number' })
    .min(0, 'ec must be non-negative')
    .max(20, 'ec cannot exceed 20'),

  /** Temperature in Celsius */
  temperatureCelsius: z
    .number({
      required_error: 'temperatureCelsius is required',
      invalid_type_error: 'temperatureCelsius must be a number',
    })
    .min(-50, 'Temperature too low')
    .max(100, 'Temperature too high'),

  /**
   * EM-1 ratio as decimal:
   * 0.002 = 1:500, 0.001 = 1:1000, 0.0005 = 1:2000
   * Other values are allowed (they just trigger a penalty).
   */
  em1Ratio: z
    .number({
      required_error: 'em1Ratio is required',
      invalid_type_error: 'em1Ratio must be a number',
    })
    .min(0.0001, 'em1Ratio must be at least 0.0001')
    .max(1.0, 'em1Ratio cannot exceed 1.0'),

  /** Fermentation duration in days (minimum 0 — scoring penalises below 21) */
  fermentationDays: z
    .number({
      required_error: 'fermentationDays is required',
      invalid_type_error: 'fermentationDays must be a number',
    })
    .int('fermentationDays must be an integer')
    .min(0, 'fermentationDays must be 0 or greater')
    .max(365, 'fermentationDays cannot exceed 365'),
}).strict();

export type TrustScoreRequest = z.infer<typeof TrustScoreRequestSchema>;

// ─── Climate DVS Schema ───────────────────────────────────────────────────────

export const ClimateDVSRequestSchema = z.object({
  /** Delivery zone — any valid Dhaka zone name */
  zone: z
    .string({ required_error: 'zone is required', invalid_type_error: 'zone must be a string' })
    .min(1, 'zone must not be empty')
    .max(100, 'zone name too long'),

  /** Regional ambient temperature in Celsius */
  ambientTemperature: z
    .number({
      required_error: 'ambientTemperature is required',
      invalid_type_error: 'ambientTemperature must be a number',
    })
    .min(-10, 'Temperature too low')
    .max(60, 'Temperature too high'),

  /** Current hour in 24-hour format: 0–23 */
  solarHour: z
    .number({
      required_error: 'solarHour is required',
      invalid_type_error: 'solarHour must be a number',
    })
    .int('solarHour must be an integer')
    .min(0, 'solarHour must be between 0 and 23')
    .max(23, 'solarHour must be between 0 and 23'),

  /** Bio-asset trust score: 0–100 */
  trustScore: z
    .number({
      required_error: 'trustScore is required',
      invalid_type_error: 'trustScore must be a number',
    })
    .min(0, 'trustScore must be between 0 and 100')
    .max(100, 'trustScore must be between 0 and 100'),
}).strict();

export type ClimateDVSRequest = z.infer<typeof ClimateDVSRequestSchema>;

// ─── AI Recommend Schema ──────────────────────────────────────────────────────

export const AIRecommendRequestSchema = z.object({
  /** The user's natural language question */
  query: z
    .string({ required_error: 'query is required', invalid_type_error: 'query must be a string' })
    .min(1, 'query must not be empty')
    .max(2000, 'query must be 2000 characters or fewer'),

  /** Response language: "en" for English, "bn" for Bangla */
  language: z.enum(['bn', 'en'], {
    required_error: 'language is required',
    invalid_type_error: 'language must be "bn" or "en"',
  }),
}).strict();

export type AIRecommendRequest = z.infer<typeof AIRecommendRequestSchema>;

// ─── Trust Score v2 Schema (Category-Aware) ────────────────

export const ProductCategorySchema = z.enum(
  ['organic', 'retail', 'pharma', 'dairy', 'manufacturing'],
  {
    required_error: 'category is required',
    invalid_type_error: 'category must be one of: organic, retail, pharma, dairy, manufacturing',
  },
);

export const TrustScoreV2RequestSchema = z
  .object({
    category: ProductCategorySchema.default('organic'),
    pH: z.number().min(0).max(14),
    ec: z.number().min(0).max(20),
    temperatureCelsius: z.number().min(-50).max(100),
    em1Ratio: z.number().min(0).max(1),
    fermentationDays: z.number().int().min(0).max(365),
  })
  .strict();

export type TrustScoreV2Request = z.infer<typeof TrustScoreV2RequestSchema>;

// ─── QA Ingestion Schema ────────────────────────────────────

export const QAReportSourceSchema = z.enum(['iot', 'inspector', 'manufacturer'], {
  required_error: 'source is required',
  invalid_type_error: 'source must be one of: iot, inspector, manufacturer',
});

export const IngestQARequestSchema = z
  .object({
    batch_id: z.string().min(1).max(100),
    source: QAReportSourceSchema,
    category: ProductCategorySchema,
    metrics: z.object({
      pH: z.number().min(0).max(14),
      ec: z.number().min(0).max(20),
      temp: z.number().min(-50).max(100),
      em1Ratio: z.number().min(0).max(1),
      fermentationDays: z.number().int().min(0).max(365),
    }),
    bstiCredential: z.string().min(1).max(100).optional(),
    inspectorNotes: z.string().max(2000).optional(),
    signed_by: z.string().max(200).optional(),
    signature: z.string().max(256).optional(),
  })
  .strict();

export type IngestQARequest = z.infer<typeof IngestQARequestSchema>;

// ─── Verify Schema (Public QR endpoint) ─────────────────────

export const VerifyBatchRequestSchema = z
  .object({
    batch_id: z.string().min(1).max(100),
  })
  .strict();

export type VerifyBatchRequest = z.infer<typeof VerifyBatchRequestSchema>;
