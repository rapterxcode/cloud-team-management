# Platform Migration — Self-Hosted Docker Stack

**Date:** 2026-09-07
**Scope type:** refactor (re-platform) + targeted additions (auth, persistence, attachments, edit/delete)
**Status:** approved by owner (see decision log below)

## Goal

Move Cloud Team Management off Vinext/Cloudflare Workers onto a self-hosted Docker Compose stack: React SPA + Node/TS API + PostgreSQL behind Caddy with automatic HTTPS. Replace session-only in-memory state with durable per-user data. Keep the existing screens and Gantt chart working as-is.

Out of scope: AI Copilot (phase 2, separate design), cloud-provider billing integration, email sending, off-site backup push.

## Architecture

Four runtime services in `compose.yml`, built on the server (`git pull && docker compose up -d --build`; no registry, no CI):

| Service | Image | Role |
|---|---|---|
| `caddy` | custom (multi-stage: builds `web/` SPA, copies `dist/` into Caddy image) | Only exposed container. Auto-HTTPS for the configured domain. Serves the SPA via `file_server` with SPA fallback; proxies `/api/*` → `api:3000`. |
| `api` | custom (`api/Dockerfile`) | Express + Prisma + TS. Runs `prisma migrate deploy` on startup **before** listening. |
| `postgres` | `postgres:17` | Data on named volume `pgdata`. Healthcheck; `api` waits on `condition: service_healthy`. |
| `backup` | small postgres-client image + script | Nightly 02:00: `pg_dump` + tar of attachments volume → dated files on `backups` volume. Keeps last 14 days, deletes older. |

There is **no separate `web` runtime container** — the SPA is a build artifact inside the Caddy image.

Volumes: `pgdata` (database), `attachments` (KM files, mounted into `api`), `backups` (dump archives), `caddy_data` (certificates).

Configuration via `.env` (with committed `.env.example`): `DOMAIN`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Repository layout (monorepo)

```
cloud-team-management/
├── web/          # Vite + React + TS + Tailwind SPA
│   └── src/lib/  # workspace.mjs, gantt.mjs + tests move here unchanged
├── api/          # Express + Prisma + TS
│   └── prisma/   # schema.prisma, migrations/, seed script
├── caddy/        # Caddyfile + Dockerfile (multi-stage web build)
├── compose.yml
├── docs/         # this spec, ADRs, deploy runbook (incl. restore procedure)
└── CONTEXT.md    # domain glossary (already written)
```

Vinext-specific files are removed: `next.config.ts`, root `vite.config.ts`, `.openai/`, root `package.json`/lockfile, `components.json`. The `components/ui` set moves into `web/` (kept as vendored shadcn output). Dev workflow: run Vite dev server + `tsx watch` locally with Vite proxying `/api`; Docker is production-only (no `compose.dev.yml`).

## Data model

Definitions follow `CONTEXT.md` (User, Team, Role, Deactivated user, Task owner, Project department, Attachment).

- **users** — id, email (unique), password_hash (Node `crypto.scrypt`; no argon2 dependency), name, role (`admin` | `member`), title, is_active, created_at. Users are deactivated, never deleted.
- **projects** — id, name, description, status (`On track` | `At risk`), progress (manually set integer 0–100), **department** (free text; renamed from `team`), due, color, created_at.
- **tasks** — id, project_id FK, name, **owner_id FK → users.id** (required), phase (`Planning` | `Development` | `Launch`), status (`To do` | `In progress` | `Done`), priority (`High` | `Medium` | `Low`; defaults `Medium`, no picker UI — preserved behavior), start date, due date (validation rules identical to `lib/gantt.mjs`: both-or-neither, finish ≥ start).
- **knowledge_articles** — id, name, category (`Guides` | `Runbooks` | `Onboarding` | `Meeting notes`), body, author_id FK → users.id, created_at, updated_at.
- **knowledge_attachments** — id, article_id FK, stored_name (random UUID filename on disk), original_name, mime_type, size_bytes, uploaded_by FK, created_at. One article : many attachments.
- **cloud_resources** — id, name, provider, type, status, **monthly_cost** (editable numeric). Flat — no project linkage (deliberate).
- **sessions** — managed by `connect-pg-simple`.

Enumerated string fields are validated server-side against the fixed lists above.

### Seed data

Prisma seed script, idempotent:
1. The 4 demo members (Alex Morgan, Sarah Chen, James Wilson, Priya Patel) as **deactivated** users (satisfy FK references; fill Team page; cannot log in).
2. First admin created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars if no active admin exists.
3. Demo projects, tasks (owner_id mapped to seeded users), knowledge articles, cloud resources — same values as today's `initial*` constants.

## Auth & permissions

