# Task Operational Depth & Dynamic Workload — Design

**Date:** 2026-09-10  
**Scope type:** feature  
**Status:** approved by owner  
**Depends on:** platform migration (Phase 1) and AI Copilot (Phase 2), now on `main`.

## Goal

Deepen task management across Cloud Team Management by:
1. Adding a `description` field to `Task` and providing a shared, slide-over Task Detail Drawer accessible from the Kanban board, Gantt timeline, and Overview priorities.
2. Replacing the static `User.workload` integer with dynamic derivation based on active, incomplete task count (20% per active task, capped at 100%), both in the API and reactively on the web frontend.
3. Cleanly migrating PostgreSQL and Prisma: adding `tasks.description` and dropping the legacy `users.workload` column.

## Decisions (from grilling session)

| # | Decision | Choice |
|---|---|---|
| 1 | Upgrade Focus | Task & Project operational depth (task descriptions, slide-over drawer, dynamic workload) |
| 2 | Workload Metric | Active task count: 20% per non-Done task owned by the user, capped at 100% |
| 3 | Workload Architecture | Query-time derivation (ADR-0002) in `GET /users` and Copilot snapshot; client computes reactively from loaded tasks |
| 4 | Task Detail UX | Shared slide-over drawer triggered by clicking any task in Kanban, Gantt, or Overview |
| 5 | Description Formatting | Plain text with whitespace preservation (`white-space: pre-wrap; font-family: inherit;`); zero new dependencies |
| 6 | Drawer Save Model | Explicit form with "Save changes" button (single `PATCH /tasks/:id`), plus one-click "Complete task" and "Delete task" |
| 7 | Database Migration | Clean migration: add `description` to `tasks` and drop `workload` from `users` |

## Domain Language

- **Task**: A distinct unit of work belonging to a single Project and owned by one User, with an execution phase, status, dates, and description notes. (See `CONTEXT.md`)
- **Workload**: The percentage capacity utilized by a User, derived dynamically from the count of active, incomplete Tasks they currently own. (See `CONTEXT.md`)

## Architecture & Data Flow

### Database Schema Changes

In `api/prisma/schema.prisma`:
```prisma
model User {
  id           String                @id @default(uuid())
  email        String                @unique
  passwordHash String                @map("password_hash")
  name         String
  title        String                @default("")
  role         String                @default("member")
  isActive     Boolean               @default(true) @map("is_active")
  // workload column dropped; computed on query
  createdAt    DateTime              @default(now()) @map("created_at")
  tasks        Task[]
  articles     KnowledgeArticle[]
  uploads      KnowledgeAttachment[]

  @@map("users")
}

model Task {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String   @default("")
  ownerId     String   @map("owner_id")
  owner       User     @relation(fields: [ownerId], references: [id])
  phase       String   @default("Planning")
  status      String   @default("To do")
  priority    String   @default("Medium")
  start       String   @default("")
  date        String   @default("")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("tasks")
}
```

### Backend API Updates

- **`api/src/routes/users.ts`**:
  - `GET /users`: Query active task counts per user via Prisma (`_count: { select: { tasks: { where: { status: { not: 'Done' } } } } }`), mapping to `workload: Math.min(100, count * 20)`.
  - `POST /users`, `PATCH /users/:id`: Remove dead `workload` parameter handling.
- **`api/src/routes/tasks.ts`**:
  - `POST /tasks`: Accept optional `description` (string, max 10,000 chars, default `""`).
  - `PATCH /tasks/:id`: Accept optional `description` (string, max 10,000 chars).
- **`api/src/routes/auth.ts`**:
  - `GET /auth/me`: If workload is returned, compute via active tasks count.
- **`api/src/copilot/snapshot.ts`**:
  - Fetch user active tasks count to format `(workload X%)` accurately.
- **`api/prisma/seed.ts`**:
  - Remove hardcoded `workload` values from demo users.

### Web Frontend Updates

- **`web/src/lib/workspace.mjs`**:
  - Add pure helper `computeWorkload(tasks, userId)`:
    ```js
    export function computeWorkload(tasks, userId) {
      const activeCount = tasks.filter((t) => t.ownerId === userId && t.status !== 'Done').length;
      return Math.min(100, activeCount * 20);
    }
    ```
- **`web/src/lib/types.ts`**:
  - Update `Task` and `ApiTask` to include `description: string`.
- **`web/src/task-drawer.tsx`**:
  - New slide-over component `<TaskDrawer task owners projects open onClose onUpdate onDelete />`:
    - Slide-over backdrop and panel matching `copilot.tsx` styling.
    - Header: Task title, project badge, status pill, close (X) button.
    - Form fields: Name, Project select, Owner select (active users), Status select, Phase select, Priority select, Start and Finish dates.
    - Description multiline `<textarea>` (max 10,000 chars) with placeholder and pre-wrap rendering.
    - Footer: "Save changes" (submits form PATCH), "Complete task" (if not Done), "Delete task" (with confirmation).
- **`web/src/App.tsx`**:
  - Add state `selectedTask: Task | null`.
  - On Kanban card click: `setSelectedTask(task)`.
  - On Gantt row click (in `project-gantt.tsx` or row click callback): `setSelectedTask(task)`.
  - On Overview priority row click: `setSelectedTask(task)`.
  - Team & Overview workload progress bars derive workload reactively using `computeWorkload(tasks, user.id)`.
- **`web/src/globals.css`**:
  - Styles for `.task-drawer`, backdrop, inputs, and description textarea matching the dark/light design system.

## Error Handling & Validation

- `Task.description` capped at 10,000 characters; returns 400 if exceeded.
- Dates remain validated by `validateDates`: both start and finish must be set or both empty, and finish >= start.
- Owner must be an active team member (`assertActiveOwner`).

## Testing Strategy

- `api` tests:
  - Verify migration succeeds against test Postgres.
  - Verify `POST /tasks` and `PATCH /tasks/:id` persist and return `description`.
  - Verify `GET /users` accurately computes workload (e.g. 0 tasks = 0%, 2 tasks = 40%, 5 tasks = 100%, done tasks don't count).
  - Verify Copilot snapshot includes accurate computed workload.
- `web` tests:
  - Unit tests in `src/lib/workspace.test.mjs` for `computeWorkload` (0 tasks, 1 task, multiple tasks, done tasks ignored, capped at 100%).
  - `tsc --noEmit` and `vite build` clean.

## Definition of Done

1. Prisma migration applied; Postgres schema updated with `description` and without `workload`.
2. All 33 existing API tests + new task description/workload tests pass.
3. Web unit tests pass; `tsc` and `vite build` succeed with zero errors.
4. Users can click any task in Kanban, Gantt, or Overview to open the Task Detail Drawer, read/edit descriptions, and save changes.
5. Team capacity and Overview workload bars update reactively as tasks are completed or reassigned.
6. Evidence logged in `VALIDATION.md`.
