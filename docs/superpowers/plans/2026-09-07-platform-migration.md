# Platform Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-platform Cloud Team Management from Vinext/Cloudflare Workers to a self-hosted Docker stack: React SPA (served by Caddy) + Express/Prisma API + PostgreSQL, with login, durable data, KM attachments, and nightly backups.

**Architecture:** Monorepo with `web/` (Vite + React 19 + TS + Tailwind v4 SPA) and `api/` (Express 5 + Prisma + Postgres, cookie sessions). Caddy is the only exposed container; it serves the built SPA and proxies `/api/*`. Spec: `docs/superpowers/specs/2026-09-07-platform-migration-design.md`.

**Tech Stack:** Node 22, TypeScript 5.9, Vite, React 19, Tailwind 4, Express 5, Prisma 6, express-session + connect-pg-simple, multer, postgres:17, Caddy 2, node:test.

## Global Constraints

- Node >= 22.13.0. `"type": "module"` in both packages.
- Tests: `node:test` via `tsx --test` (api) and `node --test` (web lib). No Jest/Vitest/supertest. HTTP tests use built-in `fetch`.
- Passwords: `node:crypto` scrypt. NO argon2/bcrypt dependency.
- Error shape everywhere: `{ "error": string }` with proper status (400/401/403/404/413/429).
- Enums validated server-side, exact strings: project status `On track|At risk`; task phase `Planning|Development|Launch`; task status `To do|In progress|Done`; task priority `High|Medium|Low`; knowledge category `Guides|Runbooks|Onboarding|Meeting notes`; role `admin|member`.
- Date validation messages must match `lib/gantt.mjs` verbatim: `Enter a valid date.` / `Enter both a start and finish date, or leave both empty.` / `Finish must be on or after start.`
- Uploads: extensions `.pdf .doc .docx .xls .xlsx .ppt .pptx .png .jpg .jpeg .txt`, max 25 MB, stored under random UUID names in `ATTACHMENTS_DIR`.
- Session cookie: httpOnly, SameSite=Lax, rolling, 30-day maxAge, secure in production.
- Users are deactivated (`isActive=false`), never deleted. Task `ownerId` FK is required.
- Preserve demo quirks: task priority defaults `Medium` (no picker), project color defaults `purple` (no picker).
- **API tests need Postgres.** Before any api test run (Tasks 2–10), have this running and exported:
  ```bash
  docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17
  export DATABASE_URL=postgresql://postgres:test@localhost:5433/ctm_test
  ```
  After schema changes: `cd api && npx prisma migrate dev`. All `tsx --test` commands run from `api/`.
- Commit after every task. The pre-existing app source (`app/`, `components/`, `lib/`, `hooks/`) is currently untracked in git — Task 1 moves it with `mv` then `git add`s the new locations.

## File Structure (end state)

```
web/                      # SPA package
  package.json  vite.config.ts  tsconfig.json  index.html
  src/main.tsx            # entry (new)
  src/App.tsx             # ported app/page.tsx
  src/project-gantt.tsx   # moved, + delete button
  src/login.tsx           # new login screen
  src/admin.tsx           # new admin user panel
  src/attachments.tsx     # new article-attachments widget
  src/globals.css         # moved app/globals.css + font vars
  src/lib/                # workspace.mjs, gantt.mjs (+tests), utils.ts, api.ts (new), types.ts (new)
  src/components/ui/      # moved components/ui (vendored, unchanged)
  src/hooks/use-mobile.ts # moved
api/                      # API package
  package.json  tsconfig.json  Dockerfile
  prisma/schema.prisma  prisma/seed.ts  prisma/migrations/
  src/index.ts            # listen entry
  src/app.ts              # createApp(prisma)
  src/passwords.ts        # scrypt hash/verify
  src/middleware.ts       # requireAuth, requireAdmin, originCheck, loginLimiter
  src/validate.ts         # enum + date validation (gantt messages)
  src/routes/auth.ts users.ts projects.ts tasks.ts knowledge.ts attachments.ts resources.ts
  test/helpers.ts + one test file per route group
caddy/Caddyfile  caddy/Dockerfile   # multi-stage: build web -> caddy image
backup/backup.sh
compose.yml  .env.example  docs/DEPLOY.md
```

---