- Session cookie: httpOnly, Secure, `SameSite=Lax`, 30-day rolling expiry. Store: Postgres via `connect-pg-simple`. Logout endpoint destroys the session.
- CSRF posture: `SameSite=Lax` plus an `Origin` header check on all mutating requests.
- Login rate limiting: small in-code limiter (per-IP + per-email attempt window) on `POST /api/auth/login`.
- Every `/api/*` route except login/health requires a session. Attachment downloads go through the API (never served directly by Caddy) so they respect login.
- Roles: `member` — full CRUD on projects/tasks/knowledge/resources (flat, matching today's behavior; no ownership-based restrictions). `admin` — additionally create users, reset passwords, deactivate/reactivate users.
- No self-service password reset (ADR-0001): admins reset passwords via the admin UI; no email service exists in the stack.

## API surface (JSON REST)

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`
- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` (PATCH covers complete-task and Gantt edits)
- `GET/POST /api/knowledge`, `PATCH/DELETE /api/knowledge/:id`
- `POST /api/knowledge/:id/attachments` (multipart; allow-list: PDF, Word/Excel/PowerPoint, PNG/JPG, plain text; ≤ 25 MB/file; stored under random UUID name), `GET /api/attachments/:id/download` (`Content-Disposition: attachment`), `DELETE /api/attachments/:id`
- `GET/POST /api/resources`, `PATCH/DELETE /api/resources/:id`
- `GET /api/users` (roster for Team page + owner picker; picker lists active users only), `POST /api/users` (admin), `PATCH /api/users/:id` (admin: reset password, deactivate/reactivate)
- `GET /api/health`

## Frontend changes

- `app/page.tsx` and `app/project-gantt.tsx` port to `web/src/` with state moved from `useState` initial constants to API calls (fetch on load, mutate via API, optimistic or refetch — implementer's choice, keep it simple). The pure logic in `workspace.mjs`/`gantt.mjs` and the visual design stay unchanged.
- New: login screen (email/password), logout control, admin user-management panel (create user, reset password, deactivate).
- New: edit and delete affordances for projects, tasks, resources, and articles (articles already have edit). This is deliberate new scope: durable data requires correcting mistakes; `monthly_cost` editing rides on resource edit.
- Reports view computes spend totals from `cloud_resources.monthly_cost` instead of hardcoded strings.
- The WebMCP `navigate_workspace` registration is kept as-is.
- Priority/color pickers are **not** added; defaults preserved.

## Error handling

- API returns structured JSON errors `{ error: string }` with correct status codes (400 validation, 401 unauthenticated, 403 forbidden, 404, 413 payload too large, 429 rate-limited).
- Date validation errors reuse the exact messages from `lib/gantt.mjs` so the UI behavior is unchanged.
- The SPA surfaces API errors in the existing `formError` pattern.

## Backup & restore

- Nightly 02:00 server time: `pg_dump -Fc` + `tar` of the attachments volume, written as `backups/<YYYY-MM-DD>/`. Retention: 14 days.
- **Restore runbook** documented in `docs/DEPLOY.md`: stop `api`, `pg_restore` into a fresh database, untar attachments, restart. The runbook must be executed once against a scratch environment as part of acceptance — a restore that has never been run does not count.
- Off-site copying of the `backups` volume is the operator's responsibility for now (deliberate; revisit when off-site push is wanted).

## Testing

- `web/`: existing `node --test` lib tests move unchanged and must keep passing.
- `api/`: `node:test` + built-in `fetch` against the app listening on an ephemeral port, backed by a real Postgres test database (no mocks, no supertest). Coverage: login/logout/session, per-entity CRUD + validation, permission checks (member vs admin vs anonymous), upload type/size rejection, download auth, owner-FK integrity (cannot delete users; deactivated users vanish from picker but keep tasks).
- Final smoke check (documented in VALIDATION.md per repo convention): compose up on a clean machine → login as admin → create project/task → restart stack → data survives.

## Definition of done

1. `docker compose up -d --build` on a clean Docker host with a filled `.env` yields a working HTTPS app at the configured domain.
2. All API tests and web lib tests pass; evidence appended to VALIDATION.md.
3. Data survives container restart and image rebuild (volumes).
4. Restore runbook executed successfully once.
5. Old Vinext/Cloudflare files removed; `CLAUDE.md` updated to describe the new stack and commands.

## Decision log

| # | Decision | Choice |
|---|---|---|
| 1 | Task owner storage | FK → `users.id` |
| 2 | `project.team` naming collision | rename to `department` (UI copy unchanged) |
| 3 | Permissions | flat `member` CRUD + `admin` user management |
| 4 | Password recovery | admin reset, no email service (ADR-0001) |
| 5 | Attachments cardinality | many per article |
| 6 | Resources ↔ projects | stay unlinked |
| 7 | Demo quirks (priority/color defaults, fixed phase/category lists) | preserved exactly |
| 8 | User removal | deactivate, never delete |
| 9 | Deploy flow | build on server, no registry |
| 10 | Reports numbers | computed from editable `monthly_cost` |
| 11 | Session lifetime | 30-day rolling cookie |
| 12 | First admin | from env vars; demo users seeded deactivated |
| 13 | Backups | nightly 02:00, 14-day retention, local volume |
| 14 | Repo shape | monorepo `web/` + `api/` |
| 15 | WebMCP tool | kept |
| 16 | Test tooling | node:test + fetch, real Postgres, no new frameworks |
| 17 | Web serving | Caddy serves SPA directly; no Nginx container |
| 18 | Password hashing | Node `crypto.scrypt` (no argon2 native dep) |
| 19 | Edit/delete UI | added for all entities (new scope, approved) |
