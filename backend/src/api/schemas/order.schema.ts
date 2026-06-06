/**
 * CLIMALOGIX AI — ORDER API ZOD SCHEMAS
 * File: src/api/schemas/order.schema.ts
 */

import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'pending',
  'accepted',
  'delayed',
  'rerouted',
  'packaging_changed',
  'rejected',
  'processing',
  'completed',
  'canceled',
  'cancelled',
]);

export const OrderIdParamsSchema = z
  .object({
    id: z.string().uuid({ message: 'Invalid order id' }),
  })
  .strict();

export const OrderActionBodySchema = z
  .object({
    sessionId: z.string().min(1).max(100).optional(),
    buyerId: z.string().min(1).max(100).optional(),
    note: z.string().max(500).optional(),
  })
  .strict()
  .default({});

export const OrderRecordSchema = z
  .object({
    id: z.string().uuid(),
    buyer_id: z.string().min(1),
    product_id: z.string().nullable(),
    quantity: z.number().int().positive(),
    totalBdt: z.number().nonnegative(),
    status: OrderStatusSchema,
    created_at: z.string(),
  })
  .strict();

export const OrderApiSuccessDataSchema = z
  .object({
    order: OrderRecordSchema,
    message: z.string().optional(),
  })
  .strict();

export const OrderApiSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: OrderApiSuccessDataSchema,
  })
  .strict();

export const OrderApiErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
    code: z.string(),
    message: z.string().optional(),
    details: z.unknown().optional(),
    data: z
      .object({
        order: OrderRecordSchema.optional(),
      })
      .optional(),
  })
  .strict();

export type OrderIdParams = z.infer<typeof OrderIdParamsSchema>;
export type OrderActionBody = z.infer<typeof OrderActionBodySchema>;
export type OrderRecordDto = z.infer<typeof OrderRecordSchema>;
export type OrderApiSuccessResponse = z.infer<typeof OrderApiSuccessResponseSchema>;
export type OrderApiErrorResponse = z.infer<typeof OrderApiErrorResponseSchema>;
