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

---

## Task Operational Depth & Dynamic Workload — 2026-09-10

Branch `feat/task-depth-workload`. Task descriptions, shared slide-over TaskDrawer, and query-time dynamic workload derivation. Spec: `docs/superpowers/specs/2026-09-10-task-depth-dynamic-workload-design.md`, ADR: `docs/adr/0002-dynamic-workload-derivation.md`.

**Database Migration:**
- `20260910120000_task_description_and_dynamic_workload`: `ALTER TABLE "tasks" ADD COLUMN "description" TEXT NOT NULL DEFAULT ''; ALTER TABLE "users" DROP COLUMN "workload";`. Applied cleanly via `npx prisma migrate deploy`.

**Tests (all green):**
- api: `npm --prefix api test` → **35/35** pass (33 prior + dynamic workload derivation + task description validation/updating). Covers: dynamic workload derivation from active (non-Done) tasks (20% per task, max 100%, ignores Done tasks); task description create, patch, and length validation (<= 10,000 chars); Copilot snapshot incorporates task description notes and computed workload; `tsc -p tsconfig.json` build clean.
- web: `npm --prefix web test` → **10/10** pass (9 prior + `computeWorkload` pure helper); `tsc --noEmit` + `vite build` clean (2057 modules, dist emitted).

**UI Verification:**
- Shared slide-over `<TaskDrawer />` mounted in `App.tsx` and triggered on task clicking from Overview ("Your priorities"), Tasks (Kanban cards), and Project workspace (Gantt task rows).
- Member capacity percentages in Team and Overview derive reactively from in-memory active tasks, updating instantly upon task completion, reassignment, or addition.

---

## Actionable Copilot & Knowledge Hub Markdown — 2026-09-10

Branch `feat/actionable-copilot-knowledge-markdown`. Actionable Copilot (Phase 3) with interactive TaskDraftCard in chat, backend tool calling & entity resolution, Knowledge Hub full Markdown rendering (`react-markdown` + `remark-gfm`), syntax-highlighted code blocks with a one-click copy button, tabbed Write/Preview editor, instant search with term highlighting, and the "✨ Turn into tasks with Copilot" runbook bridge. Spec: `docs/superpowers/specs/2026-09-10-actionable-copilot-knowledge-markdown-design.md`, Plan: `docs/superpowers/plans/2026-09-10-actionable-copilot-knowledge-markdown.md`.

**Backend Enhancements & Tests:**
- `POST /api/tasks`: Added direct support and validation for `priority` on task creation.
- `api/src/copilot/gemini.ts`: Defined `draftTask` function declaration tool in `@google/genai` options; typed `TaskDraft`, `CopilotResult`, and backwards-compatible `AskLLM`.
- `api/src/routes/copilot.ts`: Resolved project name to `projectId` and owner name to active `ownerId` with fallback defaults; returned `{ answer, draftTask }`.
- Tests: `npm --prefix api test` → **37/37** pass (35 prior + priority creation + draftTask resolution).
- Build: `npm --prefix api run build` clean (`tsc -p tsconfig.json`).

**Web Enhancements & Tests:**
- `web/src/markdown-viewer.tsx`: Created GitHub-Flavored Markdown renderer (`react-markdown` + `remark-gfm`) with styled code blocks, language badge, and one-click Copy button.
- `web/src/lib/search.mjs`: Pure helpers `filterArticles`, `highlightMatches`, and `snippetWithMatch` with full unit test coverage.
- Tests: `npm --prefix web test` → **14/14** pass (10 prior + 4 search highlighting & snippet centering tests).
- Build: `npm --prefix web run build` clean (`tsc --noEmit` 0 errors, `vite build` emitted).

**UI Verification:**
- Interactive `<TaskDraftCard />` renders inside Copilot chat when Gemini proposes a task. User can review/adjust Project, Owner, Priority, Due Date, and click "Create Task" (human-in-the-loop).
- Knowledge Hub reader renders articles in rich Markdown with code blocks and copy buttons.
- "✨ Turn into tasks with Copilot" button in article reader converts runbook steps directly into task proposals.
- Create/Edit article dialog features Write (Markdown) and Preview tabs.
- Search bar highlights matched terms with `<mark className="search-highlight">` in article card titles and snippets in real-time.

---

## ISO 27001 & Bank of Thailand (BOT) Audit Compliance Management — 2026-09-10

Branch `feat/iso27001-bot-compliance-management`. IT Governance and Audit Readiness milestone covering direct project document evidence uploads (CRA, Architecture Diagram, RBAC Matrix, CC/CR, Test Evidence), Segregation of Duties (SoD) with a dedicated read-only `auditor` role, task-to-CR/CC change traceability, task-to-SOP runbook links, and a Central Compliance Matrix view.

