TDD_REQUIRED: yes
Observable seam: session project creation, targeted task completion, combined search/status filtering.
RED: node --test lib/workspace.test.mjs — 3 expected assertion failures before implementation.
GREEN: same command — 3 passed after implementing the shared state transformations.
REFACTOR: no additional abstraction needed; shared actions used by the visible UI.
Scope: demo session data only; no authentication, durable records, cloud provider connection or real monetary operation.
WebMCP: optional navigation tool feature-detected; supported browser validation context unavailable, contract verification not claimed.
Final checks: production build passed; 3 behavior checks passed; authored app/lib lint passed. Full scaffold lint reports pre-existing issues in generated components and hooks, which were preserved per Sites instructions. Parent inspected authored source, state actions, responsive rules, manifest and metadata.
Project/KM extension: tasks are scoped by project, status/owner/date edits update the timeline on the same page; knowledge articles support category/content search and create/edit/read.
Extension TDD: observed 3 new assertion failures against unchanged stub actions, then 6/6 passing after implementation. No further refactor needed. Production build and authored-source lint passed; local route returned 200. Parent inspected complete extension diff and confirmed state stays session-only with no external integrations.
Gantt replacement: TDD_REQUIRED yes. Observable seam: shared calendar positions, inclusive duration across month boundaries, invalid/reversed ranges, and unscheduled tasks. Three tests failed against placeholders before implementation; all 9 project/Gantt tests pass afterward. Refactor: no additional abstraction required. Production build, authored app/lib lint and local HTTP render passed. Presentation follows supplied task-grid/calendar reference with phase collapse, zoom, editing, and session-only state; no browser QA requested or claimed.

---

## Platform migration (self-hosted Docker stack) — 2026-09-09

Branch `feat/platform-migration`. Vinext/Cloudflare → Vite SPA + Express/Prisma API + Postgres behind Caddy.

**Tests (all green):**
- web: `node --test src/lib/*.test.mjs` → 9/9 pass; `tsc --noEmit` + `vite build` clean (2055 modules, dist emitted).
- api: `NODE_ENV=test tsx --test --test-force-exit --test-concurrency=1 test/*.test.ts` against a real Postgres → 23/23 pass; `tsc -p tsconfig.json` build clean (dist/src/index.js + dist/prisma/seed.js emitted). Coverage: health, auth (login/logout/me, wrong creds, deactivated, CSRF origin, rate limit), seed idempotency + env admin, users (roster/create/reset/deactivate + last-admin guard + password min), projects (CRUD, validation, cascade), tasks (defaults, gantt date messages, active-owner, delete), knowledge (CRUD, session author), attachments (upload allow-list, 25MB→413, authed download, delete), resources (CRUD, cost validation).

**End-to-end (deployed compose stack, Caddy HTTPS on `localhost` internal cert):**
- `docker compose up -d --build` → postgres healthy, api healthy (migrate+seed ran), caddy serving.
- `GET /` → 200 (SPA, references built `/assets/index-*.js`); `GET /api/health` via proxy → 200.
- Login sets a Secure session cookie over HTTPS; `/api/projects`=3, `/api/tasks`=4, `/api/auth/me` role=admin. DB row counts: projects 3, tasks 4, users 5 (4 demo deactivated + 1 env admin), resources 4, articles 4.
- Backup service: `pg_dump -Fc` + attachments tar produce files (ctm.dump 16KB, attachments.tar.gz).
- **Restore rehearsed** (docs/DEPLOY.md runbook): `pg_restore` into scratch `ctm_restore` → counts matched live (projects 3, tasks 4, users 5); attachments tar valid.

**Notes:** the Secure cookie means the app requires HTTPS in production (plain-HTTP trial won't keep a session — expected). Real production bug fixed during build: login now `req.session.save()`s before responding (durability race). No email service (ADR-0001).

---

## AI Copilot (phase 2) — 2026-09-10

Branch `feat/ai-copilot`. Read-only Q&A grounded in a workspace snapshot, Gemini behind an injectable `askLLM`. Spec: `docs/superpowers/specs/2026-09-10-ai-copilot-design.md`.

**Tests (all green, no API key needed — a fake `askLLM` is injected):**
- api: `npm --prefix api test` → **33/33** pass (23 prior + 3 snapshot + 2 gemini + 5 route). Covers: snapshot includes workspace facts and excludes password hashes/emails + is size-bounded/truncated; `isConfigured()`/`realAskLLM` graceful when no key; route requires auth (401), passes snapshot+question to the LLM and returns `{answer}`, rejects empty/oversized question (400), maps provider error→502 and not-configured→503, `GET /status` reflects env key. `tsc -p` build clean.
- web: `npm --prefix web test` → 9/9; `tsc --noEmit` + `vite build` clean (2056 modules).
- `docker compose config` valid with the new `GEMINI_API_KEY`/`GEMINI_MODEL` env.

**Not verified (by design):** the live Gemini network path — exercised only with a real key, which is not set. The not-configured (503 / status.enabled=false / panel "isn't configured yet") paths ARE verified. No schema change; no new migration.
