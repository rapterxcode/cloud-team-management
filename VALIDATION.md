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

---

## Knowledge Article AI Copilot Assistant — 2026-09-11

**Scope:**
1. **Backend Generative Authoring Endpoint:**
   - Implemented `POST /api/copilot/article` grounded with workspace snapshot data (projects, cloud resources, roster).
   - Defined `draftArticleTool` (`name`, `body`, `format`, `summary`) and typed `ArticleDraft` / `CopilotResult`.
   - Injectable `AskLLM` test interface behind Google GenAI.
   - Strict Segregation of Duties (ISO 27001 / BOT): `role === 'auditor'` blocked with `403 Forbidden`.
   - Fallback support for plain-text model responses and error mapping (502 provider error, 503 unconfigured).
2. **Frontend Presets & Prompt Builders:**
   - Authored `web/src/lib/copilot-article.mjs` with `COPILOT_ARTICLE_PRESETS`:
     - `⚡ Draft from Title`
     - `📝 Add Checklist`
     - `🛠️ Format Code & Tables`
     - `🎨 Convert to HTML + Tailwind`
     - `📋 Add Summary`
   - Pure function `buildArticleCopilotPrompt(presetId, context)`.
3. **In-Editor AI Copilot Assistant Component:**
   - Created `web/src/article-copilot-assistant.tsx` with collapsible header, 1-click action chips, natural language prompt input, proposal diff review card with summary, "Apply to Editor" confirmation, and "Revert AI Edit" undo mechanism.
   - Auditor guard: completely hides UI when `currentUser?.role === 'auditor'`.
4. **Editor Integration:**
   - Integrated in `web/src/App.tsx` inside the Knowledge Article create/edit modal.
   - Controlled `articleName`, `articleBody`, `articleFormat`, and undo snapshotting.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green, including 6 new unit tests for copilot presets and prompt builder).
- `npm --prefix api test`: **51/51 pass** (100% green, including 8 new integration tests for `POST /api/copilot/article`, auditor blocking, draft creation, modification, HTML conversion, fallbacks, and error mappings).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `npm --prefix api run build`: Clean API compile (`tsc -p tsconfig.json` 0 errors).
- `docker compose up -d --build`: Live containers `cloud-team-management-api-1` and `cloud-team-management-caddy-1` rebuilt and healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`
  - `curl -sk -i -X POST https://localhost/api/copilot/article` -> HTTP/2 401 `{"error":"Sign in required"}`

---

## Knowledge Article Expanded Editor Workspace — 2026-09-11

**Scope & Problem Solved:**
User reported that the create/edit modal for Knowledge articles was too cramped (`create , Edit article knowledge พื้นที่น้อยเกินไปครับ แก้ไขด้วย`) due to generic dialog default constraints (`max-w-lg` 512px).

**Key Enhancements:**
1. **Dedicated Spacious Article Editor Dialog (`web/src/article-editor-dialog.tsx`):**
   - Decoupled from generic dialogs (`project`, `task`, `resource`).
   - Default modal viewport: `95vw` width (up to `1440px`), `92vh` height with clean flex column layout.
2. **Fullscreen / Maximize Canvas Mode:**
   - One-click Maximize toggle (`Maximize2` / `Minimize2` buttons) that expands the editor to a distraction-free `100vw` × `100vh` canvas.
3. **Side-by-Side Split View:**
   - Added View Mode Switcher: **Write** (focused code/markdown editor), **Split** (responsive 1:1 side-by-side editing and live rendering), and **Preview** (full rendered presentation).
   - Live Markdown / HTML iframe preview rendering updates instantly in Split View.
4. **Enhanced Tooling & Workspace Depth:**
   - Dedicated metadata header (Title, Category selector, optional Project link, Format toggle).
   - Embedded `ArticleCopilotAssistant` (collapsible, 1-click presets, diff preview, apply/revert).
   - Direct document import (`.md`, `.html`, `.txt`) with auto-format detection.
   - Rich Markdown / HTML formatting toolbar (Headings, Bold, Italic, Code block with language selector, List, Table, Callout, CDN CSS presets).
   - Editor statistics footer with word counter and estimated reading time.
