/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — JWT AUTHENTICATION MIDDLEWARE
 * File: src/lib/middleware/auth.middleware.ts
 *
 * Verifies Bearer JWT tokens. On success, attaches decoded payload
 * to req.user. On failure with requireAuth=true, rejects with 401.
 * On failure with requireAuth=false (optional), silently passes.
 * ═══════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;        // user UUID
  email: string;
  role: 'processor' | 'buyer' | 'admin';
  iat?: number;
  exp?: number;
}

// Augment Express Request type to hold user payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Strict middleware — rejects unauthenticated requests with 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: missing or invalid token' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Unauthorized: token is expired or invalid' });
  }
}

/**
 * Optional middleware — attaches user to req if token valid, else passes silently.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      // Invalid token — ignore, treat as unauthenticated
    }
  }
  next();
}

/**
 * Role-based guard — use after requireAuth.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
}
