# Actionable Copilot & Knowledge Hub Markdown (Design Spec)

**Date:** 2026-09-10  
**Scope type:** feature  
**Status:** In Review (Gate A Approval)  
**Depends on:** AI Copilot Phase 2 (read-only) + Task Operational Depth & Dynamic Workload (both merged on `main`).

---

## 1. Executive Summary & Goals

This feature enhances two core pillars of Cloud Team Management:
1. **Actionable AI Copilot (Phase 3)**: Evolving Copilot from a read-only question answerer into an operational assistant. When a user asks Copilot to create or assign work (e.g. *"Create a task for Sam to migrate AWS RDS to Postgres next Friday in Platform Modernization"*), Copilot returns conversational context accompanied by an **interactive Task Draft card** directly inside the chat transcript. The user can review, adjust (project, owner, dates), and click **"Create Task"** with a single click. No blind mutations occur without explicit human confirmation.
2. **Knowledge Hub Rich Markdown & Search**: Upgrading team runbooks and guides with full Markdown rendering (`react-markdown` + `remark-gfm`), syntax-highlighted code blocks with a one-click copy button, a tabbed **Write / Preview** editor, and instant full-text search with term highlighting.
3. **Operational Synergy ("Runbook to Tasks")**: Adding a *"✨ Convert to Tasks with Copilot"* action on Knowledge runbooks, allowing Copilot to ingest standard operating procedures (SOPs) and automatically propose task checklists into projects.

---

## 2. Key Decisions & Trade-Offs

| # | Topic | Decision | Rationale |
|---|---|---|---|
| 1 | **Copilot Action Safety** | **Interactive Draft Card in Chat (Human-in-the-loop)** | Completely avoids unintentional database writes or hallucinations. User sees exact fields before creation. |
| 2 | **LLM Action Structure** | **Gemini Function Calling (`draftTask` tool) + fallback parser** | Uses `@google/genai` tool declarations for deterministic parameter extraction; server resolves `projectName` & `ownerName` to IDs. |
| 3 | **Markdown Library** | **`react-markdown` + `remark-gfm`** | Zero-dependency on heavy rich text engines; sanitized AST prevents XSS; native React 19 compatibility. |
| 4 | **Editor UX** | **Tabbed "Write" & "Preview"** | Engineers can write familiar GitHub-flavored markdown with immediate preview feedback without bloating UI complexity. |
| 5 | **Code Snippets** | **Monospace container + Language tag + Copy button** | Tailored for cloud operations (Bash, Terraform, YAML, JSON, Docker commands) in team runbooks. |
| 6 | **Search Engine** | **Instant client-side highlighted search** | Sub-millisecond response across titles, tags, and content with term highlighting; zero extra DB indexing overhead for current scale. |
| 7 | **API Test Independence** | **Injectable `AskLLM`** | All API route tests execute with fake LLM in milliseconds without needing live Gemini credentials. |

---

## 3. Architecture & Data Flow

### 3.1 Actionable Copilot Workflow

```
User in Chat: "Add a task for Sam to upgrade Redis in Platform Modernization by Friday"
                                │
                                ▼
Web: POST /api/copilot { question, history[] }
                                │
                                ▼
API: copilot route
  1. buildSnapshot(prisma)
  2. askLLM with draftTask function declaration
  3. If LLM calls draftTask:
       - Match projectName -> projectId
       - Match ownerName -> ownerId (must be active user)
       - Return { answer, draftTask: { name, projectId, ownerId, phase, priority, date, description } }
                                │
                                ▼
Web CopilotPanel:
  - Renders assistant response bubble
  - Renders <TaskDraftCard draft={draftTask} onConfirm={...} onCancel={...} />
                                │
                 [User clicks "Create Task"]
                                │
                                ▼
Web calls POST /api/tasks:
  - Task created in DB
  - App state updates immediately (Kanban, Gantt, Overview priorities, dynamic workload)
  - Card turns into "✅ Task created" with link to open TaskDrawer
```

### 3.2 Knowledge Hub Markdown & Search Flow

```
Knowledge Hub Page
  ├── Toolbar
  │    ├── Search Input (live regex/substring matching with match highlighting)
  │    └── Category Filter Pills (All, Guides, Runbooks, Onboarding, Meeting notes)
  ├── Article Cards Grid (renders snippet, category badge, author)
  ├── Article Dialog (Full view)
  │    ├── <MarkdownViewer content={article.body} />
  │    │     ├── Headers, Blockquotes, Lists, Tables
  │    │     └── Code blocks with [Copy] button and language label
  │    ├── <ArticleAttachments />
  │    └── Actions: [✨ Convert to Tasks] [Edit Article] [Delete Article]
  └── Create/Edit Dialog
       ├── Name & Category selectors
       ├── Tabs: [Write] / [Preview]
       └── <textarea> (Write mode) / <MarkdownViewer> (Preview mode)
```

---

## 4. API & Contract Specifications

### 4.1 `POST /api/copilot` (Extended)

**Response:**
```json
{
  "answer": "I've drafted a task for Sam Ops to upgrade the Redis cluster in Platform Modernization.",
  "draftTask": {
    "name": "Upgrade Redis cluster",
    "projectId": "proj-uuid-123",
    "projectName": "Platform Modernization",
    "ownerId": "user-uuid-456",
    "ownerName": "Sam Ops",
    "phase": "Development",
    "priority": "High",
    "start": "2026-09-11",
    "date": "2026-09-18",
    "description": "Perform rolling upgrade on Redis cluster nodes according to the Runbook."
  }
}
```

### 4.2 `POST /api/tasks` (Enhanced)
Ensure `POST /api/tasks` accepts and validates `priority` (`Low`, `Medium`, `High`, default `'Medium'`) directly upon task creation, in addition to existing fields (`projectId`, `ownerId`, `name`, `phase`, `start`, `date`, `description`).

---

## 5. UI Components to Implement / Modify

1. **`web/src/copilot.tsx`**:
   - Support `draftTask` state inside chat messages.
   - Render `<TaskDraftCard>` with dropdown selectors pre-filled with resolved Project and Owner.
   - Provide "Create Task" (calls `post('/tasks')`, triggers parent refresh) and "Dismiss" buttons.
2. **`web/src/markdown-viewer.tsx`** (New):
   - Pure React component wrapping `react-markdown` and `remark-gfm`.
   - Custom `code` renderer for block code with Copy-to-clipboard button and syntax styling.
3. **`web/src/App.tsx`**:
   - Tabbed editor in the article modal (`Write` tab for markdown input, `Preview` tab for live rendered output).
   - "✨ Convert to Tasks" button in the Article view modal that opens Copilot pre-prompted with the article runbook context.
   - Highlight matched search queries in Knowledge article cards.

---

## 6. Testing & Quality Strategy (Definition of Done)

- **Backend Tests (`api/test/`)**:
  - `copilot.test.ts`: test `POST /api/copilot` returning both plain answers and structured `draftTask` actions.
  - `tasks.test.ts`: verify `POST /api/tasks` with `priority` and `description`.
  - All existing 35+ API tests continue to pass.
- **Frontend Tests (`web/test/`)**:
  - Pure unit tests for search matching and draft resolution.
  - Type-check `tsc --noEmit` clean, Vite production build clean.
- **Security & Reliability**:
  - Zero unconfirmed database mutations.
  - No secrets in LLM snapshots or prompts.
  - Graceful degradation when `GEMINI_API_KEY` is not set.
