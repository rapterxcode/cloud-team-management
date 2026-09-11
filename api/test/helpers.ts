import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/passwords.js';
import { resetLoginLimiter } from '../src/middleware.js';

const rawUrl = process.env.DATABASE_URL;
if (rawUrl && rawUrl.includes('/ctm') && !rawUrl.includes('/ctm_test')) {
  process.env.DATABASE_URL = rawUrl.replace(/\/ctm(\?|$)/, '/ctm_test$1');
}

export const prisma = new PrismaClient();

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, workspaces, workspace_members, access_logs, audit_logs, projects, tasks, knowledge_articles, knowledge_attachments, cloud_resources, project_documents, knowledge_categories, copilot_conversations CASCADE',
  );
  await prisma.workspace.create({
    data: {
      id: 'default-workspace-engineering',
      name: 'Cloud workspace',
      type: 'engineering',
      description: 'Core engineering & platform delivery workspace',
      color: 'purple',
      icon: 'Cloud',
    },
  });
  // Clear the session store too so tests are isolated (connect-pg-simple's
  // "session" table isn't a Prisma model). Guarded because it doesn't exist
  // until the first makeServer() creates it.
  await prisma.$executeRawUnsafe(
    `DO $$ BEGIN IF to_regclass('public.session') IS NOT NULL THEN EXECUTE 'TRUNCATE session'; END IF; END $$;`,
  );
  resetLoginLimiter(); // the limiter Map is process-global; clear it so test order can't leak attempts
}

export async function makeServer(opts: { askLLM?: import('../src/copilot/gemini.js').AskLLM } = {}) {
  const app = createApp(prisma, opts);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as { port: number };
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

export async function createUser(email: string, password: string, role = 'member', extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: { email, name: email.split('@')[0], role, passwordHash: await hashPassword(password), ...extra },
  });
}

export async function login(base: string, email: string, password: string) {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  // Use getSetCookie(), not get('set-cookie'): undici's get() can return null or
  // a comma-joined value for Set-Cookie, which silently breaks cookie reuse.
  const cookie = res.headers.getSetCookie()[0]?.split(';')[0] ?? '';
  return { status: res.status, cookie };
}

export function authed(cookie: string, method = 'GET', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