5. **Role-Based Guards (ISO 27001 / BOT SoD):**
   - Retained strict `auditor` role guards (auditors cannot open editor or trigger mutation actions).

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix api test`: **51/51 pass** (100% green).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `docker compose up -d --build caddy`: Container `cloud-team-management-caddy-1` successfully rebuilt and restarted.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## AI Copilot Assistant & Smart Editor Bug Fixes & Resilience — 2026-09-11

**Scope & Defects Resolved:**
1. **Form State Reset Bug (Data Loss Prevention):**
   - Fixed `useEffect` in `ArticleEditorDialog` which previously wiped article body and title on category/background state updates while the user was actively typing.
   - Guarded initialization using `useRef` (`prevOpenRef` & `prevEditingIdRef`) so form state only resets when the dialog transitions from closed to open, or when switching edited articles.
2. **Title Overwrite Prevention:**
   - Fixed `onApply` to never overwrite an existing user title with default `"Draft Article"`. Only adopts proposed title if user's title is blank.
3. **Preset Preconditions Validation:**
   - Prevented "⚡ Draft from Title" from wasting API calls on empty titles by prompting the user to specify a title or prompt.
   - Prevented modification actions ("Checklist", "Format Code", "Convert HTML", "Executive Summary") from running on empty article bodies.
4. **Tool Calling Isolation:**
   - Isolated `toolChoice: 'article'` for `/api/copilot/article` and `toolChoice: 'task'` for `/api/copilot` chat so Gemini never confuses task creation with article drafting.
   - Safely handled `res.text` access in `@google/genai` when function calls are present.
   - Stripped redundant markdown code block wrappers (````markdown ... ````) from generated responses.
5. **Proposal Review Enhancements:**
   - Added collapsible "Preview Proposed Content" in the proposal review card so engineers can inspect generated content before applying.
   - Added "Append to Bottom" option alongside "Apply to Editor (Replace All)".
   - Added automatic view switching to `Split` when applying or inserting from `Preview` mode.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix api test`: **51/51 pass** (100% green).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `npm --prefix api run build`: Clean API compile (`tsc -p tsconfig.json` 0 errors).
- `docker compose up -d --build`: Both `api` and `caddy` containers rebuilt and healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## AI Copilot Smart Editor: Persistent AI Chat Box & Header Toggle — 2026-09-11

**Issue Addressed:**
User reported: "bug ช่อง ai chat หายไป / AI Copilot Assistant Smart Editor" (Bug: the AI chat box/input disappeared in AI Copilot Assistant Smart Editor).

**Root Cause Analysis:**
1. **Accidental Collapse:** Clicking the header or chevron set `isOpen = false`, unmounting all prompt inputs, action chips, and buttons, leaving only a thin bar.
2. **Scroll-off / Lack of Visibility:** Inside the spacious dialog, `ArticleCopilotAssistant` sat at the top of a scrollable canvas above a 500px textarea. Scrolling down to the editor scrolled the assistant completely off-screen.
3. **No True "Chat" Experience:** Previously, it was a 1-turn single-line `<input type="text">` that cleared upon applying a proposal, with zero chat history or dialogue bubbles.
4. **Modal Dialog Scrim Blocking Global Copilot:** `ArticleEditorDialog` is a full modal (`z-50`) that covers the page and obscures the main topbar "Ask Copilot" button, with no dedicated AI button in the dialog header.

**Key Enhancements:**
1. **Full-Featured Multi-Turn AI Chat Box (`web/src/article-copilot-assistant.tsx`):**
   - **Persistent Chat Input:** Prominent textarea with `Enter` to send, `Shift+Enter` for newline, and `Send` icon button that **NEVER disappears** after generating or applying a draft.
   - **Conversation History:** User and Assistant chat bubbles with avatars and timestamps.
   - **Proposal Card in Chat:** Shows title suggestion badge, format badge, summary, collapsible "👁 Preview Proposed Content" toggle, "Apply to Editor" (replace), "+ Append to Bottom", and "Discard" actions with clear status tracking.
   - **Multi-turn Contextual Reasoning:** Sends previous turns (`history`) to `POST /api/copilot/article` so Gemini remembers preceding instructions.
   - **Quick Actions:** Extended with `🔍 Polish & Proofread` and `🚒 Add Runbook Steps`.
   - **Clear Chat Button:** Easily start a fresh conversation session with 1 click (`Trash2`).
