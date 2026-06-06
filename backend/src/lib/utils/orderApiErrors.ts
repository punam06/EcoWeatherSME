/**
 * CLIMALOGIX AI — ORDER API ERROR MAPPING
 * File: src/lib/utils/orderApiErrors.ts
 */

import { Response } from 'express';
import { ZodError } from 'zod';
import {
  OrderApiErrorResponseSchema,
  OrderApiSuccessResponseSchema,
  OrderRecordSchema,
} from '../../api/schemas/order.schema';
import type { OrderRecordDto, OrderApiErrorResponse, OrderApiSuccessResponse } from '../../api/schemas/order.schema';
import type { OrderRecord, OrderStatusResult } from '../services/orderExecution.service';

export const OrderErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DATABASE_NOT_CONFIGURED: 'DATABASE_NOT_CONFIGURED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  ORDER_OPERATION_FAILED: 'ORDER_OPERATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type OrderErrorCodeType = (typeof OrderErrorCode)[keyof typeof OrderErrorCode];

export function toOrderRecordDto(order: OrderRecord): OrderRecordDto {
  return OrderRecordSchema.parse({
    id: order.id,
    buyer_id: order.buyer_id,
    product_id: order.product_id,
    quantity: order.quantity,
    totalBdt: order.totalBdt,
    status: order.status,
    created_at: order.created_at,
  });
}

export function buildOrderError(
  code: OrderErrorCodeType,
  error: string,
  options?: { message?: string; details?: unknown; order?: OrderRecord }
): OrderApiErrorResponse {
  const payload: OrderApiErrorResponse = {
    success: false,
    error,
    code,
    message: options?.message,
    details: options?.details,
    data: options?.order ? { order: toOrderRecordDto(options.order) } : undefined,
  };
  return OrderApiErrorResponseSchema.parse(payload);
}

export function buildOrderSuccess(
  order: OrderRecord,
  message?: string
): OrderApiSuccessResponse {
  const payload: OrderApiSuccessResponse = {
    success: true,
    data: {
      order: toOrderRecordDto(order),
      message,
    },
  };
  return OrderApiSuccessResponseSchema.parse(payload);
}

export function sendOrderError(res: Response, status: number, body: OrderApiErrorResponse): void {
  res.status(status).json(OrderApiErrorResponseSchema.parse(body));
}

export function sendOrderSuccess(res: Response, status: number, body: OrderApiSuccessResponse): void {
  res.status(status).json(OrderApiSuccessResponseSchema.parse(body));
}

export function mapZodError(error: ZodError): OrderApiErrorResponse {
  return buildOrderError(OrderErrorCode.VALIDATION_FAILED, 'Validation failed', {
    message: error.issues[0]?.message ?? 'Invalid request',
    details: error.issues,
  });
}

export function mapDatabaseNotConfigured(): { status: number; body: OrderApiErrorResponse } {
  return {
    status: 503,
    body: buildOrderError(
      OrderErrorCode.DATABASE_NOT_CONFIGURED,
      'Database not configured',
      { message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }
    ),
  };
}

export function mapOrderStatusResult(result: OrderStatusResult): { status: number; body: OrderApiSuccessResponse | OrderApiErrorResponse } {
  if (result.success && result.order) {
    return {
      status: 200,
      body: buildOrderSuccess(result.order, result.message),
    };
  }

  if (result.message.includes('not found')) {
    return {
      status: 404,
      body: buildOrderError(OrderErrorCode.ORDER_NOT_FOUND, result.message),
    };
  }

  if (result.order) {
    return {
      status: 409,
      body: buildOrderError(OrderErrorCode.INVALID_STATUS_TRANSITION, result.message, {
        order: result.order,
      }),
    };
  }

  if (result.message.includes('temporarily offline') || result.message.includes('not configured')) {
    return {
      status: 503,
      body: buildOrderError(OrderErrorCode.DATABASE_NOT_CONFIGURED, result.message),
    };
  }

  return {
    status: 500,
    body: buildOrderError(OrderErrorCode.ORDER_OPERATION_FAILED, result.message),
  };
}
