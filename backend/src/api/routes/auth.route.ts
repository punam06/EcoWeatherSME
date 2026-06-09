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
  return process.env.JWT_SECRET || 'climalogix-dev-secret-change-in-production';
}

function signToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const { email, password } = parsed.data;

    if (!isSupabaseConfigured()) {
      // Dev fallback: check hardcoded demo credentials
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
      if (!demoUser) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const valid = await argon2.verify(demoUser.password_hash, password).catch(() => false);
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = signToken({ id: demoUser.id, email: email.toLowerCase(), role: demoUser.role });
      res.json({ success: true, token, user: { id: demoUser.id, email: email.toLowerCase(), name: demoUser.name, role: demoUser.role } });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, name, role')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

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
  } catch (err) {
    console.error('[AuthAPI] Login error:', err);
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

    if (!isSupabaseConfigured()) {
      // Dev fallback: just return success with a simulated token
      const fakeId = '00000000-0000-0000-0000-ffff' + Math.random().toString(16).slice(2, 12);
      const token = signToken({ id: fakeId, email: email.toLowerCase(), role });
      res.status(201).json({ success: true, token, user: { id: fakeId, email: email.toLowerCase(), name, role } });
      return;
    }

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

    const password_hash = await argon2.hash(password);

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

    if (error || !user) {
      console.error('[AuthAPI] Signup insert error:', error);
      res.status(500).json({ success: false, error: 'Failed to create account' });
      return;
    }

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
