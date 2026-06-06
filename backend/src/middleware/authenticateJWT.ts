import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    // Inject mock user for local testing
    (req as any).user = {
      id: 'mock-dev-user-id',
      user_metadata: { role: 'processor' }
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  (req as any).user = user;
  next();
}

export async function optionalJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      (req as any).user = user;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const user = (req as any).user;
    const userRole: string | undefined =
      user?.app_metadata?.role ?? user?.user_metadata?.role ?? undefined;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole ?? 'none'}.`,
      });
    }
    next();
  };
}

