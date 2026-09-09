# Handoff — Platform Migration (COMPLETE: 18/18 tasks, kept on branch for review)

**Date:** 2026-09-07 (completed 2026-09-09) · **Branch:** `feat/platform-migration` (21 commits ahead of `main`, not merged — kept for your review) · **Status:** ✅ Done and verified.

**TL;DR (ไทย):** ย้ายระบบเสร็จครบทั้ง 18 tasks แล้ว — SPA (Vite) + API (Express/Prisma) + Postgres หลัง Caddy(HTTPS) + backup. Test ผ่านหมด (web 9/9, api 23/23), รัน stack จริงผ่าน Docker ได้ (login + ดึงข้อมูล + backup + ซ้อม restore ผ่าน). **ยังไม่ merge เข้า main** — เก็บไว้บน branch `feat/platform-migration` ให้รีวิว/ทดสอบก่อน. เมื่อพอใจแล้ว merge ด้วย `git checkout main && git merge feat/platform-migration`.

## How to run / review
- **Deploy for real:** `cp .env.example .env`, ใส่ค่า (DOMAIN + secrets + admin), แล้ว `docker compose up -d --build` → เปิด `https://<DOMAIN>`. รายละเอียด: `docs/DEPLOY.md`.
- **Local HTTPS trial:** ตั้ง `DOMAIN=localhost` ใน `.env` แล้ว `docker compose up -d --build` → `https://localhost` (Caddy ออก cert internal ให้; cookie เป็น Secure จึงต้อง HTTPS).
- **Run tests:** web `npm --prefix web test`; api ต้องมี Postgres ทดสอบ (`docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17`, `export DATABASE_URL=postgresql://postgres:test@localhost:5433/ctm_test`, `cd api && npx prisma migrate dev`, `npm test`).
- Evidence log: `VALIDATION.md`. A `ctm-test-pg` container may still be running on :5433 from the build session — `docker rm -f ctm-test-pg` to remove it.

## Progress

| Tasks | What | Status |
|---|---|---|
| 1 | web/ SPA on plain Vite (Tailwind via PostCSS, @shadcn/react) | ✅ 9/9 lib tests, build clean |
| 2–10 | Full API: scaffold, auth, seed, users, projects, tasks, knowledge, attachments, resources | ✅ 23/23 tests, `tsc` build clean |
| 11–14 | web: API client + login gate; wire mutations; edit/delete UI + computed Reports; admin panel + attachments UI | ✅ builds clean, e2e contract verified |
| 15–18 | Docker (Caddy+api+pg+backup), backup script, DEPLOY.md + restore rehearsal, cleanup/CLAUDE/VALIDATION | ✅ stack verified over HTTPS; restore rehearsed |

## To resume
- Test Postgres for the API suite: `docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17` then `export DATABASE_URL=postgresql://postgres:test@localhost:5433/ctm_test`. Run api tests with `npm --prefix api test` (a `ctm-test-pg` container may already be running from the build session).
- web: `npm --prefix web test` / `npm --prefix web run build`.
- Continue at plan **Task 11**. The plan's Global Constraints "Execution deltas" note captures the important API harness fixes already applied.
- Real fixes made during execution (all committed): PostCSS Tailwind (not @tailwindcss/vite), @shadcn/react dep, login `req.session.save()` durability race, undici `getSetCookie()`, per-test session-table reset, `--test-force-exit --test-concurrency=1`, tsc casts for `req.params.id`/multer cb.

## Original design/plan status (unchanged)
Design + plan for all 18 tasks approved and committed (spec + plan in `docs/superpowers/`).

## What this migration is

Re-platform Cloud Team Management off Vinext/Cloudflare Workers onto a self-hosted stack: Vite React SPA (served by Caddy with auto-HTTPS) + Express/Prisma API + PostgreSQL + nightly backups, with per-user login, durable data, KM file attachments, and edit/delete UI. AI Copilot is explicitly **phase 2** (not designed yet).

## Read these, in order, when resuming

1. `docs/superpowers/specs/2026-09-07-platform-migration-design.md` — approved spec with the 19-entry decision log.
2. `docs/superpowers/plans/2026-09-07-platform-migration.md` — the 18-task implementation plan. **This is the work queue.** Execute it task-by-task with the `superpowers:subagent-driven-development` skill (recommended; the owner has not yet chosen between subagent-driven and inline execution — ask, then start at Task 1).
3. `CONTEXT.md` — domain glossary (User vs Team vs department, deactivate-not-delete, etc.).
4. `docs/adr/0001-admin-resets-passwords-no-email-service.md` — why there's no forgot-password.

## Current repo state

- git initialized on `main`; only docs are committed (2 commits). All original app source (`app/`, `components/`, `lib/`, `hooks/`, root configs) is **untracked on purpose** — Task 1 moves it into `web/` and commits the new layout.
- `compose.yml` at root is the **old dev-only compose** (`node:22-slim` running `vinext dev` on :3000). It gets replaced by the production stack in plan Task 15. The old app still works: `docker compose up` → http://localhost:3000.
- `diagrams/` holds 7 architecture diagrams, also published as private Artifacts (links below).
- `CLAUDE.md` still documents the OLD Vinext stack — correct until Task 18 rewrites it.

## Things the owner must provide at implementation time

- `.env` values for production (plan Task 15 / `.env.example`): real `DOMAIN` (DNS already pointed, per design Q&A), `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- API tests (plan Tasks 2–10) need a local test Postgres — exact docker command is in the plan's Global Constraints.

## Key decisions to not re-litigate (full log in the spec)

FK task owners; `Project.team`→`department`; flat member permissions + admin user-management; no email/password-reset service; many attachments per article; deactivate-never-delete users; build-on-server deploys; Caddy serves the SPA directly (no web/nginx container); scrypt not argon2; node:test + fetch, no new test frameworks; demo quirks (priority/color defaults) preserved; edit/delete UI is approved new scope.

## Reference — published diagram Artifacts

- Cloud Workspace Architecture: https://claude.ai/code/artifact/021c5bad-9829-47ea-b9a0-3d01640d79eb
- Legacy Reporting Landscape: https://claude.ai/code/artifact/85cbc406-d841-46a6-a3dd-941cd32d382d
- Cloud Cost Stack: https://claude.ai/code/artifact/c62b56a8-b7b2-4ba6-a483-4967aab4d736
- Deployment Workflow: https://claude.ai/code/artifact/a5b03eae-ca10-493d-91f7-699db272caa4
- Cost Data Medallion: https://claude.ai/code/artifact/d30a328d-e3c7-47d4-a12d-87ba8fdc8693
- Cloud Cost Pipeline: https://claude.ai/code/artifact/434b6865-272d-419f-8420-d7fb288816ae
- Cost Platform Integration: https://claude.ai/code/artifact/4996e2de-5197-455e-ab2e-3dd00c4396ad

Note: these diagrams predate the final design — the High-Level/Medallion/DP-integration ones illustrate an aspirational data stack (NiFi/MinIO/Trino), not the approved 4-service migration architecture. The Architecture diagram shows the OLD Vinext/Cloudflare shape. Regenerate after migration if they should reflect the new stack.
