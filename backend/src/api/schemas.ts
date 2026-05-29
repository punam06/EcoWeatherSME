/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — ZOD VALIDATION SCHEMAS
 * File: src/api/schemas.ts
 *
 * All incoming request body shapes validated with strict Zod schemas.
 * ═══════════════════════════════════════════════════════════════
 */

import { z } from 'zod';

// ─── Trust Score Schema ───────────────────────────────────────────────────────

export const TrustScoreRequestSchema = z.object({
  /** pH of biological material — must be a positive number */
  pH: z
    .number({ required_error: 'pH is required', invalid_type_error: 'pH must be a number' })
    .positive('pH must be positive')
    .max(14, 'pH cannot exceed 14'),

  /** Electrical Conductivity in dS/m */
  ec: z
    .number({ required_error: 'ec is required', invalid_type_error: 'ec must be a number' })
    .nonnegative('ec must be non-negative'),

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
    .positive('em1Ratio must be positive'),

  /** Fermentation duration in days (minimum 0 — scoring penalises below 21) */
  fermentationDays: z
    .number({
      required_error: 'fermentationDays is required',
      invalid_type_error: 'fermentationDays must be a number',
    })
    .int('fermentationDays must be an integer')
    .nonnegative('fermentationDays must be 0 or greater'),
});

export type TrustScoreRequest = z.infer<typeof TrustScoreRequestSchema>;

// ─── Climate DVS Schema ───────────────────────────────────────────────────────

export const ClimateDVSRequestSchema = z.object({
  /** Delivery zone — any valid Dhaka zone name */
  zone: z
    .string({ required_error: 'zone is required', invalid_type_error: 'zone must be a string' })
    .min(1, 'zone must not be empty'),

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
});

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
});

export type AIRecommendRequest = z.infer<typeof AIRecommendRequestSchema>;
