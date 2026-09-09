import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: 'Sign in required' });
  next();
}

export function requireAdmin(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId ?? '' } });
    if (!user || user.role !== 'admin' || !user.isActive)
      return res.status(403).json({ error: 'Admin access required' });
    next();
  };
}

// CSRF: SameSite=Lax cookie + block mutations whose Origin doesn't match Host.
export function originCheck(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host)
          return res.status(403).json({ error: 'Cross-origin request blocked' });
      } catch {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }
  }
  next();
}

const attempts = new Map<string, { count: number; resetAt: number }>();
export function loginLimiter(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`;
  const now = Date.now();
  const slot = attempts.get(key);
  if (slot && slot.resetAt > now && slot.count >= 10)
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!slot || slot.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  else slot.count += 1;
  next();
}

// Tests call this from resetDb() so the process-global Map can't leak attempts across cases.
export function resetLoginLimiter() {
  attempts.clear();
}
