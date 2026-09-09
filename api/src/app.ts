import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import type { PrismaClient } from '@prisma/client';
import { originCheck } from './middleware.js';
import { authRoutes } from './routes/auth.js';
import { usersRoutes } from './routes/users.js';
import { projectsRoutes } from './routes/projects.js';
import { tasksRoutes } from './routes/tasks.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { attachmentUploadRoutes, attachmentsRoutes } from './routes/attachments.js';
import { resourcesRoutes } from './routes/resources.js';

// One shared pool for the whole process. createApp() is called once per test
// server, so a per-call `new pg.Pool` would leak connections and exhaust
// Postgres across a ~20-case suite.
let sessionPool: pg.Pool | undefined;
function getSessionPool() {
  if (!sessionPool)
    sessionPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Let idle clients release the event loop so short-lived test processes exit.
      allowExitOnIdle: process.env.NODE_ENV === 'test',
    });
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
        // The prune-interval timer keeps the event loop alive once a session is
        // written, which hangs short-lived test processes. Disable it under test;
        // in prod the process runs forever so the timer is harmless.
        ...(process.env.NODE_ENV === 'test' ? { pruneSessionInterval: false } : {}),
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

  app.use('/api/auth', authRoutes(prisma));
  app.use('/api/users', usersRoutes(prisma));
  app.use('/api/projects', projectsRoutes(prisma));
  app.use('/api/tasks', tasksRoutes(prisma));
  app.use('/api/knowledge', attachmentUploadRoutes(prisma));
  app.use('/api/knowledge', knowledgeRoutes(prisma));
  app.use('/api/attachments', attachmentsRoutes(prisma));
  app.use('/api/resources', resourcesRoutes(prisma));
  // More routes mounted by later tasks.

  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message || 'Server error' });
  });
  return app;
}
