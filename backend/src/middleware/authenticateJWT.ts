import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

let _supabase: SupabaseClient | null = null;
function isSupabaseKeyValid(): boolean {
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return url.length > 0 && key.length > 0
    && !url.includes('your-project-id')
    && !key.includes('your-');
}
function getSupabase(): SupabaseClient | null {
  if (!_supabase && isSupabaseKeyValid()) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

/**
 * Attempts to verify a token against both Supabase Auth and custom JWT_SECRET.
 * Returns the user object on success, or null on failure.
 */
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'climalogix-dev-secret-change-in-production';
}

async function resolveUser(token: string): Promise<Record<string, unknown> | null> {
  // Try Supabase Auth first
  const sb = getSupabase();
  if (sb) {
    const { data: { user }, error } = await sb.auth.getUser(token).catch(() => ({ data: { user: null }, error: new Error('Supabase unreachable') }));
    if (!error && user) return user as unknown as Record<string, unknown>;
  }

  // Fallback: custom JWT signed with JWT_SECRET
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sub: string; email: string; role: string };
    return {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      user_metadata: { role: decoded.role },
      app_metadata: { role: decoded.role },
    };
  } catch { /* not a custom JWT either */ }

  return null;
}

export async function resolveUserForToken(token: string): Promise<Record<string, unknown> | null> {
  return resolveUser(token);
}

export function getRequestUser(req: Request): Record<string, unknown> | undefined {
  return (req as any).user;
}

export function getRequestUserId(req: Request): string | undefined {
  const user = getRequestUser(req);
  const id = user?.id ?? user?.sub;
  return typeof id === 'string' ? id : undefined;
}

export function getRequestUserRole(req: Request): string | undefined {
  const user = getRequestUser(req);
  const meta = user?.app_metadata as Record<string, unknown> | undefined;
  const userMeta = user?.user_metadata as Record<string, unknown> | undefined;
  const role = meta?.role ?? userMeta?.role ?? user?.role;
  return typeof role === 'string' ? role : undefined;
}

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') {
    (req as any).user = { id: 'test-user', role: 'admin', app_metadata: { role: 'admin' } };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split(' ')[1];
  const user = await resolveUser(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
  (req as any).user = user;
  next();
}

export async function optionalJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const user = await resolveUser(token);
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const userRole: string | undefined =
      user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? undefined;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole ?? 'none'}.`,
      });
    }
    next();
  };
}