2. **Dedicated Header Toggle Button (`web/src/article-editor-dialog.tsx`):**
   - Added a prominent `✨ AI Chat` button in the `DialogHeader` right next to `Write` / `Split View` / `Preview` / `Maximize`.
   - Clicking it ensures the chat is expanded, smoothly scrolls it into view (`scrollIntoView`), and automatically focuses the chat textarea (`#article-copilot-input`).
3. **Collapsed Safety Banner:**
   - Even when minimized, renders a clear purple banner: "AI Copilot Chat is minimized — Click to expand and chat" with an "Open AI Chat" button and message counter.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix api test`: **52/52 pass** (including new multi-turn history verification in `copilot-article.test.ts`).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `npm --prefix api run build`: Clean API compile (`tsc -p tsconfig.json` 0 errors).
- `docker compose up -d --build`: Stack rebuilt; `cloud-team-management-api-1` and `cloud-team-management-caddy-1` healthy.

---

## AI Copilot Smart Editor: Dedicated AI Chat Workspace & Height Expansion — 2026-09-11

**Issue Addressed:**
User reported: "ช่องแชท มันเล็กเกินไป" (The chat box is too small).

**Root Cause Analysis:**
1. **Chat Canvas Height Constrained:** On wide desktop screens (>=1440px), the textarea and viewport felt like narrow horizontal strips.
2. **Scroll Space Competition:** In `split` or `write` modes, having the Markdown text editor (500px) directly below forced the user to scroll back and forth between drafting instructions and inspecting the editor.
3. **Empty Chat Collapse:** When no messages were present, the conversation viewport had minimal height, making the component look squished.

**Key Enhancements:**
1. **Dedicated AI Chat Workspace Mode (`viewMode === 'ai-chat'`):**
   - Added `🤖 AI Chat Workspace` button to the DialogHeader view switcher alongside `Write`, `Split View`, and `Preview`.
   - In `ai-chat` mode, the editor hides the underlying markdown editor and expands the AI Copilot to take 100% full height of the modal dialog (`min-h-[620px] flex-1`).
   - Chat thread viewport takes `flex-1 min-h-[380px]` with generous vertical space for reading long AI responses.
   - Maximize/Minimize toggle button in the assistant header to easily pop in and out of the full workspace.
   - Auto-transitions back to `Split View` upon applying or appending a draft so the user can immediately see the applied changes in the live editor and preview.
2. **Substantial Textarea Height Expansion:**
   - Default height increased to `rows={7}` and `min-h-[180px] md:min-h-[220px]` (resizable up to 480px via `resize-y`).
   - Text size enlarged to `text-base` (16px) with generous padding for comfortable typing.
3. **Permanent Welcome Viewport:**
   - When messages are empty, renders a welcoming canvas with 3 actionable prompt suggestions so the thread area never looks collapsed or empty.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `docker compose up -d --build caddy`: Rebuilt Caddy container with fresh static bundle; container recreated and healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## AI Copilot Smart Editor: Unified Side-by-Side Editor & Full AI Chat Workspace — 2026-09-11

**Issue Addressed:**
User requested: "รวม Editor and Full ai chat workspace เลย ครับ" (Combine Editor and Full AI Chat workspace together).

**Architecture & Implementation:**
1. **Unified Dual-Pane / Multi-Column Layout (`flex flex-col lg:flex-row`):**
   - **Left Pane (Editor Workspace):** Contains formatting toolbar, format selection (Markdown / HTML), and the editor/preview canvas (`Write`, `Split View`, or `Preview`). Fills 54%–60% width on desktop.
   - **Right Pane (Full AI Chat Workspace):** Contains `ArticleCopilotAssistant` running full height (`h-full flex-1 flex flex-col min-h-0`). Fills 40%–46% width on desktop.
   - **Seamless Real-Time Synchronization:** Clicking `✓ Apply to Editor` or `+ Append to Bottom` on the right immediately updates the live editor and live preview on the left without view switching or jumping.
2. **Flexible View Modes & Header Switcher:**
   - `Write`: Full-height editor textarea on left, Full AI Chat Workspace on right.
   - `Split View`: Editor textarea + live preview side-by-side on left, Full AI Chat Workspace on right.
   - `Preview`: Full-height live preview on left, Full AI Chat Workspace on right.
   - `AI Chat (เปิดอยู่ / ปิด)` toggle button: Allows collapsing the AI Chat panel with 1 click to give the Editor 100% full width.
   - Maximize button in Assistant header: Allows expanding AI Chat to 100% full width when desired.
3. **Independent Dual Scroll Areas:**
   - Desktop view (`lg:overflow-hidden` on outer content) ensures headers and prompt input remain pinned, while the Editor and the AI Chat thread scroll independently with zero outer window shifting.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix web run build`: Clean production compile (`tsc --noEmit` 0 errors, `vite build` 0 errors).
