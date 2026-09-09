# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# web (Vite + React SPA)  — from web/
cd web && npm install
npm run dev        # http://localhost:5173, proxies /api → localhost:3000
npm test           # node --test src/lib/*.test.mjs
npm run build      # tsc --noEmit + vite build

# api (Express + Prisma)  — from api/
cd api && npm install
docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17
export DATABASE_URL=postgresql://postgres:test@localhost:5433/ctm_test
npx prisma migrate dev
npm test           # NODE_ENV=test tsx --test (needs the Postgres above)
npm run dev        # tsx watch src/index.ts on :3000

# production (server)
cp .env.example .env   # fill DOMAIN + secrets + first admin
docker compose up -d --build
```

## Architecture

Monorepo, two packages behind one Caddy ingress. Full spec:
`docs/superpowers/specs/2026-09-07-platform-migration-design.md`; domain terms:
`CONTEXT.md`; deploy + restore: `docs/DEPLOY.md`.

- **web/** — plain Vite SPA (React 19 + Tailwind 4 via `@tailwindcss/postcss`,
  NOT `@tailwindcss/vite`). All state lives in `src/App.tsx`, loaded from the
  API on login. Pure logic in `src/lib/workspace.mjs` + `src/lib/gantt.mjs`
  (node --test, zero test deps). `src/components/ui` is vendored shadcn
  (`@shadcn/react`) — don't lint/refactor it. Styling is hand-written classes
  at the bottom of `src/globals.css`, not Tailwind utilities.
- **api/** — Express 5 + Prisma + Postgres. `createApp(prisma)` in `src/app.ts`;
  one route file per entity in `src/routes/*`; validation constants + gantt-
  mirrored date rules in `src/validate.ts` (messages must stay in sync with
  web's `gantt.mjs`). Sessions in Postgres (connect-pg-simple), scrypt
  passwords (`src/passwords.ts`, no argon2). Tests hit a real Postgres via
  `fetch`; no mocks. The test script uses `--test-force-exit --test-concurrency=1`
  (pg pool keeps the loop alive; files share one DB).
- **Deploy** — `caddy/Dockerfile` builds the SPA into the Caddy image (no web
  runtime container); Caddy serves it and proxies `/api/*`. `api` runs
  `prisma migrate deploy` + idempotent seed on start. `backup` dumps nightly
  (02:00, 14-day retention).

## Conventions

- Users are deactivated, never deleted (`tasks.owner_id` FK must stay valid);
  the last active admin can't be demoted/deactivated.
- `Project.department` is the schema name for the UI's "Team" label.
- Enum lists (project status / task phase·status·priority / knowledge category)
  are fixed; validate server-side against `src/validate.ts`.
- The session cookie is `Secure` in production — the app needs HTTPS (Caddy
  provides it). Use `DOMAIN=localhost` for a locally-trusted HTTPS trial.
- No email service (ADR-0001): admins reset passwords in-app.
- VALIDATION.md is the evidence log — append per feature, don't rewrite.
