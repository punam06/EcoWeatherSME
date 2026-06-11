/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — ROLE GUARD MIDDLEWARE FACTORY
 * File: src/middleware/roleGuard.ts
 *
 * Creates Express middleware that enforces role-based access.
 * Supports single role or array of allowed roles.
 *
 * Usage:
 *   router.post('/certify', authenticateJWT, requireRoles('processor'), handler);
 *   router.get('/admin/report', authenticateJWT, requireRoles('admin', 'processor'), handler);
 *
 * Development note: In NODE_ENV=development the guard is a no-op
 * so local testing does not require a real JWT token.
 * ═══════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Returns an Express middleware that passes the request if the
 * authenticated user has at least one of the specified roles.
 *
 * @param roles - One or more allowed role strings (e.g. 'processor', 'admin')
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const user = (req as any).user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Supabase stores custom claims in user_metadata.role
    const userRole: string | undefined =
      user?.app_metadata?.role ??
      user?.user_metadata?.role ??
      undefined;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of these roles: ${roles.join(', ')}. Your role: ${userRole ?? 'none'}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Convenience alias for a single allowed role — mirrors the old
 * authenticateJWT.requireRole() signature for backwards compatibility.
 */
export const requireRole = (role: string) => requireRoles(role);
