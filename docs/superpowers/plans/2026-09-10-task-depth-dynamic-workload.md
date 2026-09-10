# Task Operational Depth & Dynamic Workload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen task operational capability by adding task descriptions, a shared slide-over Task Detail Drawer across Kanban/Gantt/Overview, and replacing the static user workload with dynamic derivation from active, incomplete tasks (20% per task, capped at 100%).

**Architecture:** Add `description` to `Task` and drop `workload` from `User` in PostgreSQL/Prisma. `GET /users` and Copilot snapshot derive workload at query time (ADR-0002). The web frontend computes workload reactively using a pure helper `computeWorkload(tasks, userId)` and mounts `<TaskDrawer />` for full task reading and editing. Spec: `docs/superpowers/specs/2026-09-10-task-depth-dynamic-workload-design.md`.

**Tech Stack:** Express 5 + Prisma (existing api/), React 19 SPA (existing web/), node:test + fetch.

## Global Constraints

- Database migration: single clean migration adding `tasks.description` and dropping `users.workload`.
- Workload derivation: 20% per active (status != 'Done') task owned by the user, capped at 100%. Derived dynamically, no stored counter.
- Task description: plain text with whitespace preservation (`white-space: pre-wrap; font-family: inherit;`), max 10,000 chars, zero new dependencies.
- Drawer save behavior: explicit form with "Save changes" button sending single `PATCH /tasks/:id`, plus quick "Complete task" and "Delete task".
- Tests: API tests hit real test Postgres; web tests run `node --test src/lib/*.test.mjs`.
- Start from a clean branch: `git checkout -b feat/task-depth-workload`.
- Commit after each task.

## File Structure (end state)

```
api/prisma/
  schema.prisma                  # (modify) Task.description added, User.workload removed
  seed.ts                        # (modify) remove workload from seed users, add descriptions to seed tasks
  migrations/                    # (new) migration SQL adding description, dropping workload
api/src/routes/
  users.ts                       # (modify) GET /users derives workload from active task count; remove workload params
  tasks.ts                       # (modify) POST /tasks and PATCH /tasks/:id accept description
  auth.ts                        # (modify) GET /auth/me derives workload or omits
api/src/copilot/
  snapshot.ts                    # (modify) derive user workload dynamically from active tasks
api/test/
  users.test.ts                  # (modify/add) test dynamic workload derivation
  tasks.test.ts                  # (modify/add) test task description create and patch
  copilot-snapshot.test.ts       # (modify) update user fixture without workload column
web/src/lib/
  workspace.mjs                  # (modify) add computeWorkload(tasks, userId)
  workspace.test.mjs             # (modify) unit tests for computeWorkload
  types.ts                       # (modify) add description to Task and ApiTask
web/src/
  task-drawer.tsx                # (create) slide-over TaskDetail drawer component
  App.tsx                        # (modify) wire task selection across Kanban/Gantt/Overview, reactive workload
  globals.css                    # (modify) task drawer slide-over styles
VALIDATION.md                    # (modify) append validation evidence
```

---

### Task 1: Prisma Schema Migration & Seed Update

**Files:**
- Modify: `api/prisma/schema.prisma`
- Modify: `api/prisma/seed.ts`
- Create: `api/prisma/migrations/..._task_description_and_dynamic_workload/migration.sql`

- [ ] **Step 1: Update schema.prisma**
  - Add `description String @default("")` to `Task`.
  - Remove `workload Int @default(0)` from `User`.

- [ ] **Step 2: Run migration against test database**
  - Run `npx prisma migrate dev --name task_description_and_dynamic_workload` from `api/`.
  - Verify migration generates cleanly.

- [ ] **Step 3: Update seed.ts**
  - Remove `workload: ...` from seeded demo users.
  - Add sample `description` notes to seeded tasks.
  - Run `npx prisma db seed` to verify seed passes.

- [ ] **Step 4: Commit**
  - `git commit -am "feat(db): add task description and drop user workload column"`

---

### Task 2: Backend API: Dynamic Workload & Task Description

**Files:**
- Modify: `api/src/routes/users.ts`
- Modify: `api/src/routes/tasks.ts`
- Modify: `api/src/copilot/snapshot.ts`
- Modify: `api/test/users.test.ts`
- Modify: `api/test/tasks.test.ts`
- Modify: `api/test/copilot-snapshot.test.ts`

- [ ] **Step 1: Write failing tests for dynamic workload & task description**
  - In `api/test/users.test.ts`: test that `GET /users` returns `workload: 0` for a user with 0 tasks, `workload: 40` for 2 active tasks, `workload: 20` when 1 of 2 is 'Done', and caps at 100 for 5+ tasks.
  - In `api/test/tasks.test.ts`: test that `POST /tasks` accepts and returns `description`, `PATCH /tasks/:id` updates `description`, and `description > 10000` returns 400.
  - Run `npm --prefix api test` and observe RED.

- [ ] **Step 2: Implement dynamic workload in users.ts**
  - In `users.ts`, query users with `_count: { select: { tasks: { where: { status: { not: 'Done' } } } } }`.
  - Map users to `{ ...u, workload: Math.min(100, (u._count?.tasks ?? 0) * 20) }`.
  - Remove `workload` from `POST` and `PATCH`.