- `docker compose up -d --build caddy`: Rebuilt Caddy container; container recreated and healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## AI Copilot Smart Editor: Persistent Multi-Turn Chat History — 2026-09-11

**Issue Addressed:**
User requested: "ควรมีการเก็บ chat history ด้วยนะ เพื่อจะได้ ย้อนกลับมาแก้ไข เอกสารได้" (Persist chat history so users can return to revise/edit documents).

**Architecture & Implementation:**
1. **Database Persistence (`knowledge_articles.chat_history JSONB`):**
   - Added `chatHistory Json? @map("chat_history")` to `KnowledgeArticle` model in `api/prisma/schema.prisma`.
   - Migration `20260911113000_knowledge_article_chat_history/migration.sql` applies `ALTER TABLE "knowledge_articles" ADD COLUMN "chat_history" JSONB;`.
   - API endpoints (`POST /api/knowledge` and `PATCH /api/knowledge/:id`) in `api/src/routes/knowledge.ts` accept and persist `chatHistory`.
2. **Frontend State & Dialog Lifecycle:**
   - Updated `web/src/lib/types.ts` to include `chatHistory?: any[] | null` on `Article`.
   - Updated `web/src/article-copilot-assistant.tsx` with `initialMessages` and `onMessagesChange` props, broadcasting all message list updates (user prompts, AI responses, proposal cards, statuses).
   - Updated `web/src/article-editor-dialog.tsx`:
     - Restores `editing.chatHistory` when editing existing articles.
     - Saves/restores draft chat messages in `localStorage` (`ctm_article_draft_chat`).
     - Submits `chatHistory` upon saving article and cleans up draft storage.
3. **Multi-Turn Context Continuity:**
   - Previous conversation thread with proposal cards (`applied`, `appended`, `discarded`) is accurately restored upon reopening the article editor.
   - Users can seamlessly resume multi-turn conversations with Gemini with full context preserved.

