# Handoff — Platform Migration (paused before implementation)

**Date:** 2026-09-07 · **Status:** Design + plan approved and committed. **Zero application code changed yet** — the original Vinext demo app is intact and still runs.

**TL;DR (ไทย):** ออกแบบและวางแผนการย้ายระบบไป self-hosted Docker เสร็จสมบูรณ์แล้ว (spec + plan 18 tasks อยู่ใน git) ยังไม่ได้เริ่มเขียนโค้ดแม้แต่บรรทัดเดียว กลับมาเมื่อไหร่ให้เริ่มรัน Task 1 ตามไฟล์ plan ได้เลย

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
