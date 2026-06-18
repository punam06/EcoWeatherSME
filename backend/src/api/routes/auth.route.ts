import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { requireAuth } from '../../lib/middleware/auth.middleware';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
}).strict();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: z.enum(['processor', 'buyer', 'admin', 'producer', 'consumer', 'sme_owner']),
}).strict();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function signToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

// In-memory store for registered users when Supabase is not configured or fails.
const IN_MEMORY_USERS_MAX = 1000;
const IN_MEMORY_USERS = new Map<string, { id: string; password_hash: string; name: string; role: string }>();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const { email, password } = parsed.data;

    const DEMO_USERS: Record<string, { id: string; password_hash: string; name: string; role: string }> = {
      'processor.demo@climalogix.local': {
        id: '00000000-0000-0000-0000-000000000001',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY',
        name: 'Demo Processor',
        role: 'processor',
      },
      'buyer.demo@climalogix.local': {
        id: '00000000-0000-0000-0000-000000000002',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY',
        name: 'Demo Buyer',
        role: 'buyer',
      },
      'admin.demo@climalogix.local': {
        id: '00000000-0000-0000-0000-000000000003',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$SZ5P2auoBrj86fK+Jme1Ug$B0EgO63xNZiLejJBJ9p6UFW4zjCaAXnxS4Zh/pXoNeY',
        name: 'Demo Admin',
        role: 'admin',
      },
    };

    const demoUser = DEMO_USERS[email.toLowerCase()];
    if (demoUser) {
      const valid = await argon2.verify(demoUser.password_hash, password).catch((err) => {
        console.error('[AuthAPI] Argon2 verify error:', err);
        return false;
      });
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = signToken({ id: demoUser.id, email: email.toLowerCase(), role: demoUser.role });
      res.json({ success: true, token, user: { id: demoUser.id, email: email.toLowerCase(), name: demoUser.name, role: demoUser.role } });
      return;
    }

    // Check in-memory users
    const inMemUser = IN_MEMORY_USERS.get(email.toLowerCase());
    if (inMemUser) {
      const valid = await argon2.verify(inMemUser.password_hash, password).catch((err) => {
        console.error('[AuthAPI] Argon2 verify error:', err);
        return false;
      });
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = signToken({ id: inMemUser.id, email: email.toLowerCase(), role: inMemUser.role });
      res.json({ success: true, token, user: { id: inMemUser.id, email: email.toLowerCase(), name: inMemUser.name, role: inMemUser.role } });
      return;
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, name, role')
          .eq('email', email.toLowerCase())
          .single();

        if (!error && user) {
          const valid = await argon2.verify(user.password_hash, password).catch((err) => {
            console.error('[AuthAPI] Argon2 verify error:', err);
            return false;
          });
          if (valid) {
            const token = signToken({ id: user.id, email: user.email, role: user.role });
            res.json({
              success: true,
              token,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
            });
            return;
          }
        }
      } catch (err) {
        console.warn('[AuthAPI] Supabase login attempt failed:', err);
      }
    }

    res.status(401).json({ success: false, error: 'Invalid email or password' });
  } catch (error) {
    console.error('[AuthAPI] Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const { email, password, name, role } = parsed.data;

    let password_hash: string;
    try {
      password_hash = await argon2.hash(password);
    } catch (hashError) {
      console.error('[AuthAPI] Password hashing failed:', hashError);
      res.status(500).json({ success: false, message: 'Account creation failed.' });
      return;
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .single();

        if (existing) {
          res.status(409).json({ success: false, error: 'A user with this email already exists' });
          return;
        }

        const { data: user, error } = await supabase
          .from('users')
          .insert({
            email: email.toLowerCase(),
            password_hash,
            name,
            role,
          })
          .select('id, email, name, role')
          .single();

        if (!error && user) {
          const token = signToken({ id: user.id, email: user.email, role: user.role });
          res.status(201).json({
            success: true,
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            },
          });
          return;
        }
        console.warn('[AuthAPI] Supabase signup failed, falling back to in-memory registry:', error);
      } catch (err) {
        console.warn('[AuthAPI] Supabase signup threw error, falling back to in-memory registry:', err);
      }
    }

    // In-memory fallback
    if (IN_MEMORY_USERS.size >= IN_MEMORY_USERS_MAX) {
      res.status(503).json({ success: false, error: 'Account creation temporarily unavailable' });
      return;
    }
    const fakeId = '00000000-0000-0000-0000-ffff' + Math.random().toString(16).slice(2, 12);
    IN_MEMORY_USERS.set(email.toLowerCase(), {
      id: fakeId,
      password_hash,
      name,
      role,
    });

    const token = signToken({ id: fakeId, email: email.toLowerCase(), role });
    res.status(201).json({
      success: true,
      token,
      user: {
        id: fakeId,
        email: email.toLowerCase(),
        name,
        role,
      },
    });
  } catch (err) {
    console.error('[AuthAPI] Signup error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
