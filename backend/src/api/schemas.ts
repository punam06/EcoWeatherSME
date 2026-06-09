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

// ─── QR Provenance Schemas ──────────────────────────────────

const gpsLatitude = z.number().min(-90).max(90);
const gpsLongitude = z.number().min(-180).max(180);

/** Normalized producer birth-certificate metrics (snake_case). */
export const QRInitialMetricsSchema = z
  .object({
    ph: z.number().min(0).max(14).optional(),
    pH: z.number().min(0).max(14).optional(),
    ec: z.number().min(0).max(20).optional(),
    EC: z.number().min(0).max(20).optional(),
    moisture: z.number().min(0).max(100).optional(),
    moisture_pct: z.number().min(0).max(100).optional(),
    category: ProductCategorySchema,
    fermentation_days: z.number().int().min(0).max(365).optional(),
    temperature_celsius: z.number().min(-50).max(100).optional(),
    em1_ratio: z.number().min(0).max(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.ph === undefined && data.pH === undefined) {
      ctx.addIssue({ code: 'custom', message: 'ph is required', path: ['ph'] });
    }
    if (data.ec === undefined && data.EC === undefined) {
      ctx.addIssue({ code: 'custom', message: 'ec is required', path: ['ec'] });
    }
    if (data.moisture === undefined && data.moisture_pct === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'moisture (or moisture_pct) is required',
        path: ['moisture'],
      });
    }
  })
  .transform((data) => ({
    ph: data.ph ?? data.pH!,
    ec: data.ec ?? data.EC!,
    moisture_pct: data.moisture_pct ?? data.moisture!,
    category: data.category,
    fermentation_days: data.fermentation_days,
    temperature_celsius: data.temperature_celsius,
    em1_ratio: data.em1_ratio,
  }));

export type QRInitialMetrics = z.infer<typeof QRInitialMetricsSchema>;

export const QRGenerateRequestSchema = z
  .object({
    initial_metrics: QRInitialMetricsSchema,
    producer_id: z.string().uuid().optional(),
    is_sensor_verified: z.boolean().optional().default(false),
    product_name: z.string().min(1).max(255).optional(),
    feedstock_type: z.string().min(1).max(255).optional(),
  })
  .strict();

export type QRGenerateRequest = z.infer<typeof QRGenerateRequestSchema>;

export const QRInspectRequestSchema = z
  .object({
    notes: z.string().max(2000).optional(),
    bsti_credential: z
      .string()
      .regex(/^BSTI-\d{4,}$/, 'BSTI credential must match BSTI-#### format')
      .optional(),
    gps_latitude: gpsLatitude.optional(),
    gps_longitude: gpsLongitude.optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.gps_latitude !== undefined;
    const hasLng = data.gps_longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'gps_latitude and gps_longitude must be provided together',
        path: ['gps_latitude'],
      });
    }
  });

export type QRInspectRequest = z.infer<typeof QRInspectRequestSchema>;

export const QRSMEClaimRequestSchema = z
  .object({
    zone: z.string().min(1).max(100).optional(),
    gps_latitude: gpsLatitude.optional(),
    gps_longitude: gpsLongitude.optional(),
    storage_condition: z.enum(['shaded', 'ambient', 'refrigerated']).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.gps_latitude !== undefined;
    const hasLng = data.gps_longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'gps_latitude and gps_longitude must be provided together',
        path: ['gps_latitude'],
      });
    }
  });

export type QRSMEClaimRequest = z.infer<typeof QRSMEClaimRequestSchema>;

export const BatchUuidParamSchema = z.string()
  .min(1, 'batch id is required')
  .max(100, 'batch id too long')
  .refine(
    (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) || /^BCH-\d{6,}$/i.test(v),
    { message: 'batch id must be a valid UUID or BCH- batch number' },
  );
