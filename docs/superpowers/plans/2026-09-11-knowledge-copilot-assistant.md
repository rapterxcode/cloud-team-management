# Knowledge Article AI Copilot Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable engineers to use AI Copilot directly within the Knowledge Hub editor to generate new articles from titles/prompts, edit and polish existing drafts, add verification checklists & code blocks, and convert Markdown into interactive HTML with CDN CSS.

**ADR Reference:** `docs/adr/0008-knowledge-article-copilot-authoring-and-editing.md`

---

## Global Constraints & Principles

- **Human-in-the-Loop:** Copilot generates/modifies a proposed draft with a summary; content is ONLY applied to the editor when the user clicks "Apply to Editor". Database is not mutated until the user submits the form.
- **Provider Isolation:** Gemini tool calling (`draftArticle`) sits behind the testable `AskLLM` interface; tests inject a mock `askLLM` without requiring live API keys.
- **Segregation of Duties (ISO 27001 / BOT):** Users with `role === 'auditor'` are strictly prevented from calling `POST /api/copilot/article` (HTTP 403 Forbidden) and the assistant UI is hidden in the editor.
- **Backwards Compatibility:** All existing 43 API tests and 41 Web tests must remain green.
- **Workspace Branch:** Dedicated worktree at `.worktrees/feat-knowledge-copilot-assistant` on branch `feat/knowledge-copilot-assistant`.

---

## Task Breakdown

### Task 1: Backend Endpoint `POST /api/copilot/article` & Tool Calling
- [ ] In `api/src/copilot/gemini.ts`:
  - Define `draftArticleTool` (FunctionDeclaration with `name`, `body`, `format`, `summary`).
  - Define type `ArticleDraft = { name?: string; body: string; format?: 'markdown' | 'html'; summary?: string }`.
  - Extend `CopilotResult` with `draftArticle?: ArticleDraft`.
  - Handle `draftArticle` tool call in `realAskLLM`.
- [ ] In `api/src/routes/copilot.ts`:
  - Add route `r.post('/article', async (req, res) => ...)`:
    - Input: `{ prompt: string, name?: string, category?: string, format?: 'markdown' | 'html', currentBody?: string }`.
    - Validation: `prompt` required (max 2000 chars); reject auditor with 403 Forbidden.
    - Grounding: Inject workspace snapshot (projects, resources, roster) and authoring instructions into system prompt.
    - Response: `{ draftArticle: { name: string, body: string, format: 'markdown' | 'html', summary: string } }`.
- [ ] Write integration tests in `api/test/copilot-article.test.ts`:
  - Test 1: Requires authentication (401).
  - Test 2: Auditor role is blocked (403).
  - Test 3: Generates new draft when `currentBody` is empty.
  - Test 4: Modifies existing content when `currentBody` is provided.
  - Test 5: Graceful error handling when unconfigured (503) or provider fails (502).

### Task 2: Frontend Pure Logic & Actions Helper
- [ ] Create `web/src/lib/copilot-article.mjs`:
  - Export `COPILOT_ARTICLE_PRESETS` (quick prompt templates: "Draft from Title", "Add Step-by-Step Runbook", "Add Verification Checklist", "Convert to HTML + Tailwind").
  - Export `buildArticleCopilotPrompt(actionId, context)`.
- [ ] Create unit tests in `web/src/lib/copilot-article.test.mjs`:
  - Verify preset actions and prompt formatting.

### Task 3: In-Editor AI Copilot Assistant Component
- [ ] Create `web/src/article-copilot-assistant.tsx`:
  - Collapsible/expandable AI assistant box rendered inside the Article create/edit dialog.
  - Quick action chips for 1-click prompting.
  - Custom instruction textarea and "✨ Generate / Edit" button.
  - Loading state with feedback.
  - Diff / preview banner showing AI summary of changes.
  - "Apply to Editor" button and "Revert" button.

### Task 4: Integration in Article Modal
- [ ] In `web/src/App.tsx`:
  - Mount `<ArticleCopilotAssistant />` inside the article modal when `modal === 'article'`.
  - Hide assistant if `me.role === 'auditor'`.
  - Wire up `onApply` to update `articleBody`, `articleFormat`, and the article name input.

### Task 5: System Verification, Container Rebuild & Release Evidence
- [ ] Run full test suites:
  - `DATABASE_URL=... npm --prefix api test`
  - `npm --prefix web test`
  - `npm --prefix api run build` && `npm --prefix web run build`
- [ ] Rebuild live containers: `docker compose up -d --build`.
- [ ] Update `VALIDATION.md` with test evidence.
- [ ] Clean merge to `main` and remove temporary worktree.