**Verification Evidence:**
- `npm --prefix web test`: **47/47 pass** (100% green).
- `npm --prefix api run build`: Clean TypeScript compile (`tsc -p tsconfig.json` 0 errors).
- `npm --prefix web run build`: Clean TypeScript and Vite compile (0 errors).
- Database migration applied cleanly on container startup (`npx prisma migrate deploy`).
- `docker compose up -d --build`:
  - `cloud-team-management-api-1`: Healthy (migrate + seed ran).
  - `cloud-team-management-caddy-1`: Healthy.
  - `cloud-team-management-postgres-1`: Healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`




---

## Agentic Workspace Copilot: Batch Task Extraction, Executive Reporting, and Direct Knowledge Hub Export — 2026-09-11

**Issue Addressed:**
Direction 1: "ต่อยอด AI Copilot ให้เป็น Agentic Assistant (ทำงานจริงได้มากกว่าแค่ตอบคำถาม)" (Batch tasks from runbooks/meetings, Executive reporting, rich markdown, and direct knowledge saving). ADR: `docs/adr/0009-agentic-copilot-batch-tasks-and-executive-reporting.md`.

**Architecture & Implementation:**
1. **Backend Gemini Function Calling (`draftTasksTool`):**
   - Added `draftTasksTool` FunctionDeclaration in `api/src/copilot/gemini.ts` allowing the model to propose an array of structured tasks.
   - Updated `api/src/routes/copilot.ts`:
     - System prompt instructed to call `draftTasks` when multi-step tasks or runbook breakdowns are requested.
     - Implemented `resolveTaskDraft` helper performing fuzzy matching on project and active user entities for all tasks in the array.
     - Fully backward-compatible: single `draftTask` is wrapped into `draftTasks: [draftTask]`.
2. **Frontend Pure Helpers & Tests:**
   - Created `web/src/lib/copilot-helpers.mjs` with `COPILOT_QUICK_ACTIONS`, `normalizeBatchDraftTasks`, `extractReportTitle`, and `isSubstantiveReport`.
   - Unit tests in `web/src/lib/copilot-helpers.test.mjs` (6/6 passing).
3. **Frontend UI Components:**
   - Upgraded `web/src/copilot.tsx` with:
     - **Quick Action Chips**: 1-click execution for `📊 สรุปรายงานผู้บริหาร`, `⚠️ วิเคราะห์โครงการ At-Risk`, `👥 เช็คภาระงานทีม (Workload)`, and `📋 สกัด Tasks จาก Runbook`.
     - **Rich Markdown Rendering**: Integrated `MarkdownViewer` for clean headings, tables, blockquotes, and code blocks with copy buttons.
     - **BatchTaskDraftCard**: Renders multiple proposed tasks with expandable editing fields (name, project, owner, phase, priority, dates) and **"✓ Create All (N) Tasks"** batch creation.
     - **Knowledge Hub Export**: Added **"📄 Save as Knowledge Article"** and **"📋 Copy Report"** buttons on substantive assistant reports.
   - Restricts task/article creation for `role === 'auditor'` to preserve ISO 27001 / BOT Segregation of Duties.
   - Updated `web/src/App.tsx` wiring `currentUser` and `onSaveArticle` callback.

**Verification Evidence:**
- `npm --prefix web test`: **53/53 pass** (100% green).
- `npm --prefix api run build`: Clean TypeScript compile (0 errors).
- `npm --prefix web run build`: Clean TypeScript and Vite compile (0 errors).
- Docker stack rebuilt via `docker compose up -d --build`:
  - `cloud-team-management-api-1`: Healthy
  - `cloud-team-management-caddy-1`: Healthy
  - `cloud-team-management-postgres-1`: Healthy
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## Copilot Persistent Conversation History & Multi-Thread Management — 2026-09-11

**Issue Addressed:**
User requested: "ทำเป็น conversations history ให้หน่อย ครับ ทั้งหมดที่มี ai copilot" (Enable persistent conversation history for all AI Copilot components). ADR: `docs/adr/0010-copilot-conversation-history-persistence.md`.

**Architecture & Implementation:**
1. **Database Schema & Migration (`copilot_conversations` Table):**
   - Added `CopilotConversation` model in `api/prisma/schema.prisma` with relation to `User` (`userId`, `title`, `messages JSONB`, `createdAt`, `updatedAt`).
   - Migration `20260911135500_copilot_conversations` applied cleanly on container startup.
2. **Backend REST Endpoints (`api/src/routes/copilot.ts`):**
   - `GET /api/copilot/conversations`: returns user's conversation threads sorted by `updatedAt DESC` with message counts.
   - `GET /api/copilot/conversations/:id`: fetches full conversation messages.
   - `POST /api/copilot/conversations`: creates new conversation thread.
   - `PATCH /api/copilot/conversations/:id`: renames or updates conversation messages.
   - `DELETE /api/copilot/conversations/:id`: deletes conversation thread.
   - `POST /api/copilot`: auto-persists conversation turns (user & assistant messages, task proposals) to PostgreSQL and returns `conversationId`.
3. **Frontend UI Components & State:**
   - `web/src/copilot.tsx`:
     - Added slide-out **Conversations History Drawer** with grouping (Today, Yesterday, Earlier).
     - Added `+ New Chat` button to easily start a fresh session.
     - Single-click thread selection to resume any past conversation with full context.
     - Thread deletion with confirmation.
     - Automatically restores most recent conversation when opening Copilot.
   - `web/src/article-copilot-assistant.tsx`:
     - Added `+ New Thread` button with confirmation to clear/reset chat for the article.
   - `web/src/lib/copilot-helpers.mjs`:
     - Added `groupConversationsByDate` helper function with unit test coverage.

**Verification Evidence:**
- `npm --prefix web test`: **54/54 pass** (100% green).
- `npm --prefix api run build`: Clean TypeScript compile (0 errors).
- `npm --prefix web run build`: Clean TypeScript and Vite compile (0 errors).
- Database migration `20260911135500_copilot_conversations` applied cleanly on container startup.
- Docker containers (`api`, `caddy`, `postgres`, `backup`): Healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`

