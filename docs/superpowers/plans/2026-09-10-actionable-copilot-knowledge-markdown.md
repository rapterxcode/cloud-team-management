# Actionable Copilot & Knowledge Hub Markdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Copilot into an Actionable Assistant capable of drafting tasks via interactive confirmation cards in chat, and elevate Knowledge Hub with GitHub-flavored Markdown rendering, syntax-styled code snippets with copy buttons, a Write/Preview tabbed editor, and instant search term highlighting.

**Spec Reference:** `docs/superpowers/specs/2026-09-10-actionable-copilot-knowledge-markdown-design.md`

---

## Global Constraints

- Human-in-the-loop: Copilot NEVER writes directly to the database without explicit user click on the interactive card ("Create Task").
- Provider isolated: Gemini tool calling (`draftTask`) sits behind `AskLLM` interface; tests inject a fake `askLLM` without requiring live API keys.
- All existing 35+ API tests and 10 Web tests must stay green.
- Work on branch: `feat/actionable-copilot-knowledge-markdown`.

---

## Task Breakdown

### Task 1: API Task Priority on Creation
- Allow `priority` ('Low', 'Medium', 'High') directly in `POST /api/tasks` (default 'Medium').
- Update `api/test/tasks.test.ts` to verify priority saving.

### Task 2: Backend Actionable Copilot (Tool Calling & Entity Resolution)
- Define `draftTask` function declaration in `@google/genai` tool options.
- In `api/src/routes/copilot.ts`, resolve `projectName` and `ownerName` from workspace data to valid `projectId` and `ownerId`.
- Extend `POST /api/copilot` response schema: `{ answer: string, draftTask?: TaskDraft }`.
- Update `api/test/copilot.test.ts` with tests for both plain answers and structured draftTask returns.

### Task 3: Web Dependencies & Pure Helpers
- Install `react-markdown` and `remark-gfm` in `web/`.
- Add pure helper `src/lib/search.mjs` for case-insensitive substring highlighting and matching.
- Add unit tests in `src/lib/search.test.mjs`.

### Task 4: Knowledge Hub Markdown & Write/Preview Editor
- Create `web/src/markdown-viewer.tsx` with GFM support, styled code blocks with language badge, and a "Copy" button.
- Add Write / Preview tabs in Create/Edit Knowledge Article dialog.
- Add search match highlighting in Knowledge article grid cards.

### Task 5: Copilot TaskDraftCard & "Runbook to Tasks" Integration
- In `web/src/copilot.tsx`, render `<TaskDraftCard>` when an assistant message includes `draftTask`.
- Provide Project/Owner selector dropdowns pre-filled with the AI proposal, plus a "Create Task" button that calls `post('/tasks')` and reactively updates all views.
- Add "✨ Turn into Tasks" button in the Knowledge article reader to invoke Copilot with runbook text.

### Task 6: Verification & Validation Logging
- Run full API test suite (`npm --prefix api test`).
- Run full Web unit tests (`npm --prefix web test`).
- Run production builds (`npm --prefix api run build` and `npm --prefix web run build`).
- Record validation evidence in `VALIDATION.md`.
