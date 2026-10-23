import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { config, envConfig } from './config.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: 'Sign in required' });
  next();
}

export function requireAuditorReadOnly(req: Request, res: Response, next: NextFunction) {
  if (req.session.role === 'auditor' && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ error: 'Auditor role has read-only access' });
  }
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

// CSRF + CORS: SameSite=Lax cookie + allow configured ALLOWED_ORIGINS or matching Host.
export function originCheck(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = config.app.allowedOrigins;
  const isExplicitlyAllowed = Boolean(origin && allowedOrigins.includes(origin));

  if (origin && isExplicitlyAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host && !isExplicitlyAllowed)
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
  const maxAttempts = envConfig.loginRateLimitMax;
  const windowMinutes = envConfig.loginRateLimitWindowMinutes;
  const slot = attempts.get(key);
  if (slot && slot.resetAt > now && slot.count >= maxAttempts)
    return res.status(429).json({ error: `Too many attempts. Try again in ${windowMinutes} minutes.` });
  if (!slot || slot.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + windowMinutes * 60_000 });
  else slot.count += 1;
  next();
}

// Tests call this from resetDb() so the process-global Map can't leak attempts across cases.
export function resetLoginLimiter() {
  attempts.clear();
}