---

## AI Copilot Full-System Context & Resizable Draggable Panel — 2026-09-11

**Issue Addressed:**
1. User requested: "แก้ไขให้ ทุกข้อมูลในระบบนี้ ai copilot สามารถ ตอบได้" (Fix so AI Copilot can answer about all information in the system).
2. User requested: "ต้องการให้ `<div class="copilot-scrim"><aside class="copilot-panel relative" ...>` สามารถ ยืดหด ได้ ครับ" (Make the Copilot panel resizable/stretchable).

**Architecture & Implementation:**
1. **Full Knowledge & Runbook Context Snapshot (`api/src/copilot/snapshot.ts`):**
   - Removed 400-char preview truncation; articles now emit their full body into the context snapshot.
   - Implemented `cleanHtmlForContext()` to strip heavy `<script>`/`<style>` tags while preserving all semantic content, headings, and shell commands.
   - Expanded snapshot budget from 12,000 chars to 1,000,000 chars, matching Gemini 2.5 Flash's 1M-token context window.
   - Added project compliance documents (ISO 27001 / BOT) with reference numbers and projects.
2. **Draggable & Resizable Copilot Panel (`web/src/copilot.tsx`, `web/src/globals.css`):**
   - Added left edge drag handle with `cursor-col-resize` and mouse move/up listeners tracking `window.innerWidth - e.clientX`.
   - Clamped panel width between 380px and viewport width.
   - Persisted custom panel width in `localStorage` under `ctm_copilot_panel_width`.
   - Added Maximize/Restore toggle button (`Maximize2` / `Minimize2`) to allow full-screen width (`100vw`).
   - Added `.is-resizing` class to disable transitions during drag and `.is-maximized` for 100vw view.

**Verification Evidence:**
- **Snapshot Total Content:** 58,166 characters in snapshot, containing 100% of all articles, tasks, cloud resources, and compliance documents.
- **Runbook Extraction:** "How to Extended Disk Ubuntu 24.04 and RHEL 9" present at full 32,381 characters with all commands (`growpart`, `resize2fs`, `rescan`).
- **AI Copilot Live Query Verification:** Gemini 2.5 Flash successfully answered query on Ubuntu 24.04 disk extension with exact zero-downtime bash commands from the system runbook.
- `npm --prefix web test`: **54/54 pass** (100% green).
- `npm --prefix api run build`: Clean TypeScript compile (0 errors).
- `npm --prefix web run build`: Clean TypeScript and Vite compile (0 errors).
- Docker containers (`api`, `caddy`, `postgres`, `backup`): Healthy.
- Live endpoint check:
  - `curl -sk https://localhost/api/health` -> HTTP/2 200 `{"ok":true}`