- [ ] **Step 3: Implement task description in tasks.ts**
  - In `tasks.ts`, validate `description` (if provided, must be string <= 10000 chars).
  - Include `description` in `POST /tasks` data.
  - Allow `description` in `PATCH /tasks/:id` data.

- [ ] **Step 4: Update copilot snapshot and fix fixture references**
  - In `api/src/copilot/snapshot.ts`, query user active tasks count to format `(workload X%)`.
  - In `api/test/copilot-snapshot.test.ts`, remove `workload` column from `prisma.user.create` fixture.

- [ ] **Step 5: Run tests and verify GREEN**
  - Run `npm --prefix api test` (all 33+ tests pass).
  - Run `npm --prefix api run build` (`tsc` clean).

- [ ] **Step 6: Commit**
  - `git commit -am "feat(api): derive dynamic workload on users and add task description"`

---

### Task 3: Web Library: Pure Dynamic Workload Helper & Unit Tests

**Files:**
- Modify: `web/src/lib/workspace.mjs`
- Modify: `web/src/lib/workspace.test.mjs`
- Modify: `web/src/lib/types.ts`

- [ ] **Step 1: Write unit tests for computeWorkload**
  - In `web/src/lib/workspace.test.mjs`:
    - test `computeWorkload(tasks, userId)` with 0 tasks returns 0.
    - test with 2 'To do' tasks returns 40.
    - test with 1 'To do' and 1 'Done' returns 20.
    - test with 6 active tasks returns 100 (capped).
  - Run `node --test src/lib/workspace.test.mjs` and observe failure.

- [ ] **Step 2: Implement computeWorkload in workspace.mjs**
  - Export `computeWorkload(tasks, userId)`.
  - Update `types.ts` to add `description: string` to `Task` and `ApiTask`.

- [ ] **Step 3: Verify tests pass**
  - Run `npm --prefix web test` → all tests pass.

- [ ] **Step 4: Commit**
  - `git commit -am "feat(web): add computeWorkload pure helper and update task types"`

---

### Task 4: Web UI: Task Detail Drawer Component & Styling

**Files:**
- Create: `web/src/task-drawer.tsx`
- Modify: `web/src/globals.css`

- [ ] **Step 1: Create TaskDrawer component**
  - Props: `task: Task | null`, `open: boolean`, `onClose: () => void`, `projects: Project[]`, `owners: { id: string; name: string }[]`, `onUpdate: (id: string, changes: Record<string, unknown>) => Promise<void>`, `onDelete: (id: string) => Promise<void>`.
  - Slide-over right drawer (consistent with `CopilotPanel`).
  - Header: task title, project name badge, status badge, close button.
  - Form:
    - Name input.
    - Project select, Owner select (active users), Status select, Phase select, Priority select.
    - Start date and Finish date inputs (`type="date"`).
    - Description textarea with `white-space: pre-wrap; font-family: inherit;` and placeholder "Add detailed notes, checklists or runbooks for this task...".
    - Buttons: "Save changes" (submits form), "Complete task" (one-click finish if not Done), "Delete task" (with confirmation).

- [ ] **Step 2: Add CSS styles in globals.css**
  - Add styles for `.task-drawer`, `.drawer-scrim`, textarea, and layout controls.

- [ ] **Step 3: Verify build**
  - Run `npm --prefix web run build`.

- [ ] **Step 4: Commit**
  - `git commit -am "feat(web): create TaskDrawer slide-over component and styles"`

---

### Task 5: Web UI: Integrate TaskDrawer & Reactive Workload in App.tsx

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/project-gantt.tsx` (if needed for row click callback)

- [ ] **Step 1: Wire selectedTask state and open TaskDrawer**
  - In `App.tsx`, add `const [selectedTask, setSelectedTask] = useState<Task | null>(null);`.
  - Mount `<TaskDrawer />` in `App.tsx`.
  - In `view === 'Tasks'` (Kanban board): clicking a task card sets `setSelectedTask(t)`.
  - In `view === 'Project workspace'` (Gantt): clicking a task row or detail action sets `setSelectedTask(t)`.
  - In `view === 'Overview'` (Priorities panel): clicking a task row sets `setSelectedTask(t)`.

- [ ] **Step 2: Wire reactive workload derivation**
  - In `App.tsx`, derive member workload:
    `const members = users.map(u => [u.name, u.title, initials(u.name), computeWorkload(tasks, u.id)] as const);`
  - When tasks are created, finished, edited, or deleted, `members` workload automatically recalculates instantly without server round-trips.

- [ ] **Step 3: Verify web tests and build**
  - Run `npm --prefix web test`.
  - Run `npm --prefix web run build`.

- [ ] **Step 4: Commit**
  - `git commit -am "feat(web): wire TaskDrawer into Kanban, Gantt, Overview and reactive workload"`

---

### Task 6: End-to-End Verification & Validation Evidence

**Files:**
- Modify: `VALIDATION.md`

- [ ] **Step 1: Run full test suites**
  - `npm --prefix api test` (must pass 100%).
  - `npm --prefix web test` (must pass 100%).
  - `npm --prefix web run build` (tsc + vite build clean).

- [ ] **Step 2: Append evidence to VALIDATION.md**
  - Record the test results, observable seams, schema changes, and verification data.

- [ ] **Step 3: Commit and review**
  - `git commit -am "docs: log validation evidence for task operational depth & dynamic workload"`
