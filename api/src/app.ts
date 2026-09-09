import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import type { PrismaClient } from '@prisma/client';
import { originCheck } from './middleware.js';

// One shared pool for the whole process. createApp() is called once per test
// server, so a per-call `new pg.Pool` would leak connections and exhaust
// Postgres across a ~20-case suite.
let sessionPool: pg.Pool | undefined;
function getSessionPool() {
  if (!sessionPool) sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return sessionPool;
}

export function createApp(prisma: PrismaClient) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use(originCheck);

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        pool: getSessionPool(),
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET ?? 'dev-secret',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Routes are mounted here by later tasks:
  // app.use('/api/auth', authRoutes(prisma)); ...

  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message || 'Server error' });
  });
  return app;
}
