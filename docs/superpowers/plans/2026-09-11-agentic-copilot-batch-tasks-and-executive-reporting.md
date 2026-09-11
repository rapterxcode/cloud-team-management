# Implementation Plan: Agentic Workspace Copilot (Batch Tasks & Executive Reporting)

## 1. Overview
Empower the Workspace Copilot (`/copilot`) with agentic multi-task capabilities, rich markdown and diagram rendering, quick-action chips for executive and risk reporting, and direct export to the Knowledge Hub.

---

## 2. Decoupled Tasks Breakdown

### Task 1: Backend Multi-Task Tool Support (`draftTasks`)
- **Files:** `api/src/copilot/gemini.ts`, `api/src/routes/copilot.ts`
- **Changes:**
  - Define `draftTasksTool` FunctionDeclaration accepting an array of `tasks` with `{ name, projectName, ownerName, phase, priority, start, date, description }`.
  - Update `CopilotResult` interface to include `draftTasks?: TaskDraft[]`.
  - In `api/src/routes/copilot.ts`:
    - Update `SYSTEM_PREFIX` to instruct Gemini to call `draftTasks` when generating or breaking down tasks.
    - Iterate and resolve `projectId` and `ownerId` for all items in `draftTasks` using fuzzy matching against active projects and active users.
    - Backward-compatibility: if legacy `draftTask` is returned, wrap it into `draftTasks: [draftTask]`.
- **Verification:** `npm --prefix api run build` compiles cleanly.

### Task 2: Backend Copilot Tests
- **Files:** `api/test/copilot.test.ts`
- **Changes:**
  - Add test cases verifying that `draftTasks` array is properly parsed, resolved with project and user IDs, and returned in the HTTP response.
  - Verify single task backward compatibility.
- **Verification:** `npm --prefix api test` (when database URL is available) or node test suite.

### Task 3: Frontend Pure Logic & Types
- **Files:** `web/src/lib/types.ts`, `web/src/lib/copilot-helpers.mjs`, `web/src/lib/copilot-helpers.test.mjs`
- **Changes:**
  - Update `types.ts` with `draftTasks?: TaskDraft[]`.
  - Create pure helper `copilot-helpers.mjs` with:
    - Prompt preset templates (`COPILOT_QUICK_ACTIONS`).
    - Task batch status tracker functions.
  - Write unit tests in `copilot-helpers.test.mjs`.
- **Verification:** `npm --prefix web test` passes 100%.

### Task 4: Frontend Batch Task Card & Executive Reporting UI
- **Files:** `web/src/copilot.tsx`, `web/src/App.tsx`
- **Changes:**
  - Enhance `CopilotPanel`:
    - Render quick-action prompt chips above the input or when conversation is empty.
    - Replace plain text message rendering with rich markdown rendering (`MarkdownViewer` or structured elements).
    - Implement `BatchTaskDraftCard` showing all proposed tasks with inline editable fields (Name, Project, Owner, Due Date, Priority).
    - Add **"✓ Create All (N) Tasks"** button that sequentially saves all tasks to `/api/tasks` and updates state with success badges.
    - Add **"📄 Save as Knowledge Article"** button when a response is generated, allowing instant saving to Knowledge Hub.
    - Add **"📋 Copy Report"** button with copy-to-clipboard feedback.
    - Pass `currentUser` prop to `CopilotPanel` and restrict task/article creation actions for `role === 'auditor'`.
  - Update `App.tsx` to pass `currentUser={me}` and wire knowledge article creation callback to `CopilotPanel`.
- **Verification:** `npm --prefix web run build` compiles with 0 errors.

### Task 5: System Integration & Live Verification
- Full test suite run (`npm --prefix web test`).
- Production build of both services.
- Container reload: `docker compose up -d --build`.
- Verify live health endpoint `curl -sk https://localhost/api/health`.
- Update `VALIDATION.md` and walkthrough.