### Task 1: Web package scaffold + source move

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`
- Move: `app/page.tsx→web/src/App.tsx`, `app/project-gantt.tsx→web/src/project-gantt.tsx`, `app/globals.css→web/src/globals.css`, `components/ui→web/src/components/ui`, `hooks→web/src/hooks`, `lib/*→web/src/lib/`
- Modify: `web/src/App.tsx` (imports only), `web/src/globals.css` (font vars), `.gitignore`

**Interfaces:**
- Produces: a `web/` package where `npm run build` and `npm test` pass; `@/` alias → `web/src/`. App still uses in-memory demo state (API wiring comes in Tasks 11–12).

- [ ] **Step 1: Create package files**

`web/package.json`:
```json
{
  "name": "ctm-web",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "test": "node --test src/lib/*.test.mjs"
  },
  "dependencies": {
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "@base-ui/react": "1.7.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "cmdk": "1.1.1",
    "date-fns": "4.1.0",
    "embla-carousel-react": "8.5.2",
    "input-otp": "1.4.2",
    "lucide-react": "1.31.0",
    "react-day-picker": "9.8.1",
    "react-resizable-panels": "4.5.8",
    "recharts": "3.8.0",
    "shadcn": "4.18.0",
    "tailwind-merge": "3.6.0",
    "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.2.1",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.2",
    "tailwindcss": "4.2.1",
    "typescript": "5.9.3",
    "vite": "8.0.13"
  }
}
```

`web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
```

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cloud Team Management</title>
    <meta name="description" content="Your connected workspace for cloud teams, projects, tasks and infrastructure." />
    <link rel="icon" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import './globals.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 2: Move sources**

```bash
mkdir -p web/src/lib web/src/components web/src/hooks web/public
mv app/page.tsx web/src/App.tsx
mv app/project-gantt.tsx web/src/project-gantt.tsx
mv app/globals.css web/src/globals.css
mv components/ui web/src/components/ui
mv hooks/use-mobile.ts web/src/hooks/use-mobile.ts
mv lib/workspace.mjs lib/workspace.test.mjs lib/gantt.mjs lib/gantt.test.mjs lib/utils.ts web/src/lib/
mv public/favicon.svg web/public/favicon.svg
rmdir app components hooks lib public 2>/dev/null || true
```

- [ ] **Step 3: Fix App.tsx for Vite**

In `web/src/App.tsx`: delete the `'use client';` first line. Change `import ProjectGantt from './project-gantt';` — path is unchanged (same dir), keep it. All `@/components/ui/...`, `@/lib/...` imports resolve via the new alias — unchanged. In `web/src/project-gantt.tsx` delete its `'use client';` line too.

The old `app/layout.tsx` is NOT ported (delete it: `rm app/layout.tsx 2>/dev/null; rmdir app 2>/dev/null || true`). Its two jobs move: metadata → `index.html` (done in Step 1), fonts → CSS. Append to the END of `web/src/globals.css`:

```css
:root{--font-geist-sans:'Geist',system-ui,sans-serif;--font-geist-mono:'Geist Mono',ui-monospace,monospace}
```

- [ ] **Step 4: Verify tests and build pass**

```bash
cd web && npm install && npm test && npm run build
```
Expected: 9/9 lib tests pass; `vite build` completes with a `dist/` folder. If `tsc` flags pre-existing issues inside `src/components/ui` (vendored), add `"exclude": ["src/components/ui"]`… do NOT — instead keep `skipLibCheck` and fix only import-path errors; vendored components must compile as they did before (they were part of the same tsconfig previously).

- [ ] **Step 5: Update .gitignore and commit**

Replace line `/node_modules` in `.gitignore` with `node_modules/` and add lines `dist/`, `web/dist/`. Then:
```bash
git add web/ .gitignore
git commit -m "refactor: move SPA into web/ package on plain Vite (drop Vinext)"
```

---

### Task 2: API scaffold — Prisma schema, createApp, health endpoint

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/prisma/schema.prisma`, `api/src/app.ts`, `api/src/index.ts`, `api/test/helpers.ts`, `api/test/health.test.ts`

**Interfaces:**
- Produces: `createApp(prisma: PrismaClient): express.Express` from `src/app.ts`; test helpers `makeServer()`, `resetDb()`, `createUser(email, password, role?)`, `login(base, email, password)` from `test/helpers.ts`; Prisma models `User, Project, Task, KnowledgeArticle, KnowledgeAttachment, CloudResource`.

- [ ] **Step 1: Package + tsconfig**

`api/package.json`:
```json
{
  "name": "ctm-api",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13.0" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "tsx --test test/*.test.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "@prisma/client": "^6.16.0",
    "connect-pg-simple": "^10.0.0",
    "express": "^5.1.0",
    "express-session": "^1.18.2",
    "multer": "^2.0.2",
    "pg": "^8.16.0"
  },
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/multer": "^2.0.0",
    "@types/node": "^22.19.0",
    "@types/pg": "^8.15.0",
    "prisma": "^6.16.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.3"
  }
}
```

`api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src", "prisma/seed.ts"]
}
```
Imports between api files use `.js` extensions (NodeNext style): `import { createApp } from '../src/app.js'`.

- [ ] **Step 2: Prisma schema**

`api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String                @id @default(uuid())
  email        String                @unique
  passwordHash String                @map("password_hash")
  name         String
  title        String                @default("")
  role         String                @default("member")
  isActive     Boolean               @default(true) @map("is_active")
  workload     Int                   @default(0)
  createdAt    DateTime              @default(now()) @map("created_at")
  tasks        Task[]
  articles     KnowledgeArticle[]
  uploads      KnowledgeAttachment[]

  @@map("users")
}

model Project {
  id          String   @id @default(uuid())
  name        String
  description String   @default("")
  status      String   @default("On track")
  progress    Int      @default(0)
  department  String   @default("Platform")
  due         String   @default("Not set")
  color       String   @default("purple")
  createdAt   DateTime @default(now()) @map("created_at")
  tasks       Task[]

  @@map("projects")
}

model Task {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  ownerId   String   @map("owner_id")
  owner     User     @relation(fields: [ownerId], references: [id])
  phase     String   @default("Planning")
  status    String   @default("To do")
  priority  String   @default("Medium")
  start     String   @default("")
  date      String   @default("")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("tasks")
}

model KnowledgeArticle {
  id          String                @id @default(uuid())
  name        String
  category    String
  body        String
  authorId    String                @map("author_id")
  author      User                  @relation(fields: [authorId], references: [id])
  createdAt   DateTime              @default(now()) @map("created_at")
  updatedAt   DateTime              @updatedAt @map("updated_at")
  attachments KnowledgeAttachment[]

  @@map("knowledge_articles")
}

model KnowledgeAttachment {
  id           String           @id @default(uuid())
  articleId    String           @map("article_id")
  article      KnowledgeArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)
  storedName   String           @unique @map("stored_name")
  originalName String           @map("original_name")
  mimeType     String           @map("mime_type")
  sizeBytes    Int              @map("size_bytes")
  uploadedById String           @map("uploaded_by")
  uploadedBy   User             @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime         @default(now()) @map("created_at")

  @@map("knowledge_attachments")
}

model CloudResource {
  id          String @id @default(uuid())
  name        String
  provider    String
  type        String
  status      String @default("Healthy")
  monthlyCost Int    @default(0) @map("monthly_cost")

  @@map("cloud_resources")
}
```

Run: `cd api && npm install && npx prisma migrate dev --name init` (needs the test Postgres from Global Constraints). Expected: migration created and applied.

- [ ] **Step 3: Write failing health test + helpers**

`api/test/helpers.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/passwords.js';

export const prisma = new PrismaClient();

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, projects, tasks, knowledge_articles, knowledge_attachments, cloud_resources CASCADE',
  );
}

export async function makeServer() {
  const app = createApp(prisma);
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
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  return { status: res.status, cookie };
}

export function authed(cookie: string, method = 'GET', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
```
(`passwords.js` doesn't exist yet — created in Task 3; for this task, temporarily comment its import and the `createUser` body, or just create `src/passwords.ts` now as part of Task 3 ordering. Simplest: leave helpers as written and implement passwords in Task 3 — this task's test only touches `/api/health`, so create a stub `api/src/passwords.ts` now: `export async function hashPassword(p: string){ return 'stub:' + p; }` — Task 3 replaces it test-first.)

`api/test/health.test.ts`:
```ts
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, prisma } from './helpers.js';

after(() => prisma.$disconnect());

test('GET /api/health returns ok without auth', async () => {
  const { base, close } = await makeServer();
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  await close();
});
```

Run: `npm test` → Expected: FAIL (`Cannot find module '../src/app.js'`).

- [ ] **Step 4: Implement app.ts + index.ts, test passes**

`api/src/app.ts`:
```ts
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import type { PrismaClient } from '@prisma/client';

export function createApp(prisma: PrismaClient) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
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
```

`api/src/index.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';

const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 3000);
createApp(prisma).listen(port, () => console.log(`api listening on :${port}`));
```

Run: `npm test` → Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add api/
git commit -m "feat(api): scaffold Express+Prisma package with schema and health endpoint"
```

---

### Task 3: Auth core — scrypt, login/logout/me, rate limit, origin check

**Files:**
- Create: `api/src/passwords.ts` (replace stub), `api/src/middleware.ts`, `api/src/routes/auth.ts`, `api/test/auth.test.ts`
- Modify: `api/src/app.ts` (mount routes + origin check)

**Interfaces:**
- Produces: `hashPassword(pw): Promise<string>`, `verifyPassword(pw, stored): Promise<boolean>`; middleware `requireAuth`, `requireAdmin(prisma)`, `originCheck`, `loginLimiter`; routes `POST /api/auth/login {email,password}` → `{id,name,role}`, `POST /api/auth/logout` → 204, `GET /api/auth/me` → user JSON `{id,email,name,title,role,workload}` or 401. Session field: `req.session.userId`.

- [ ] **Step 1: Write failing tests**

`api/test/auth.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('login with valid credentials sets a session cookie; /me returns the user', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  const { status, cookie } = await login(base, 'alex@team.test', 'secret123');
  assert.equal(status, 200);
  assert.ok(cookie.length > 0);
  const me = await fetch(base + '/api/auth/me', authed(cookie));
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.email, 'alex@team.test');
  assert.equal(body.passwordHash, undefined);
  await close();
});

test('wrong password and unknown email both return 401', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  assert.equal((await login(base, 'alex@team.test', 'wrong')).status, 401);
  assert.equal((await login(base, 'ghost@team.test', 'secret123')).status, 401);
  await close();
});

test('deactivated user cannot log in', async () => {
  const { base, close } = await makeServer();
  await createUser('gone@team.test', 'secret123', 'member', { isActive: false });
  assert.equal((await login(base, 'gone@team.test', 'secret123')).status, 401);
  await close();
});

test('logout destroys the session', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  const { cookie } = await login(base, 'alex@team.test', 'secret123');
  await fetch(base + '/api/auth/logout', authed(cookie, 'POST'));
  assert.equal((await fetch(base + '/api/auth/me', authed(cookie))).status, 401);
  await close();
});

test('cross-origin mutation is blocked (CSRF origin check)', async () => {
  const { base, close } = await makeServer();
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
  });
  assert.equal(res.status, 403);
  await close();
});

test('login is rate limited after 10 attempts', async () => {
  const { base, close } = await makeServer();
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await login(base, 'brute@team.test', 'nope')).status;
  assert.equal(last, 429);
  await close();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test` → Expected: FAIL (auth routes 404, stub hash).

- [ ] **Step 3: Implement**

`api/src/passwords.ts` (replaces stub):
```ts
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
```

`api/src/middleware.ts`:
```ts
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
```

`api/src/routes/auth.ts`:
```ts
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
    res.json({ id: user.id, name: user.name, role: user.role });
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
```

In `api/src/app.ts`, after `app.use(express.json(...))` add `app.use(originCheck);` and after the health route add `app.use('/api/auth', authRoutes(prisma));` with imports `import { originCheck } from './middleware.js';` and `import { authRoutes } from './routes/auth.js';`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test` → Expected: all auth tests + health PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): session auth with scrypt, login rate limit, and CSRF origin check"
```

---

### Task 4: Seed script

**Files:**
- Create: `api/prisma/seed.ts`, `api/test/seed.test.ts`

**Interfaces:**
- Produces: `seed(prisma): Promise<void>` exported from `prisma/seed.ts` (also runnable as a script). Demo users seeded **deactivated**; admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env; idempotent (safe to run on every boot).

- [ ] **Step 1: Write failing test**

`api/test/seed.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, login, prisma } from './helpers.js';
import { seed } from '../prisma/seed.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('seed creates deactivated demo users, demo data, and an env admin; runs twice safely', async () => {
  process.env.ADMIN_EMAIL = 'boss@team.test';
  process.env.ADMIN_PASSWORD = 'boss-secret-1';
  await seed(prisma);
  await seed(prisma); // idempotent

  const demo = await prisma.user.findMany({ where: { email: { endsWith: '@demo.local' } } });
  assert.equal(demo.length, 4);
  assert.ok(demo.every((u) => !u.isActive));
  assert.equal(await prisma.project.count(), 3);
  assert.equal(await prisma.task.count(), 4);
  assert.equal(await prisma.knowledgeArticle.count(), 4);
  assert.equal(await prisma.cloudResource.count(), 4);
  assert.equal(await prisma.user.count({ where: { role: 'admin', isActive: true } }), 1);

  const { base, close } = await makeServer();
  assert.equal((await login(base, 'boss@team.test', 'boss-secret-1')).status, 200);
  assert.equal((await login(base, 'alex.morgan@demo.local', 'anything')).status, 401);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (no seed module).

- [ ] **Step 3: Implement `api/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/passwords.js';

const DEMO_USERS = [
  { email: 'alex.morgan@demo.local', name: 'Alex Morgan', title: 'Platform Lead', workload: 78 },
  { email: 'sarah.chen@demo.local', name: 'Sarah Chen', title: 'Cloud Engineer', workload: 64 },
  { email: 'james.wilson@demo.local', name: 'James Wilson', title: 'DevOps Engineer', workload: 91 },
  { email: 'priya.patel@demo.local', name: 'Priya Patel', title: 'SRE', workload: 56 },
];

export async function seed(prisma: PrismaClient) {
  const users: Record<string, string> = {};
  for (const d of DEMO_USERS) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: { ...d, isActive: false, role: 'member', passwordHash: await hashPassword(crypto.randomUUID()) },
    });
    users[d.name] = u.id;
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true } });
  if (activeAdmins === 0 && adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'admin', isActive: true },
      create: { email: adminEmail, name: 'Administrator', role: 'admin', passwordHash: await hashPassword(adminPassword) },
    });
  }

  if ((await prisma.project.count()) === 0) {
    const projects = [
      { name: 'Cloud infrastructure migration', description: 'A stronger foundation for what’s next.', status: 'On track', progress: 72, department: 'Platform', due: 'Sep 18', color: 'purple' },
      { name: 'Developer experience', description: 'Making every deployment feel effortless.', status: 'On track', progress: 48, department: 'Engineering', due: 'Sep 24', color: 'blue' },
      { name: 'Observability rollout', description: 'Clarity across every service and signal.', status: 'At risk', progress: 35, department: 'DevOps', due: 'Sep 12', color: 'orange' },
    ];
    const ids: string[] = [];
    for (const p of projects) ids.push((await prisma.project.create({ data: p })).id);
    await prisma.task.createMany({
      data: [
        { projectId: ids[0], start: '2026-09-01', phase: 'Planning', date: '2026-09-07', name: 'Review production deployment pipeline', status: 'In progress', priority: 'High', ownerId: users['Alex Morgan'] },
        { projectId: ids[0], start: '2026-09-08', phase: 'Development', date: '2026-09-12', name: 'Configure staging environment', status: 'To do', priority: 'Medium', ownerId: users['Sarah Chen'] },
        { projectId: ids[1], start: '2026-09-03', phase: 'Development', date: '2026-09-10', name: 'Update infrastructure documentation', status: 'In progress', priority: 'Medium', ownerId: users['James Wilson'] },
        { projectId: ids[2], start: '2026-09-05', phase: 'Planning', date: '2026-09-12', name: 'Audit unused cloud resources', status: 'To do', priority: 'High', ownerId: users['Priya Patel'] },
      ],
    });
  }

  if ((await prisma.knowledgeArticle.count()) === 0) {
    await prisma.knowledgeArticle.createMany({
      data: [
        { name: 'Production deployment checklist', category: 'Runbooks', authorId: users['Alex Morgan'], body: 'Before you deploy\n\n1. Confirm the change has passed review and automated checks.\n2. Check the service dashboard and active incidents.\n3. Record the previous release and rollback procedure.\n4. Deploy to staging and verify the critical user journeys.\n5. Schedule the production change with the on-call engineer.\n\nAfter deployment\n\nWatch error rates and latency. Record the result and hand over any follow-up work.' },
        { name: 'Welcome to the cloud team', category: 'Onboarding', authorId: users['Sarah Chen'], body: 'Your first week\n\nMeet your buddy and review the team directory. Get familiar with our active projects, weekly priorities and service ownership.\n\nStart with a small task, review the relevant runbook and ask your buddy to walk you through the deployment workflow.\n\nKeep useful discoveries here so the next person can find them.' },
        { name: 'Cloud resource naming convention', category: 'Guides', authorId: users['James Wilson'], body: 'Use a consistent name for each resource:\n\nteam-service-environment-region\n\nExample: platform-api-staging-us-east\n\nInclude an owner, environment and project tag. Keep descriptions clear and avoid storing credentials in names or tags.' },
        { name: 'Weekly platform review · September 7', category: 'Meeting notes', authorId: users['Priya Patel'], body: 'Focus this week\n\n• Complete the staging environment setup.\n• Review the migration readiness checklist.\n• Identify unused resources for the next cost review.\n\nDecisions\n\nThe team will document deployment checks in the shared knowledge base. Each project owner will keep task dates up to date.' },
      ],
    });
  }

  if ((await prisma.cloudResource.count()) === 0) {
    await prisma.cloudResource.createMany({
      data: [
        { name: 'production-api', provider: 'AWS', type: 'Compute', status: 'Healthy', monthlyCost: 842 },
        { name: 'analytics-cluster', provider: 'Google Cloud', type: 'Database', status: 'Healthy', monthlyCost: 628 },
        { name: 'staging-services', provider: 'AWS', type: 'Compute', status: 'Healthy', monthlyCost: 316 },
        { name: 'asset-storage', provider: 'Azure', type: 'Storage', status: 'Review needed', monthlyCost: 214 },
      ],
    });
  }
}

const isDirectRun = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit** — `git add api/prisma api/test && git commit -m "feat(api): idempotent seed with env admin and deactivated demo users"`

---

### Task 5: Users routes (roster + admin management)

**Files:**
- Create: `api/src/routes/users.ts`, `api/test/users.test.ts`
- Modify: `api/src/app.ts` (mount)

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin(prisma)`, `hashPassword`.
- Produces: `GET /api/users` (any session) → `[{id,name,title,role,isActive,workload}]` ordered by createdAt; `POST /api/users` (admin) `{email,name,password,title?,role?,workload?}` → 201 user; `PATCH /api/users/:id` (admin) accepts `{name?,title?,role?,isActive?,workload?,password?}` → user. Route mount: `app.use('/api/users', usersRoutes(prisma));`.

- [ ] **Step 1: Write failing tests**

`api/test/users.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('anonymous requests are rejected; members can read roster but not create users', async () => {
  const { base, close } = await makeServer();
  await createUser('member@team.test', 'pw123456');
  assert.equal((await fetch(base + '/api/users')).status, 401);
  const { cookie } = await login(base, 'member@team.test', 'pw123456');
  const list = await fetch(base + '/api/users', authed(cookie));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).length, 1);
  const create = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'x@y.z', name: 'X', password: 'pw123456' }));
  assert.equal(create.status, 403);
  await close();
});

test('admin creates a user, resets password, deactivates', async () => {
  const { base, close } = await makeServer();
  await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');

  const created = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'new@team.test', name: 'New Person', password: 'first-pass-1', title: 'SRE' }));
  assert.equal(created.status, 201);
  const newUser = await created.json();
  assert.equal((await login(base, 'new@team.test', 'first-pass-1')).status, 200);

  await fetch(base + `/api/users/${newUser.id}`, authed(cookie, 'PATCH', { password: 'second-pass-2' }));
  assert.equal((await login(base, 'new@team.test', 'first-pass-1')).status, 401);
  assert.equal((await login(base, 'new@team.test', 'second-pass-2')).status, 200);

  await fetch(base + `/api/users/${newUser.id}`, authed(cookie, 'PATCH', { isActive: false }));
  assert.equal((await login(base, 'new@team.test', 'second-pass-2')).status, 401);
  await close();
});

test('duplicate email returns 400 with error body', async () => {
  const { base, close } = await makeServer();
  await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');
  const dup = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'admin@team.test', name: 'Dup', password: 'pw123456' }));
  assert.equal(dup.status, 400);
  assert.ok((await dup.json()).error);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (404s).

- [ ] **Step 3: Implement `api/src/routes/users.ts`**

```ts
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAdmin, requireAuth } from '../middleware.js';
import { hashPassword } from '../passwords.js';

const PUBLIC_FIELDS = { id: true, name: true, title: true, role: true, isActive: true, workload: true };

export function usersRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', requireAdmin(prisma), async (req, res) => {
    const { email, name, password, title = '', role = 'member', workload = 0 } = req.body ?? {};
    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name and password are required' });
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
    if (await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } }))
      return res.status(400).json({ error: 'A user with this email already exists' });
    const u = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        name: String(name).trim(),
        title: String(title),
        role,
        workload: Number(workload) || 0,
        passwordHash: await hashPassword(String(password)),
      },
      select: PUBLIC_FIELDS,
    });
    res.status(201).json(u);
  });

  r.patch('/:id', requireAdmin(prisma), async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const { name, title, role, isActive, workload, password } = req.body ?? {};
    if (role !== undefined && !['admin', 'member'].includes(role))
      return res.status(400).json({ error: 'Role must be admin or member' });
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(workload !== undefined ? { workload: Number(workload) || 0 } : {}),
        ...(password !== undefined ? { passwordHash: await hashPassword(String(password)) } : {}),
      },
      select: PUBLIC_FIELDS,
    });
    res.json(u);
  });

  return r;
}
```
Mount in `app.ts` after auth: `app.use('/api/users', usersRoutes(prisma));` (import it).

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): user roster and admin user management"`

---

### Task 6: Validation helpers + Projects routes

**Files:**
- Create: `api/src/validate.ts`, `api/src/routes/projects.ts`, `api/test/projects.test.ts`
- Modify: `api/src/app.ts` (mount)

**Interfaces:**
- Produces: from `validate.ts` — `assertIn(value, list, label)` (throws `{status:400}` err), `validateDates(start, end)` (exact copy of web `lib/gantt.mjs` logic/messages, throws 400), `PHASES`, `TASK_STATUSES`, `PRIORITIES`, `PROJECT_STATUSES`, `CATEGORIES` constants. Routes: `GET /api/projects` → `Project[]`; `POST /api/projects {name, description?}` → 201 (defaults per schema); `PATCH /api/projects/:id {name?,description?,status?,progress?,department?,due?}`; `DELETE /api/projects/:id` → 204, cascades tasks.

- [ ] **Step 1: Write failing tests**

`api/test/projects.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function memberCookie(base: string) {
  await createUser('m@team.test', 'pw123456');
  return (await login(base, 'm@team.test', 'pw123456')).cookie;
}

test('member creates, edits, lists projects; blank name rejected', async () => {
  const { base, close } = await makeServer();
  const cookie = await memberCookie(base);

  const created = await fetch(base + '/api/projects', authed(cookie, 'POST', { name: '  Migration  ', description: 'd' }));
  assert.equal(created.status, 201);
  const p = await created.json();
  assert.equal(p.name, 'Migration'); // trimmed
  assert.equal(p.status, 'On track');
  assert.equal(p.color, 'purple'); // preserved default

  const blank = await fetch(base + '/api/projects', authed(cookie, 'POST', { name: '  ' }));
  assert.equal(blank.status, 400);
  assert.equal((await blank.json()).error, 'A name is required');

  const patched = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'PATCH', { status: 'At risk', progress: 40, department: 'DevOps' }));
  assert.equal((await patched.json()).status, 'At risk');

  const badStatus = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'PATCH', { status: 'Broken' }));
  assert.equal(badStatus.status, 400);

  const list = await fetch(base + '/api/projects', authed(cookie));
  assert.equal((await list.json()).length, 1);
  await close();
});

test('deleting a project cascades its tasks', async () => {
  const { base, close } = await makeServer();
  const cookie = await memberCookie(base);
  const owner = await prisma.user.findFirst();
  const p = await prisma.project.create({ data: { name: 'P' } });
  await prisma.task.create({ data: { projectId: p.id, name: 'T', ownerId: owner!.id } });
  const del = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'DELETE'));
  assert.equal(del.status, 204);
  assert.equal(await prisma.task.count(), 0);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement**

`api/src/validate.ts`:
```ts
export const PROJECT_STATUSES = ['On track', 'At risk'];
export const PHASES = ['Planning', 'Development', 'Launch'];
export const TASK_STATUSES = ['To do', 'In progress', 'Done'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const CATEGORIES = ['Guides', 'Runbooks', 'Onboarding', 'Meeting notes'];

export function badRequest(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

export function assertIn(value: unknown, list: string[], label: string) {
  if (!list.includes(String(value))) throw badRequest(`${label} must be one of: ${list.join(', ')}`);
}

// Mirrors web/src/lib/gantt.mjs exactly — messages must stay in sync.
const DAY = 86400000;
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('Enter a valid date.');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw badRequest('Enter a valid date.');
  return time / DAY;
}
export function validateDates(start: string, end: string) {
  if (!start && !end) return true;
  if (!start || !end) throw badRequest('Enter both a start and finish date, or leave both empty.');
  if (day(end) < day(start)) throw badRequest('Finish must be on or after start.');
  return true;
}
```

`api/src/routes/projects.ts`:
```ts
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PROJECT_STATUSES } from '../validate.js';

export function projectsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.project.findMany({ orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('A name is required');
      const p = await prisma.project.create({
        data: { name, description: String(req.body?.description ?? 'Ready to get started.') },
      });
      res.status(201).json(p);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Project not found' });
      const { name, description, status, progress, department, due } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (status !== undefined) assertIn(status, PROJECT_STATUSES, 'Status');
      if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100))
        throw badRequest('Progress must be a whole number from 0 to 100');
      const p = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description: String(description) } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(progress !== undefined ? { progress } : {}),
          ...(department !== undefined ? { department: String(department) } : {}),
          ...(due !== undefined ? { due: String(due) } : {}),
        },
      });
      res.json(p);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  return r;
}
```
Mount: `app.use('/api/projects', projectsRoutes(prisma));`.

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): projects CRUD with shared validation helpers"`

---

### Task 7: Tasks routes

**Files:**
- Create: `api/src/routes/tasks.ts`, `api/test/tasks.test.ts`
- Modify: `api/src/app.ts` (mount)

**Interfaces:**
- Consumes: `validateDates`, `assertIn`, `PHASES`, `TASK_STATUSES`, `PRIORITIES`.
- Produces: `GET /api/tasks` → tasks each including `owner: {id, name}`; `POST /api/tasks {projectId, name, ownerId, phase?, start?, date?}` → 201 (status `To do`, priority `Medium`); `PATCH /api/tasks/:id` partial incl. `status`; `DELETE /api/tasks/:id` → 204. Owner must be an **active** user on both POST and PATCH-with-ownerId.

- [ ] **Step 1: Write failing tests**

`api/test/tasks.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(base: string) {
  const member = await createUser('m@team.test', 'pw123456');
  const cookie = (await login(base, 'm@team.test', 'pw123456')).cookie;
  const project = await prisma.project.create({ data: { name: 'P' } });
  return { member, cookie, project };
}

test('creates task with defaults, completes it via PATCH', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const created = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'Ship it', ownerId: member.id, phase: 'Development', start: '2026-09-01', date: '2026-09-05',
  }));
  assert.equal(created.status, 201);
  const t = await created.json();
  assert.equal(t.priority, 'Medium'); // preserved silent default
  assert.equal(t.status, 'To do');
  assert.equal(t.owner.name, 'm');

  const done = await fetch(base + `/api/tasks/${t.id}`, authed(cookie, 'PATCH', { status: 'Done' }));
  assert.equal((await done.json()).status, 'Done');
  await close();
});

test('date validation matches gantt.mjs messages', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const reversed = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'X', ownerId: member.id, start: '2026-09-10', date: '2026-09-09',
  }));
  assert.equal(reversed.status, 400);
  assert.equal((await reversed.json()).error, 'Finish must be on or after start.');
  const half = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'X', ownerId: member.id, start: '2026-09-10', date: '',
  }));
  assert.equal((await half.json()).error, 'Enter both a start and finish date, or leave both empty.');
  await close();
});

test('owner must be an active user; deactivated owner keeps existing tasks', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const ghost = await createUser('ghost@team.test', 'pw123456', 'member', { isActive: false });
  const rejected = await fetch(base + '/api/tasks', authed(cookie, 'POST', { projectId: project.id, name: 'X', ownerId: ghost.id }));
  assert.equal(rejected.status, 400);

  const t = await prisma.task.create({ data: { projectId: project.id, name: 'Kept', ownerId: member.id } });
  await prisma.user.update({ where: { id: member.id }, data: { isActive: false } });
  assert.equal((await prisma.task.findUnique({ where: { id: t.id } }))?.ownerId, member.id);
  await close();
});

test('invalid phase/status rejected; delete works', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const bad = await fetch(base + '/api/tasks', authed(cookie, 'POST', { projectId: project.id, name: 'X', ownerId: member.id, phase: 'Testing' }));
  assert.equal(bad.status, 400);
  const t = await prisma.task.create({ data: { projectId: project.id, name: 'Del', ownerId: member.id } });
  assert.equal((await fetch(base + `/api/tasks/${t.id}`, authed(cookie, 'DELETE'))).status, 204);
  assert.equal(await prisma.task.count(), 0);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `api/src/routes/tasks.ts`**

```ts
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PHASES, PRIORITIES, TASK_STATUSES, validateDates } from '../validate.js';

const OWNER = { owner: { select: { id: true, name: true } } };

export function tasksRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  async function assertActiveOwner(ownerId: unknown) {
    const owner = await prisma.user.findUnique({ where: { id: String(ownerId ?? '') } });
    if (!owner || !owner.isActive) throw badRequest('Owner must be an active team member');
  }

  r.get('/', async (_req, res) => {
    res.json(await prisma.task.findMany({ include: OWNER, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const { projectId, name, ownerId, phase = 'Planning', start = '', date = '' } = req.body ?? {};
      const trimmed = String(name ?? '').trim();
      if (!trimmed) throw badRequest('A name is required');
      if (!(await prisma.project.findUnique({ where: { id: String(projectId ?? '') } })))
        throw badRequest('Choose a project');
      await assertActiveOwner(ownerId);
      assertIn(phase, PHASES, 'Phase');
      validateDates(String(start), String(date));
      const t = await prisma.task.create({
        data: { projectId, name: trimmed, ownerId, phase, start: String(start), date: String(date) },
        include: OWNER,
      });
      res.status(201).json(t);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Task not found' });
      const { name, ownerId, phase, status, priority, start, date } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (ownerId !== undefined) await assertActiveOwner(ownerId);
      if (phase !== undefined) assertIn(phase, PHASES, 'Phase');
      if (status !== undefined) assertIn(status, TASK_STATUSES, 'Status');
      if (priority !== undefined) assertIn(priority, PRIORITIES, 'Priority');
      const nextStart = start !== undefined ? String(start) : existing.start;
      const nextDate = date !== undefined ? String(date) : existing.date;
      validateDates(nextStart, nextDate);
      const t = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(ownerId !== undefined ? { ownerId } : {}),
          ...(phase !== undefined ? { phase } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(start !== undefined ? { start: nextStart } : {}),
          ...(date !== undefined ? { date: nextDate } : {}),
        },
        include: OWNER,
      });
      res.json(t);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  return r;
}
```
Mount: `app.use('/api/tasks', tasksRoutes(prisma));`.

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): tasks CRUD with owner FK and gantt-compatible date validation"`

---

### Task 8: Knowledge routes

**Files:**
- Create: `api/src/routes/knowledge.ts`, `api/test/knowledge.test.ts`
- Modify: `api/src/app.ts` (mount)

**Interfaces:**
- Produces: `GET /api/knowledge` → articles each with `author: {id,name}` and `attachments: [{id, originalName, sizeBytes}]`; `POST /api/knowledge {name, category, body}` → 201 (author = session user); `PATCH /api/knowledge/:id {name?,category?,body?}`; `DELETE /api/knowledge/:id` → 204 (attachment rows cascade; file unlink handled in Task 9's delete route — article delete also best-effort unlinks files, implemented here by reading attachment rows first).
- Consumes: `CATEGORIES`, `badRequest`, `assertIn`. Env `ATTACHMENTS_DIR` (default `./attachments-dev`).

- [ ] **Step 1: Write failing tests**

`api/test/knowledge.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('create/edit/list articles; author comes from session; category validated', async () => {
  const { base, close } = await makeServer();
  await createUser('writer@team.test', 'pw123456');
  const { cookie } = await login(base, 'writer@team.test', 'pw123456');

  const created = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'Guide', category: 'Guides', body: 'Steps' }));
  assert.equal(created.status, 201);
  const a = await created.json();
  assert.equal(a.author.name, 'writer');
  assert.deepEqual(a.attachments, []);

  const badCat = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'X', category: 'Random', body: 'b' }));
  assert.equal(badCat.status, 400);
  const emptyBody = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'X', category: 'Guides', body: '  ' }));
  assert.equal(emptyBody.status, 400);

  const patched = await fetch(base + `/api/knowledge/${a.id}`, authed(cookie, 'PATCH', { body: 'New body' }));
  assert.equal((await patched.json()).body, 'New body');

  const del = await fetch(base + `/api/knowledge/${a.id}`, authed(cookie, 'DELETE'));
  assert.equal(del.status, 204);
  assert.equal(await prisma.knowledgeArticle.count(), 0);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `api/src/routes/knowledge.ts`**

```ts
import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, CATEGORIES } from '../validate.js';

export const ATTACHMENTS_DIR = () => process.env.ATTACHMENTS_DIR ?? './attachments-dev';

const INCLUDE = {
  author: { select: { id: true, name: true } },
  attachments: { select: { id: true, originalName: true, sizeBytes: true } },
};

export function knowledgeRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.knowledgeArticle.findMany({ include: INCLUDE, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const body = String(req.body?.body ?? '').trim();
      if (!name) throw badRequest('A name is required');
      if (!body) throw badRequest('Content is required');
      assertIn(req.body?.category, CATEGORIES, 'Category');
      const a = await prisma.knowledgeArticle.create({
        data: { name, body, category: req.body.category, authorId: req.session.userId! },
        include: INCLUDE,
      });
      res.status(201).json(a);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.knowledgeArticle.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Article not found' });
      const { name, category, body } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (body !== undefined && !String(body).trim()) throw badRequest('Content is required');
      if (category !== undefined) assertIn(category, CATEGORIES, 'Category');
      const a = await prisma.knowledgeArticle.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(body !== undefined ? { body: String(body).trim() } : {}),
        },
        include: INCLUDE,
      });
      res.json(a);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { id: req.params.id },
      include: { attachments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    await prisma.knowledgeArticle.delete({ where: { id: req.params.id } }); // attachments cascade
    for (const att of existing.attachments) {
      await unlink(join(ATTACHMENTS_DIR(), att.storedName)).catch(() => {});
    }
    res.status(204).end();
  });

  return r;
}
```
Mount: `app.use('/api/knowledge', knowledgeRoutes(prisma));`.

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): knowledge article CRUD with session-derived author"`

---

### Task 9: Attachments — upload, download, delete

**Files:**
- Create: `api/src/routes/attachments.ts`, `api/test/attachments.test.ts`
- Modify: `api/src/app.ts` (mount two routers)

**Interfaces:**
- Consumes: `ATTACHMENTS_DIR()` from `knowledge.ts`.
- Produces: `POST /api/knowledge/:id/attachments` (multipart field `file`) → 201 `{id, originalName, sizeBytes}`; `GET /api/attachments/:id/download` → file with `Content-Disposition: attachment`; `DELETE /api/attachments/:id` → 204 + unlink. Export `attachmentUploadRoutes(prisma)` (mounted at `/api/knowledge`) and `attachmentsRoutes(prisma)` (mounted at `/api/attachments`).
- Allow-list: `.pdf .doc .docx .xls .xlsx .ppt .pptx .png .jpg .jpeg .txt`; limit 25 MB → 413 on breach; wrong type → 400.

- [ ] **Step 1: Write failing tests**

`api/test/attachments.test.ts`:
```ts
import { test, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer, resetDb, createUser, login, prisma } from './helpers.js';

before(async () => {
  process.env.ATTACHMENTS_DIR = await mkdtemp(join(tmpdir(), 'ctm-att-'));
});
beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(base: string) {
  const u = await createUser('w@team.test', 'pw123456');
  const cookie = (await login(base, 'w@team.test', 'pw123456')).cookie;
  const article = await prisma.knowledgeArticle.create({
    data: { name: 'A', category: 'Guides', body: 'b', authorId: u.id },
  });
  return { cookie, article };
}

function filePost(cookie: string, name: string, content: string, type = 'text/plain') {
  const form = new FormData();
  form.append('file', new File([content], name, { type }));
  return { method: 'POST', headers: { cookie }, body: form } as RequestInit;
}

test('upload txt, download it back with attachment disposition, then delete', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);

  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'notes.txt', 'hello world'));
  assert.equal(up.status, 201);
  const att = await up.json();
  assert.equal(att.originalName, 'notes.txt');

  const down = await fetch(base + `/api/attachments/${att.id}/download`, { headers: { cookie } });
  assert.equal(down.status, 200);
  assert.match(down.headers.get('content-disposition') ?? '', /^attachment/);
  assert.equal(await down.text(), 'hello world');

  const anon = await fetch(base + `/api/attachments/${att.id}/download`);
  assert.equal(anon.status, 401);

  assert.equal((await fetch(base + `/api/attachments/${att.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);
  assert.equal(await prisma.knowledgeAttachment.count(), 0);
  await close();
});

test('disallowed extension rejected with 400', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);
  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'evil.sh', 'echo hi'));
  assert.equal(up.status, 400);
  await close();
});

test('oversize file rejected with 413', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);
  const big = 'x'.repeat(26 * 1024 * 1024);
  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'big.txt', big));
  assert.equal(up.status, 413);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `api/src/routes/attachments.ts`**

```ts
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { ATTACHMENTS_DIR } from './knowledge.js';

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.txt']);
const MAX_BYTES = 25 * 1024 * 1024;

function makeUpload() {
  mkdirSync(ATTACHMENTS_DIR(), { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR()),
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_EXT.has(extname(file.originalname).toLowerCase()))
        return cb(Object.assign(new Error('This file type is not allowed'), { status: 400 }));
      cb(null, true);
    },
  });
}

export function attachmentUploadRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);
  const upload = makeUpload();

  r.post('/:id/attachments', (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status ?? 400);
        return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 25 MB' : err.message });
      }
      try {
        if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });
        const article = await prisma.knowledgeArticle.findUnique({ where: { id: req.params.id } });
        if (!article) {
          await unlink(req.file.path).catch(() => {});
          return res.status(404).json({ error: 'Article not found' });
        }
        const att = await prisma.knowledgeAttachment.create({
          data: {
            articleId: article.id,
            storedName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            uploadedById: req.session.userId!,
          },
          select: { id: true, originalName: true, sizeBytes: true },
        });
        res.status(201).json(att);
      } catch (e) { next(e); }
    });
  });

  return r;
}

export function attachmentsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/:id/download', async (req, res) => {
    const att = await prisma.knowledgeAttachment.findUnique({ where: { id: req.params.id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    const safeName = att.originalName.replace(/[^\w.\- ]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.sendFile(resolve(join(ATTACHMENTS_DIR(), att.storedName)));
  });

  r.delete('/:id', async (req, res) => {
    const att = await prisma.knowledgeAttachment.findUnique({ where: { id: req.params.id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    await prisma.knowledgeAttachment.delete({ where: { id: att.id } });
    await unlink(join(ATTACHMENTS_DIR(), att.storedName)).catch(() => {});
    res.status(204).end();
  });

  return r;
}
```
Mount in `app.ts` (order matters — upload router before `knowledgeRoutes` on the same prefix is fine since paths differ):
```ts
app.use('/api/knowledge', attachmentUploadRoutes(prisma));
app.use('/api/knowledge', knowledgeRoutes(prisma));
app.use('/api/attachments', attachmentsRoutes(prisma));
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): KM attachments with allow-list, size cap, and authed download"`

---

### Task 10: Cloud resources routes

**Files:**
- Create: `api/src/routes/resources.ts`, `api/test/resources.test.ts`
- Modify: `api/src/app.ts` (mount)

**Interfaces:**
- Produces: `GET /api/resources` → `CloudResource[]`; `POST /api/resources {name, provider, type, status?, monthlyCost?}` → 201; `PATCH /api/resources/:id` partial; `DELETE /api/resources/:id` → 204. `monthlyCost` must be an integer ≥ 0.

- [ ] **Step 1: Write failing tests**

`api/test/resources.test.ts`:
```ts
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('resource CRUD with monthly cost validation', async () => {
  const { base, close } = await makeServer();
  await createUser('m@team.test', 'pw123456');
  const { cookie } = await login(base, 'm@team.test', 'pw123456');

  const created = await fetch(base + '/api/resources', authed(cookie, 'POST', { name: 'prod-api', provider: 'AWS', type: 'Compute', monthlyCost: 842 }));
  assert.equal(created.status, 201);
  const rsc = await created.json();
  assert.equal(rsc.status, 'Healthy');

  const bad = await fetch(base + '/api/resources', authed(cookie, 'POST', { name: 'x', provider: 'AWS', type: 'Compute', monthlyCost: -5 }));
  assert.equal(bad.status, 400);

  const patched = await fetch(base + `/api/resources/${rsc.id}`, authed(cookie, 'PATCH', { monthlyCost: 900, status: 'Review needed' }));
  assert.equal((await patched.json()).monthlyCost, 900);

  assert.equal((await fetch(base + `/api/resources/${rsc.id}`, authed(cookie, 'DELETE'))).status, 204);
  assert.equal(await prisma.cloudResource.count(), 0);
  await close();
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `api/src/routes/resources.ts`**

```ts
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { badRequest } from '../validate.js';

function costOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw badRequest('Monthly cost must be a whole number of dollars (0 or more)');
  return n;
}

export function resourcesRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.cloudResource.findMany({ orderBy: { name: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const { name, provider, type, status = 'Healthy', monthlyCost = 0 } = req.body ?? {};
      if (!String(name ?? '').trim() || !String(provider ?? '').trim() || !String(type ?? '').trim())
        throw badRequest('Name, provider and type are required');
      const rsc = await prisma.cloudResource.create({
        data: { name: String(name).trim(), provider: String(provider).trim(), type: String(type).trim(), status: String(status), monthlyCost: costOf(monthlyCost) },
      });
      res.status(201).json(rsc);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.cloudResource.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Resource not found' });
      const { name, provider, type, status, monthlyCost } = req.body ?? {};
      const rsc = await prisma.cloudResource.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(provider !== undefined ? { provider: String(provider).trim() } : {}),
          ...(type !== undefined ? { type: String(type).trim() } : {}),
          ...(status !== undefined ? { status: String(status) } : {}),
          ...(monthlyCost !== undefined ? { monthlyCost: costOf(monthlyCost) } : {}),
        },
      });
      res.json(rsc);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.cloudResource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    await prisma.cloudResource.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  return r;
}
```
Mount: `app.use('/api/resources', resourcesRoutes(prisma));`.

- [ ] **Step 4: Run tests** — `npm test` → PASS (full api suite green).
- [ ] **Step 5: Commit** — `git add api/src api/test && git commit -m "feat(api): cloud resources CRUD with editable monthly cost"`

---

### Task 11: Web — API client, types, login gate

**Files:**
- Create: `web/src/lib/api.ts`, `web/src/lib/types.ts`, `web/src/login.tsx`
- Modify: `web/src/App.tsx` (state bootstrap + gate), `web/src/globals.css` (login styles)

**Interfaces:**
- Produces: `api<T>(path, options?)` JSON fetch helper throwing `Error(message)` on non-2xx; `uploadFile(path, file)` multipart helper; types `User, Project, Task, Article, Attachment, Resource, Me`; `<Login onLogin={(me: Me) => void} />`. In `App.tsx`: `me` state (`undefined`=loading, `null`=logged out), `loadAll()` fetching all collections, and derived `members` tuples so downstream JSX keeps working.

- [ ] **Step 1: Write `web/src/lib/types.ts`**

```ts
export type Me = { id: string; email: string; name: string; title: string; role: 'admin' | 'member'; workload: number };
export type User = { id: string; name: string; title: string; role: string; isActive: boolean; workload: number };
export type Project = { id: string; name: string; description: string; status: string; progress: number; department: string; due: string; color: string };
export type ApiTask = { id: string; projectId: string; name: string; ownerId: string; owner: { id: string; name: string }; phase: string; status: string; priority: string; start: string; date: string };
export type Task = ApiTask & { due: string; ownerName: string };
export type Attachment = { id: string; originalName: string; sizeBytes: number };
export type Article = { id: string; name: string; category: string; body: string; author: { id: string; name: string }; attachments: Attachment[] };
export type Resource = { id: string; name: string; provider: string; type: string; status: string; monthlyCost: number };

export const withDue = (t: ApiTask): Task => ({ ...t, due: t.date || 'Not set', ownerName: t.owner.name });
```

- [ ] **Step 2: Write `web/src/lib/api.ts`**

```ts
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const destroy = (path: string) => api<void>(path, { method: 'DELETE' });

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api' + path, { method: 'POST', credentials: 'same-origin', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}
```

- [ ] **Step 3: Write `web/src/login.tsx`**

```tsx
import { useState } from 'react';
import { Cloud } from 'lucide-react';
import { post } from '@/lib/api';
import type { Me } from '@/lib/types';

export default function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await post('/auth/login', { email: data.get('email'), password: data.get('password') });
      onLogin(await api<Me>('/auth/me'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card create-form" onSubmit={submit}>
        <div className="brand"><span className="brand-icon"><Cloud size={25} /></span> cloudteam<span className="brand-dot">.</span></div>
        <h1>Sign in</h1>
        <label>Email<input name="email" type="email" required autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
```
(also import `api` alongside `post` at the top: `import { api, post } from '@/lib/api';`)

Append login styles to the END of `web/src/globals.css`:
```css
.login-page{min-height:100vh;display:grid;place-items:center;background:var(--background)}.login-card{width:340px;background:var(--sidebar);border:1px solid var(--border);border-radius:var(--radius);padding:32px;display:flex;flex-direction:column;gap:14px}.login-card h1{font-size:22px}.login-card .brand{margin-bottom:6px}
.app-loading{min-height:100vh;display:grid;place-items:center;color:var(--muted-foreground)}
```

- [ ] **Step 4: Wire the gate into `web/src/App.tsx`**

At the top of the file add imports:
```tsx
import { api, post, patch, destroy } from '@/lib/api';
import { withDue, type Me, type User, type Project, type Task, type Article, type Resource } from '@/lib/types';
import Login from './login';
```

Delete the four seed constants `initialProjects`, `initialTasks`, `members`, `initialKnowledge` and the `resources` constant (`nav` stays). Replace the state declarations at the top of `Home()` — the line declaring `view/projects/tasks/query/filter/modal/detail/notice` and the `knowledge/article/editing` line — with:

```tsx
 const [me,setMe]=useState<Me|null|undefined>(undefined);
 const [users,setUsers]=useState<User[]>([]);
 const [view,setView]=useState('Overview'),[projects,setProjects]=useState<Project[]>([]),[tasks,setTasks]=useState<Task[]>([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[modal,setModal]=useState(''),[detail,setDetail]=useState<Project|null>(null),[notice,setNotice]=useState('');
 const [formError,setFormError]=useState('');
 const [knowledge,setKnowledge]=useState<Article[]>([]),[article,setArticle]=useState<Article|null>(null),[editing,setEditing]=useState<Article|null>(null);
 const [resourceRows,setResourceRows]=useState<Resource[]>([]);
 const loadAll=async()=>{const [p,t,k,r,u]=await Promise.all([api<Project[]>('/projects'),api<import('@/lib/types').ApiTask[]>('/tasks'),api<Article[]>('/knowledge'),api<Resource[]>('/resources'),api<User[]>('/users')]);setProjects(p);setTasks(t.map(withDue));setKnowledge(k);setResourceRows(r);setUsers(u);};
 useEffect(()=>{api<Me>('/auth/me').then(m=>{setMe(m);return loadAll();}).catch(()=>setMe(null));},[]);
 const members=users.map(u=>[u.name,u.title,u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),u.workload] as const);
 const activeUsers=users.filter(u=>u.isActive);
```
(keep the existing `formError` line if already present — no duplicate). The old `resources` tuple consumers are reworked in Task 13; until then add a compatibility line right below:
```tsx
 const resources=resourceRows.map(r=>[r.name,r.provider,r.type,r.status,'$'+r.monthlyCost] as const);
```

Immediately before the main `return <SidebarProvider>...` add:
```tsx
 if(me===undefined)return <div className="app-loading">Loading…</div>;
 if(me===null)return <Login onLogin={m=>{setMe(m);loadAll();}}/>;
```

In the `SidebarFooter` JSX (search for `<SidebarFooter>`), add inside it:
```tsx
<div className="workspace"><span className="workspace-icon">{me.name[0]}</span><div><strong>{me.name}</strong><small>{me.role}</small></div><button className="text-button" onClick={async()=>{await post('/auth/logout',{});setMe(null);}}>Log out</button></div>
```

- [ ] **Step 5: Verify + commit**

```bash
cd web && npm run build && npm test
```
Expected: build passes (app compiles against new types; runtime needs the API, dev-run comes later). Lib tests still 9/9.
```bash
git add web/src && git commit -m "feat(web): API client, session gate, and login screen"
```

---

### Task 12: Web — wire mutations to the API

**Files:**
- Modify: `web/src/App.tsx` (create/complete/edit handlers, owner select), `web/src/project-gantt.tsx` (async save, delete button)

**Interfaces:**
- Consumes: `post/patch/destroy`, `withDue`, `activeUsers` from Task 11.
- Produces: async handlers `createEntity`, `finishTask(id)`, `editTask(id, changes)`, `removeTask(id)`; ProjectGantt gains `onDelete?: (id: string) => void` prop.

- [ ] **Step 1: Replace the `create` handler in App.tsx**

Replace the whole `const create=(event...)=>{...}` block with:

```tsx
 const create=async(event:React.SyntheticEvent<HTMLFormElement>)=>{
 event.preventDefault();const data=new FormData(event.currentTarget);const name=(data.get('name') as string || '').trim();if(!name)return;
 try{
 if(modal==='project'){const p=await post<Project>('/projects',{name,description:(data.get('description') as string || 'Ready to get started.')});setProjects([...projects,p]);}
 else if(modal==='article'){
 const changes={name,category:data.get('category') as string,body:(data.get('body') as string).trim()};
 if(!changes.body)return;
 if(editing){const a=await patch<Article>(`/knowledge/${editing.id}`,changes);setKnowledge(knowledge.map(k=>k.id===a.id?a:k));}
 else {const a=await post<Article>('/knowledge',changes);setKnowledge([...knowledge,a]);}
 setEditing(null);
 }else {const t=await post<import('@/lib/types').ApiTask>('/tasks',{name,projectId:data.get('projectId') as string,ownerId:data.get('ownerId') as string,phase:data.get('phase') as string,start:data.get('start') as string,date:data.get('date') as string});setTasks([...tasks,withDue(t)]);}
 setNotice(`${modal==='article'?'Knowledge article':modal==='project'?'Project':'Task'} saved.`);setModal('');setFormError('');
 }catch(e){setFormError(e instanceof Error?e.message:'Something went wrong.');}
 };
 const finishTask=async(id:string)=>{const t=await patch<import('@/lib/types').ApiTask>(`/tasks/${id}`,{status:'Done'});setTasks(tasks.map(x=>x.id===id?withDue(t):x));};
 const editTask=async(id:string,changes:Record<string,unknown>)=>{const t=await patch<import('@/lib/types').ApiTask>(`/tasks/${id}`,changes);setTasks(tasks.map(x=>x.id===id?withDue(t):x));};
 const removeTask=async(id:string)=>{await destroy(`/tasks/${id}`);setTasks(tasks.filter(t=>t.id!==id));};
```
Also delete the now-unused `import {validateDates} from '@/lib/gantt.mjs';` from App.tsx **only if** no other reference remains (the server validates; gantt.mjs stays used by project-gantt.tsx).

- [ ] **Step 2: Point existing JSX at the new handlers**

- Both complete buttons: replace `onClick={()=>setTasks(completeTask(tasks,t.id))}` with `onClick={()=>finishTask(t.id)}` (occurs twice: Overview priorities row + kanban card).
- Task owner display: any JSX using `t.owner` as a string (e.g. `<small>{t.owner} · {t.due}</small>` and `<p>{t.owner}</p>`) → change `t.owner` to `t.ownerName`.
- Owner select in the create-task form: replace `{members.map(([name])=><NativeSelectOption key={name}>{name}</NativeSelectOption>)}` with `{activeUsers.map(u=><NativeSelectOption key={u.id} value={u.id}>{u.name}</NativeSelectOption>)}` and rename the select `name="owner"` → `name="ownerId"`.
- ProjectGantt usage: replace `onUpdate={(id,changes)=>setTasks(updateItem(tasks,id,changes))}` with `onUpdate={(id,changes)=>{editTask(id,changes).catch(()=>{});}} onDelete={removeTask}`.
- Remove `completeTask` and (if now unused) `updateItem` from the `@/lib/workspace.mjs` import in App.tsx; keep `addItem`-style helpers only where still referenced (`filterItems`, `projectTasks` remain used).

- [ ] **Step 3: Add delete to `web/src/project-gantt.tsx`**

Change the props type to include `onDelete`:
```tsx
export default function ProjectGantt({tasks,onAdd,onUpdate,onDelete}:{tasks:Task[];onAdd:()=>void;onUpdate:(id:string,changes:Partial<Task>&{due?:string})=>void;onDelete?:(id:string)=>void}){
```
Inside the edit dialog's form, next to the existing save button, add:
```tsx
{editing&&onDelete&&<button type="button" className="text-button" onClick={()=>{if(confirm('Delete this task?')){onDelete(editing.id);setEditing(null);}}}>Delete task</button>}
```

- [ ] **Step 4: Verify + smoke-run**

```bash
cd web && npm run build && npm test
```
Then manual smoke (requires Task 4 seed + api running):
```bash
cd api && npx prisma migrate dev && ADMIN_EMAIL=admin@local ADMIN_PASSWORD=admin12345 npx tsx prisma/seed.ts && npm run dev &
cd web && npm run dev
```
Open http://localhost:5173 → login `admin@local`/`admin12345` → create a task → refresh → task persists.

- [ ] **Step 5: Commit** — `git add web/src && git commit -m "feat(web): persist all mutations through the API"`

---

### Task 13: Web — edit/delete affordances + computed Reports

**Files:**
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `patch/destroy/post`, `resourceRows`.
- Produces: project edit/delete, resource create/edit/delete, article delete, Reports totals computed from `resourceRows`. New state: `editingProject: Project|null`, `editingResource: Resource|null`; new modal keys `'project'` (reused, prefilled when editing) and `'resource'`.

- [ ] **Step 1: State + handlers**

Below the Task 12 handlers add:
```tsx
 const [editingProject,setEditingProject]=useState<Project|null>(null);
 const [editingResource,setEditingResource]=useState<Resource|null>(null);
 const saveProject=async(data:FormData)=>{const body={name:(data.get('name') as string).trim(),description:data.get('description') as string,status:data.get('status') as string,progress:Number(data.get('progress')),department:data.get('department') as string,due:data.get('due') as string};const p=await patch<Project>(`/projects/${editingProject!.id}`,body);setProjects(projects.map(x=>x.id===p.id?p:x));if(detail?.id===p.id)setDetail(p);setEditingProject(null);};
 const removeProject=async(id:string)=>{if(!confirm('Delete this project and all its tasks?'))return;await destroy(`/projects/${id}`);setProjects(projects.filter(p=>p.id!==id));setTasks(tasks.filter(t=>t.projectId!==id));navigate('Projects');};
 const saveResource=async(data:FormData)=>{const body={name:(data.get('name') as string).trim(),provider:data.get('provider') as string,type:data.get('type') as string,status:data.get('status') as string,monthlyCost:Number(data.get('monthlyCost'))};const r=editingResource?await patch<Resource>(`/resources/${editingResource.id}`,body):await post<Resource>('/resources',body);setResourceRows(editingResource?resourceRows.map(x=>x.id===r.id?r:x):[...resourceRows,r]);setEditingResource(null);setModal('');};
 const removeResource=async(id:string)=>{if(!confirm('Delete this resource?'))return;await destroy(`/resources/${id}`);setResourceRows(resourceRows.filter(r=>r.id!==id));};
 const removeArticle=async(id:string)=>{if(!confirm('Delete this article?'))return;await destroy(`/knowledge/${id}`);setKnowledge(knowledge.filter(k=>k.id!==id));setArticle(null);};
 const totalMonthly=resourceRows.reduce((sum,r)=>sum+r.monthlyCost,0);
```

- [ ] **Step 2: Project edit/delete buttons**

In the `Project workspace` view header (the block starting `{view==='Project workspace'&&detail&&`), after the back-link button add:
```tsx
<div className="task-controls"><button className="text-button" onClick={()=>{setEditingProject(detail);setModal('project')}}><Pencil size={14}/> Edit project</button><button className="text-button" onClick={()=>removeProject(detail.id)}>Delete project</button></div>
```
(import `Pencil` from `lucide-react` in App.tsx's lucide import list.)

- [ ] **Step 3: Project form prefill + edit branch**

In the create dialog form, where `{modal==='project'&&<label>Description...` renders, expand the project branch to cover editing — replace the project-only section with:
```tsx
{modal==='project'&&<><label>Description<textarea name="description" maxLength={240} defaultValue={editingProject?.description||''}/></label>
{editingProject&&<div className="form-columns">
<label>Status<NativeSelect name="status" defaultValue={editingProject.status}>{['On track','At risk'].map(s=><NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></label>
<label>Progress %<input name="progress" type="number" min={0} max={100} defaultValue={editingProject.progress}/></label>
<label>Team<input name="department" defaultValue={editingProject.department}/></label>
<label>Due<input name="due" defaultValue={editingProject.due}/></label>
</div>}</>}
```
Give the dialog's Name input `defaultValue={editingProject?.name||editing?.name||''}` (replacing the current `defaultValue={editing?.name||''}`). In the `create` handler's project branch, route to edit when active — replace the project line with:
```tsx
 if(modal==='project'){if(editingProject){await saveProject(data);setModal('');return;}const p=await post<Project>('/projects',{name,description:(data.get('description') as string || 'Ready to get started.')});setProjects([...projects,p]);}
```
And in the Dialog `onOpenChange` close handler add `setEditingProject(null);setEditingResource(null);`.

- [ ] **Step 4: Resource table rework + create button**

Replace the resource-table row mapping (currently over the `resources` tuple array) with a map over `resourceRows` rendering the same cells plus an actions cell:
```tsx
{resourceRows.map(r=><TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell>{r.provider}</TableCell><TableCell>{r.type}</TableCell><TableCell><span className={'badge '+(r.status==='Healthy'?'green-badge':'amber')}>{r.status}</span></TableCell><TableCell>${r.monthlyCost}</TableCell><TableCell><button className="text-button" onClick={()=>{setEditingResource(r);setModal('resource')}}><Pencil size={13}/></button> <button className="text-button" onClick={()=>removeResource(r.id)}>✕</button></TableCell></TableRow>)}
```
Delete the Task 11 compatibility line `const resources=resourceRows.map(...)`. Add an "Add resource" button in the Cloud resources toolbar/banner area:
```tsx
{view==='Cloud resources'&&<button className="primary" onClick={()=>{setEditingResource(null);setModal('resource')}}><Plus size={16}/> Add resource</button>}
```
Add the resource form to the create dialog (new branch alongside project/task/article):
```tsx
{modal==='resource'&&<><div className="form-columns">
<label>Provider<input name="provider" required defaultValue={editingResource?.provider||''}/></label>
<label>Type<input name="type" required defaultValue={editingResource?.type||''}/></label>
<label>Status<NativeSelect name="status" defaultValue={editingResource?.status||'Healthy'}>{['Healthy','Review needed'].map(s=><NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></label>
<label>Monthly cost $<input name="monthlyCost" type="number" min={0} defaultValue={editingResource?.monthlyCost??0}/></label>
</div></>}
```
Give the Name input also `editingResource?.name` fallback, and route the `create` handler: add before the final task branch:
```tsx
 else if(modal==='resource'){await saveResource(data);return;}
```

- [ ] **Step 5: Article delete + Reports totals; verify; commit**

In the article view dialog, next to the "Edit article" button add:
```tsx
<button className="text-button" onClick={()=>article&&removeArticle(article.id)}>Delete article</button>
```
Reports: replace the hardcoded `<strong>$2,000<small>/ month</small></strong>` with `<strong>${totalMonthly.toLocaleString()}<small>/ month</small></strong>`, and inside the Reports panel replace any hardcoded per-row spend strings by mapping `resourceRows` (`{r.name} — ${r.monthlyCost}` rows with the existing markup/classes).

```bash
cd web && npm run build && npm test && git add src && git commit -m "feat(web): edit/delete for projects, resources, articles; computed reports"
```

---

### Task 14: Web — admin panel + attachments UI

**Files:**
- Create: `web/src/admin.tsx`, `web/src/attachments.tsx`
- Modify: `web/src/App.tsx` (nav + view mount), `web/src/globals.css` (admin styles)

**Interfaces:**
- Consumes: `api/post/patch`, `uploadFile`, types.
- Produces: `<AdminPanel users onChange={(users)=>void}/>` and `<ArticleAttachments article onChange={(article)=>void}/>`.

- [ ] **Step 1: Write `web/src/admin.tsx`**

```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post, patch } from '@/lib/api';
import type { User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminPanel({ users, onChange }: { users: User[]; onChange: (users: User[]) => void }) {
  const [error, setError] = useState('');
  const replace = (u: User) => onChange(users.map((x) => (x.id === u.id ? u : x)));

  const createUser = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError('');
    try {
      const u = await post<User>('/users', {
        name: data.get('name'), email: data.get('email'), password: data.get('password'),
        title: data.get('title'), role: data.get('role'),
      });
      onChange([...users, u]);
      form.reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create user'); }
  };

  const resetPassword = async (u: User) => {
    const password = prompt(`New password for ${u.name}:`);
    if (!password) return;
    await patch(`/users/${u.id}`, { password });
    alert('Password updated.');
  };

  const toggleActive = async (u: User) => {
    replace(await patch<User>(`/users/${u.id}`, { isActive: !u.isActive }));
  };

  return (
    <section className="panel admin-panel">
      <h2>Team accounts</h2>
      <form className="create-form admin-create" onSubmit={createUser}>
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="title" placeholder="Job title" />
        <input name="password" type="password" placeholder="Temp password" required minLength={8} />
        <select name="role" defaultValue="member"><option value="member">member</option><option value="admin">admin</option></select>
        <button className="primary" type="submit"><Plus size={15} /> Add user</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.title}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell><span className={'badge ' + (u.isActive ? 'green-badge' : 'amber')}>{u.isActive ? 'Active' : 'Deactivated'}</span></TableCell>
              <TableCell>
                <button className="text-button" onClick={() => resetPassword(u)}>Reset password</button>{' '}
                <button className="text-button" onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
```

- [ ] **Step 2: Write `web/src/attachments.tsx`**

```tsx
import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { destroy, uploadFile } from '@/lib/api';
import type { Article, Attachment } from '@/lib/types';

const fmt = (bytes: number) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

export default function ArticleAttachments({ article, onChange }: { article: Article; onChange: (a: Article) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const att = await uploadFile<Attachment>(`/knowledge/${article.id}/attachments`, file);
      onChange({ ...article, attachments: [...article.attachments, att] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const remove = async (id: string) => {
    await destroy(`/attachments/${id}`);
    onChange({ ...article, attachments: article.attachments.filter((a) => a.id !== id) });
  };

  return (
    <div className="attachments">
      <h3><Paperclip size={14} /> Attachments</h3>
      {article.attachments.length === 0 && <p className="empty">No files attached.</p>}
      <ul>
        {article.attachments.map((a) => (
          <li key={a.id}>
            <a href={`/api/attachments/${a.id}/download`}>{a.originalName}</a>
            <small> {fmt(a.sizeBytes)}</small>
            <button className="text-button" onClick={() => remove(a.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Mount both in App.tsx**

- Imports: `import AdminPanel from './admin';` and `import ArticleAttachments from './attachments';`; add `Shield` to the lucide import.
- Nav: after the `nav` constant usage, render an extra item for admins. Where the sidebar maps `nav`, switch to a locally derived list:
```tsx
 const navItems=me.role==='admin'?[...nav,['Admin',Shield] as const]:nav;
```
and map `navItems` instead of `nav` in the sidebar menu JSX.
- View: add alongside other view blocks:
```tsx
{view==='Admin'&&me.role==='admin'&&<AdminPanel users={users} onChange={setUsers}/>}
```
- Article dialog: inside the article Dialog, after the `article-body` div add:
```tsx
{article&&<ArticleAttachments article={article} onChange={a=>{setArticle(a);setKnowledge(knowledge.map(k=>k.id===a.id?a:k));}}/>}
```

Append to END of `web/src/globals.css`:
```css
.admin-create{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.admin-create input,.admin-create select{border:1px solid var(--border);border-radius:8px;padding:9px;font:inherit}
.attachments{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}.attachments h3{display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:8px}.attachments ul{list-style:none;display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.attachments li{display:flex;align-items:center;gap:8px;font-size:13px}
```

- [ ] **Step 4: Verify** — `cd web && npm run build && npm test`; manual: as admin create a user; open an article, upload a `.txt`, download it, remove it.
- [ ] **Step 5: Commit** — `git add web/src && git commit -m "feat(web): admin user panel and article attachments"`

---

### Task 15: Docker — api image, caddy image, compose, env

**Files:**
- Create: `api/Dockerfile`, `caddy/Dockerfile`, `caddy/Caddyfile`, `.env.example`
- Replace: `compose.yml` (the old dev compose is superseded — Docker is production-only now)

- [ ] **Step 1: `api/Dockerfile`**

```dockerfile
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npx prisma generate && npm run build

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/index.js"]
```
(Generate `api/package-lock.json` first if missing: `cd api && npm install`.)

- [ ] **Step 2: `caddy/Caddyfile` + `caddy/Dockerfile`**

`caddy/Caddyfile`:
```
{$DOMAIN} {
	encode gzip

	handle /api/* {
		reverse_proxy api:3000
	}

	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
```

`caddy/Dockerfile`:
```dockerfile
FROM node:22-slim AS webbuild
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM caddy:2
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=webbuild /web/dist /srv
```

- [ ] **Step 3: Replace `compose.yml`**

```yaml
services:
  caddy:
    build: { context: ., dockerfile: caddy/Dockerfile }
    restart: unless-stopped
    ports: ['80:80', '443:443']
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [api]

  api:
    build: { context: ., dockerfile: api/Dockerfile }
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ctm
      SESSION_SECRET: ${SESSION_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ATTACHMENTS_DIR: /attachments
      NODE_ENV: production
    volumes:
      - attachments:/attachments
    depends_on:
      postgres: { condition: service_healthy }

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ctm
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d ctm']
      interval: 5s
      timeout: 3s
      retries: 10

  backup:
    image: postgres:17
    restart: unless-stopped
    environment:
      PGHOST: postgres
      PGUSER: postgres
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ctm
    volumes:
      - backups:/backups
      - attachments:/attachments:ro
      - ./backup/backup.sh:/backup.sh:ro
    entrypoint: ['bash', '/backup.sh']
    depends_on:
      postgres: { condition: service_healthy }

volumes:
  pgdata:
  attachments:
  backups:
  caddy_data:
  caddy_config:
```

`.env.example`:
```
# Public domain pointed at this server (Caddy provisions HTTPS for it)
DOMAIN=team.example.com
# Postgres superuser password (compose-internal only)
POSTGRES_PASSWORD=change-me-long-random
# Session cookie signing secret
SESSION_SECRET=change-me-long-random-2
# First admin account, created on first boot if no active admin exists
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me-strong
```

- [ ] **Step 4: Verify** — `docker compose config` parses; local trial with `DOMAIN=:8080` in `.env` (Caddy serves plain HTTP on 8080 when the address has no hostname): `docker compose up --build`, then `curl -s http://localhost:8080/api/health` → `{"ok":true}` and `curl -s http://localhost:8080/` returns the SPA HTML.
- [ ] **Step 5: Commit** — `git add api/Dockerfile caddy/ compose.yml .env.example && git commit -m "feat(deploy): production compose stack with Caddy HTTPS ingress"`

---

### Task 16: Backup service

**Files:**
- Create: `backup/backup.sh`

- [ ] **Step 1: Write `backup/backup.sh`**

```bash
#!/usr/bin/env bash
# Nightly 02:00 backup: pg_dump + attachments tar, 14-day retention.
set -euo pipefail

while true; do
  now=$(date +%s)
  target=$(date -d '02:00 next day' +%s 2>/dev/null || date -d 'tomorrow 02:00' +%s)
  # If it's before 02:00 today, back up at 02:00 today instead.
  today_2am=$(date -d '02:00' +%s)
  if [ "$now" -lt "$today_2am" ]; then target=$today_2am; fi
  sleep $((target - now))

  stamp=$(date +%F)
  dir="/backups/$stamp"
  mkdir -p "$dir"
  echo "[backup] $stamp starting"
  pg_dump -Fc -f "$dir/ctm.dump"
  tar -czf "$dir/attachments.tar.gz" -C /attachments .
  echo "[backup] $stamp done: $(du -sh "$dir" | cut -f1)"

  # Retention: remove dated dirs older than 14 days
  find /backups -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf {} +
done
```

- [ ] **Step 2: Verify manually** — with the Task 15 stack up:
```bash
docker compose exec backup bash -c 'stamp=$(date +%F); mkdir -p /backups/$stamp && pg_dump -Fc -f /backups/$stamp/ctm.dump && tar -czf /backups/$stamp/attachments.tar.gz -C /attachments . && ls -la /backups/$stamp'
```
Expected: `ctm.dump` and `attachments.tar.gz` exist with nonzero size.

- [ ] **Step 3: Commit** — `git add backup/ && git commit -m "feat(deploy): nightly pg_dump + attachments backup with 14-day retention"`

---

### Task 17: Deploy docs + restore runbook

**Files:**
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: Write `docs/DEPLOY.md`**

```markdown
# Deploying Cloud Team Management

## Prerequisites
- A Linux server with Docker + Docker Compose v2 and ports 80/443 open.
- A DNS A/AAAA record for your domain pointing at the server.

## First deployment
1. `git clone <repo> && cd cloud-team-management`
2. `cp .env.example .env` and fill every value (long random strings for
   POSTGRES_PASSWORD and SESSION_SECRET; your real admin email/password).
3. `docker compose up -d --build`
4. Open `https://<DOMAIN>` — sign in with ADMIN_EMAIL / ADMIN_PASSWORD.
5. In the Admin view, create accounts for your team.

## Updating
```sh
git pull && docker compose up -d --build
```
Migrations and the (idempotent) seed run automatically when `api` starts.

## Backups
The `backup` service writes `/backups/<YYYY-MM-DD>/ctm.dump` +
`attachments.tar.gz` nightly at 02:00, keeping 14 days. Copy them off-server
on your own schedule, e.g.:
```sh
docker compose cp backup:/backups ./offsite-copy
```

## Restore (runbook — rehearse this once before you need it)
1. Stop the app: `docker compose stop api caddy`
2. Restore the database (replace the date):
   ```sh
   docker compose exec postgres dropdb -U postgres --if-exists ctm_restore
   docker compose exec postgres createdb -U postgres ctm_restore
   docker compose exec backup bash -c 'pg_restore -d ctm_restore /backups/2026-09-07/ctm.dump'
   # Verify, then swap:
   docker compose exec postgres psql -U postgres -c 'ALTER DATABASE ctm RENAME TO ctm_old; ALTER DATABASE ctm_restore RENAME TO ctm;'
   ```
3. Restore attachments:
   ```sh
   docker compose exec backup bash -c 'tar -xzf /backups/2026-09-07/attachments.tar.gz -C /attachments'
   ```
   (backup mounts attachments read-only; for a real restore run the same tar
   from the `api` container: `docker compose cp` the archive in, then untar to
   `/attachments`.)
4. Start again: `docker compose start api caddy` and verify login + data.
5. When satisfied: `docker compose exec postgres dropdb -U postgres ctm_old`

## Password resets
There is no email-based reset (see docs/adr/0001). An admin resets passwords
from the Admin view.
```

- [ ] **Step 2: Execute the restore rehearsal once** against the local trial stack; fix any command that doesn't work as written (the runbook must be literal).
- [ ] **Step 3: Commit** — `git add docs/DEPLOY.md && git commit -m "docs: deployment guide with rehearsed restore runbook"`

---

### Task 18: Cleanup, CLAUDE.md, VALIDATION.md, final smoke

**Files:**
- Delete: `next.config.ts`, `vite.config.ts` (root), `package.json` (root), `package-lock.json` (root), `components.json`, `.openai/`, `next-env.d.ts`, `tsconfig.json` (root), `.oxlintrc.json`, `.oxfmtrc.json`, stale `.next/ .vinext/ .wrangler/ node_modules/`
- Modify: `CLAUDE.md`, `VALIDATION.md`
- Keep: `README-EXPORT.md` (historical), `diagrams/`, `docs/`, `CONTEXT.md`

- [ ] **Step 1: Remove Vinext/Cloudflare remnants**

```bash
rm -rf next.config.ts vite.config.ts package.json package-lock.json components.json .openai next-env.d.ts tsconfig.json .oxlintrc.json .oxfmtrc.json .next .vinext .wrangler node_modules
```
(Root lint configs die with the root package; each package owns its own tooling. Re-adding oxlint per-package is out of scope.)

- [ ] **Step 2: Rewrite `CLAUDE.md`** — replace the whole file with:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# web (Vite + React SPA)
cd web && npm install
npm run dev        # http://localhost:5173, proxies /api → localhost:3000
npm test           # node --test src/lib/*.test.mjs
npm run build      # tsc --noEmit + vite build

# api (Express + Prisma)
cd api && npm install
docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17
export DATABASE_URL=postgresql://postgres:test@localhost:5433/ctm_test
npx prisma migrate dev
npm test           # tsx --test test/*.test.ts (needs the Postgres above)
npm run dev        # tsx watch src/index.ts on :3000

# production (server)
cp .env.example .env   # fill values
docker compose up -d --build
```

## Architecture

Monorepo, two packages behind one Caddy ingress (see
`docs/superpowers/specs/2026-09-07-platform-migration-design.md` and `CONTEXT.md`):

- **web/** — plain Vite SPA. All state lives in `src/App.tsx`, loaded from the
  API on login. Pure logic in `src/lib/workspace.mjs` + `src/lib/gantt.mjs`
  (node --test, zero test deps). `src/components/ui` is vendored shadcn —
  don't lint/refactor it. Styling is hand-written classes at the bottom of
  `src/globals.css`, not Tailwind utilities.
- **api/** — Express 5 + Prisma. `createApp(prisma)` in `src/app.ts`; routes
  in `src/routes/*` (one file per entity); validation constants + gantt-
  mirrored date rules in `src/validate.ts` (messages must stay in sync with
  web's `gantt.mjs`). Sessions in Postgres (connect-pg-simple), scrypt
  passwords (`src/passwords.ts` — no argon2). Tests hit a real Postgres via
  fetch; no mocks, no supertest.
- **Deploy** — `caddy/Dockerfile` builds the SPA into the Caddy image (no web
  runtime container). `api` runs `prisma migrate deploy` + idempotent seed on
  start. `backup` service dumps nightly (02:00, 14-day retention). Restore
  runbook: `docs/DEPLOY.md`.

## Conventions

- Users are deactivated, never deleted (`tasks.owner_id` FK must stay valid).
- `Project.department` is the schema name for the UI's "Team" label.
- Enum lists (phase/status/priority/category) are fixed; validate server-side.
- VALIDATION.md is the evidence log — append per feature, don't rewrite.
```

- [ ] **Step 3: Append migration evidence to `VALIDATION.md`** — record the actual results of: full api suite (`npm test` — count passed), web tests + build, compose smoke (`curl /api/health`, login → create task → `docker compose restart` → task still present), and the restore rehearsal from Task 17. Every claim must carry the real command output summary; anything not verified is listed as `NOT VERIFIED`.

- [ ] **Step 4: Final smoke** — clean-machine emulation:
```bash
docker compose down && docker compose up -d --build
# wait for healthy, then:
curl -s http://localhost:8080/api/health   # with local DOMAIN=:8080 trial
```
Login in a browser, create a project + task, upload an attachment, restart the stack, confirm everything survives.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Vinext/Cloudflare platform files; document new stack"
```

---

## Self-Review Notes

- Spec coverage: every spec section maps to a task (auth→3, seed→4, users/admin→5+14, projects→6+13, tasks→7+12, knowledge→8, attachments→9+14, resources→10+13, reports→13, docker→15, backup→16, restore+docs→17, cleanup/CLAUDE/VALIDATION→18, monorepo/web scaffold→1, api scaffold→2). WebMCP keep = no-op (ports with App.tsx in Task 1).
- Type consistency: `withDue`/`ownerName` introduced in Task 11 and used in Task 12; `ATTACHMENTS_DIR()` defined in Task 8, consumed in Task 9; helper `authed()` defined in Task 2, used from Task 3 onward.
- Known judgment calls left to the implementer: exact JSX insertion points follow the current dense single-line style of App.tsx — match it rather than reformatting.