**Design & Governance Records:**
- `CONTEXT.md`: Ubiquitous language extended for `auditor`, `Project document`, `Compliance matrix`, `Task SOP`, and `Change authorization`.
- ADRs:
  - `docs/adr/0003-auditor-role-for-iso27001-bot-compliance.md` (Read-only auditor role for SoD)
  - `docs/adr/0004-task-change-traceability-to-project-documents.md` (Deployment task change traceability)
  - `docs/adr/0005-project-document-deletion-governance.md` (Evidence deletion governance: uploader/admin only, blocked for auditors)
- Implementation Plan: `docs/superpowers/plans/2026-09-10-iso27001-bot-audit-compliance-management.md` (10 tasks executed via Multi-Agent SDLC loop in an isolated worktree).

**Database Migration & Schema:**
- Migration `20260910152826_iso27001_bot_audit_compliance`:
  - Created `project_documents` table with fields `id`, `project_id`, `stored_name`, `original_name`, `mime_type`, `size_bytes`, `category`, `reference_no`, `uploaded_by`, and `created_at`.
  - Added foreign keys and relations: `Task.sopArticleId`, `Task.changeDocumentId`, `KnowledgeArticle.projectId`, `User.projectDocuments`.
  - Seed script updated with demo compliance auditor (`auditor@cloudteam.internal`), seeded CRA/Diagram/CC documents, and deployment task traceability.

**Backend Implementation & Tests:**
- Middleware: Added `requireAuditorReadOnly` guard in `api/src/middleware.ts` mounted in `app.ts` after `/api/auth`. All mutations (POST, PUT, PATCH, DELETE) by users with `role === 'auditor'` return `403 Forbidden` with a standardized audit error message.
- Project Documents API (`api/src/routes/project-documents.ts`):
  - `GET /api/projects/:id/documents` & `GET /api/project-documents`: Filterable by category, includes uploader metadata.
  - `POST /api/projects/:id/documents`: Multipart upload up to 25MB with strict file extension allow-list (`.pdf`, `.xlsx`, `.docx`, `.png`, `.jpg`, `.svg`, etc.) and audit category assertion.
  - `GET /api/project-documents/:id/download`: Dispatches file with `Content-Disposition: attachment`.
  - `GET /api/project-documents/:id/preview`: In-browser streaming with `Content-Disposition: inline` and proper MIME types.
  - `DELETE /api/project-documents/:id`: Deletion governance (only uploader or admin; blocked for auditors and non-owner members).
- Task Audit Traceability (`api/src/routes/tasks.ts`): `POST` and `PATCH` accept and link `sopArticleId` and `changeDocumentId`; queries return full relations.
- Central Compliance Matrix API (`api/src/routes/compliance.ts`): `GET /api/compliance/matrix` calculates project readiness (CRA, Diagram, RBAC, CC, and deployment traceability), readiness percentages, and missing checkpoints.
- Tests: `npm --prefix api test` → **41/41 pass** (37 prior + auditor guard + project documents CRUD/preview/download/governance + task traceability + compliance matrix endpoint).
- Build: `npm --prefix api run build` clean (`tsc -p tsconfig.json`).

**Web Client Implementation & Tests:**
- `web/src/lib/types.ts`: Added `AuditCategory`, `ProjectDocument`, and task audit relation types.
- `web/src/lib/compliance.mjs` & `compliance.test.mjs`: Pure calculation library for ISO/BOT audit readiness with 100% test coverage (0%, 100%, and partial readiness).
- `web/src/project-documents.tsx`: Tabbed document view with filetype icons, category badges, upload modal (up to 25MB), in-browser previewer (PDF iframe, images), download, and role-guarded deletion.
- `web/src/compliance-matrix.tsx`: Central oversight table with KPI cards (total, ready, pending, avg score), checkpoint badges (CRA, Diagram, RBAC, CC, Deployment Traceability), search, department filter, and "View Audit Files" deep link.
- `web/src/task-drawer.tsx`: Added Change Authorization selector (CR/CC) with "Authorized by" badge and preview button; added SOP Runbook selector with "Read Runbook" link.
- `web/src/App.tsx`: Wired Compliance matrix in navigation, tab toggle in Project workspace (`[Tasks & Timeline] [Audit Documents (ISO/BOT)]`), and prominent top notice for auditors (`🛡️ Compliance Inspector Mode (Read-Only)`). Mutation buttons are hidden for auditors.
- Tests: `npm --prefix web test` → **19/19 pass** (14 prior + 5 pure compliance unit tests).
- Build: `npm --prefix web run build` clean (`tsc --noEmit` 0 errors, `vite build` emitted).

**Live Integration & Docker Verification (Stage 6):**
- `docker compose up -d --build`: Rebuilt and restarted all 4 containers (`postgres`, `api`, `caddy`, `backup`).
- Startup migration: Applied `20260910152826_iso27001_bot_audit_compliance` automatically on API container start.
- Container Health:
  - `cloud-team-management-api-1`: Up & healthy
  - `cloud-team-management-postgres-1`: Up & healthy
  - `cloud-team-management-caddy-1`: Up (HTTP/2 200, reverse proxy active)
  - `cloud-team-management-backup-1`: Up
