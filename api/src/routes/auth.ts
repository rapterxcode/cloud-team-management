import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../passwords.js';
import { loginLimiter, requireAuth } from '../middleware.js';

export function authRoutes(prisma: PrismaClient) {
  const r = Router();

  r.post('/login', loginLimiter, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash)))
      return res.status(401).json({ error: 'Incorrect email or password' });
    req.session.userId = user.id;
    // Persist the session before responding so an immediately-following request
    // (e.g. logout) reliably sees it — otherwise the store write can land after
    // the next request has already read an empty session.
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Could not start session' });
      res.json({ id: user.id, name: user.name, role: user.role });
    });
  });

  r.post('/logout', (req, res) => {
    req.session.destroy(() => res.status(204).end());
  });

  r.get('/me', requireAuth, async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.session.userId! } });
    if (!u || !u.isActive) return res.status(401).json({ error: 'Sign in required' });
    res.json({ id: u.id, email: u.email, name: u.name, title: u.title, role: u.role, workload: u.workload });
  });

  return r;
}