- Live Endpoints: `https://localhost/api/health` returns HTTP/2 200 `{"ok":true}`.

---

## Gantt Interactive Drag-and-Drop & Expand-All Fix — 2026-09-11

**Scope:**
1. Fix Gantt Expand-all display bug where tasks below the viewport were clipped and hidden.
2. Phase summary bar timeline drag-and-drop: moving the summary bar shifts all tasks in that phase and updates start/date.
3. Task-to-phase drag-and-drop: dragging a task row into another phase updates its phase and synchronizes its timeline proportionally.
4. Phase reordering via header drag-and-drop.

**Key Changes:**
- `web/src/project-gantt.tsx`:
  - Replaced Base UI `<ScrollArea>` with high-performance native `<div className="gantt-scroll">` (`max-height: 720px; overflow: auto;`) allowing complete vertical and horizontal scrolling across all expanded phases with sticky column support (`.sticky-cell`).
  - Added `normalizePhase` and expanded `defaultPhases` (`Planning`, `Development`, `Testing`, `Launch`, `Audit`).
  - Implemented `startPhaseDrag` on summary bars with real-time multi-task preview and batch `onUpdate`.
  - Implemented HTML5 draggable on task rows and drop targets on phase headers and tracks (`handleMoveTaskToPhase`), shifting timeline dates automatically into the target phase.
  - Implemented phase reordering (`handleReorderPhase`).
- `web/src/lib/gantt.mjs`:
  - Exported `shiftPhaseTasks(phaseTasks, deltaDays)`, `normalizePhase(phase)`, `reorderPhases(list, source, target)`, and `moveTaskToPhaseWithTimeline(task, targetPhase, allTasks)`.
  - Resilient `schedule()` with date validation error boundaries.
- `web/src/lib/gantt.test.mjs`:
  - Added unit tests for `normalizePhase`, `reorderPhases`, `moveTaskToPhaseWithTimeline`, and `shiftPhaseTasks`.
- `web/src/globals.css`:
  - Added styles for `.phase-track.drop-target-track`, `.gantt-phase.drop-target`, and `.gantt-bar.summary.is-dragging`.

**Verification:**
- `npm --prefix web test`: **31/31 pass** (100% green).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `npm --prefix api run build`: Clean API compile (`tsc -p tsconfig.json` 0 errors).
- `docker compose up -d --build caddy`: Live container recreation and health check passed (`curl -sk https://localhost/api/health` -> `{"ok":true}`).

---

## Knowledge Hub Upgrade: Interactive HTML Pages, Dynamic Categories, Article Reader Dialog with Table of Contents (TOC), and Document Importer — 2026-09-11

**Scope:**
1. **Interactive HTML/CSS/JS Page Rendering:**
   - Added `format` column (`markdown` | `html`) to `KnowledgeArticle` in database.
   - Isolated, sandboxed `<iframe>` rendering (`sandbox="allow-scripts allow-downloads"`, explicitly omitting `allow-same-origin` to isolate tokens/cookies under ISO 27001 app security).
2. **Article Reader Dialog:**
   - Wide dual-column dialog (`92vw`, max `1280px`, `88vh`) with full-screen Maximize toggle (`100vw` / `100vh`).
   - Dynamic Table of Contents (TOC) with scrollspy active heading tracking and smooth scrolling.
   - Document metadata panel (author, estimated reading time, format badge, creation/update dates).
   - Embedded attachments and action controls.
3. **Dynamic Category Management:**
   - Created `KnowledgeCategory` Prisma model with `id`, `name`, `color`, `icon`.
   - API routes for category CRUD (`GET/POST/PATCH/DELETE /api/knowledge/categories`).
   - Category deletion safeguard (blocks deletion if any article is using that category).
   - Role-based protection (auditor blocked with 403 Forbidden).
   - Seeded default categories (`Runbooks`, `Onboarding`, `Guides`, `Meeting notes`, `Architecture`, `Interactive Pages`).
4. **Document Importer & Formatting Toolbar:**
   - Import `.md`, `.html`, `.txt` files directly into the editor with auto format detection and title extraction.
   - Formatting toolbar with quick actions (H1-H3, Bold, Italic, Code, List, Table, Callout) and tabbed Write/Preview.
5. **Auditor Role Guards (ISO 27001 / BOT SoD):**
   - Hides "Edit", "Delete", "Manage categories", and file import from `auditor` role.

**Verification Evidence:**
- `npm --prefix web test`: **37/37 pass** (100% green, including 5 new tests for TOC extraction, reading time estimation, slugify, and document importer).
- `npm --prefix api test`: **43/43 pass** (100% green, including new suites for category CRUD, auditor protection, article format support, and deletion safeguards).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `npm --prefix api run build`: Clean production compile (`tsc -p tsconfig.json` 0 errors).
- `docker compose up -d --build`: Docker containers `cloud-team-management-api-1` and `cloud-team-management-caddy-1` rebuilt and healthy, database migration deployed.
- Live endpoint check: `curl -k https://localhost/api/health` -> `{"ok":true}`.



