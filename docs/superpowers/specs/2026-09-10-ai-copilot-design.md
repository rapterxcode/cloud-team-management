# AI Copilot — Design (Phase 2)

**Date:** 2026-09-10
**Scope type:** feature
**Status:** approved by owner
**Depends on:** the platform migration (web/ SPA + api/ Express+Prisma + Postgres behind Caddy), now on `main`.

## Goal

Add a read-only AI Copilot: a slide-over chat panel where any logged-in user asks natural-language questions and gets answers grounded in the team's live workspace data (projects, tasks, team, cloud resources, knowledge). The Copilot calls Google's Gemini API through the backend.

Out of scope (explicit): taking actions / mutations, persisted chat history, streaming responses, embeddings/RAG, per-user data scoping (the app is flat-access), and wiring the existing WebMCP `navigate_workspace` hook into the Copilot.

## Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Purpose | Read-only Q&A grounded in workspace data |
| 2 | Provider | Google Gemini API; key supplied later; app fully works without it (only Copilot dark) |
| 3 | Grounding | Context snapshot (compact workspace summary in the prompt), single-shot |
| 4 | UI | Slide-over chat panel toggled from a top-bar ✨ button |
| 5 | History | Ephemeral (React state; client sends recent history each request; server stateless) |
| 6 | Response | Single JSON response (non-streaming) |
| 7 | Knowledge in snapshot | Titles/categories + **truncated** body previews under a budget |
| 8 | WebMCP hook | Left as-is; not used by the Copilot in v1 |

## Architecture

Stateless request/response; provider isolated behind one interface.

```
web: Copilot panel ──POST /api/copilot { question, history[] }──▶ api: copilot route
                                                                    1. build workspace snapshot (Prisma → compact text)
                                                                    2. askLLM(system+snapshot, history+question)
   { answer }        ◀───────────────────────────────────────────  3. return { answer }
```

- The server persists nothing for the Copilot — the client includes the recent `history[]` (trimmed to the last N turns) on each request.
- The LLM call sits behind `askLLM(system: string, messages: Msg[]) → Promise<string>`. The concrete implementation targets Gemini; tests inject a fake. This is isolation, not a provider-abstraction framework — one interface, one real impl.

## Components

New backend files under `api/src/copilot/`, one route file, and one web component.

- **`api/src/copilot/snapshot.ts`** — `buildSnapshot(prisma): Promise<string>`. Pure-ish (only reads Prisma). Produces a compact, human-readable text block:
  - Projects: name, status, progress, department, due.
  - Tasks: name, project, owner name, status, priority, start→due.
  - Team: name, title, workload.
  - Cloud resources: name, provider, type, status, monthly cost; plus total monthly spend.
  - Knowledge: each article's title + category + a body preview truncated to a per-article cap (e.g. 400 chars) with an ellipsis marker.
  - A total-size budget (e.g. ~12k chars): if exceeded, oldest/lowest-priority sections are truncated with an explicit `…(truncated)` marker so the prompt stays bounded as data grows. Never includes secrets, password hashes, emails, or session data.
- **`api/src/copilot/gemini.ts`** — `askLLM(system, messages)`. Reads `GEMINI_API_KEY` and `GEMINI_MODEL` (default: a current Gemini model, pinned in the plan). Calls the Gemini generateContent API via the official SDK. Throws a typed `CopilotNotConfiguredError` when the key is absent, and surfaces provider/network failures as a distinct error. Exported `isConfigured(): boolean`.
- **`api/src/routes/copilot.ts`** — mounts two routes (both require an authenticated session):
  - `GET /api/copilot/status` → `{ enabled: boolean }` (from `isConfigured()`).
  - `POST /api/copilot` `{ question: string, history?: {role:'user'|'assistant', content:string}[] }` → `{ answer: string }`. Validates question (non-empty, ≤ 2000 chars) and history (array, capped to last ~10 messages, each ≤ 4000 chars). Builds the snapshot, calls `askLLM`, returns `{answer}`. Per-user+IP rate limit (reuse the login-limiter pattern; e.g. 20/min) to bound cost.
  - Accepts an injected `askLLM` for tests (factory `copilotRoutes(prisma, askLLMImpl = realAskLLM)`).
- **`web/src/copilot.tsx`** — `<CopilotPanel open onClose />`: a right-side slide-over with a scrollable transcript, a textarea + Send, and a "thinking…" indicator while awaiting the reply. Ephemeral `messages` state. On mount/open, calls `GET /api/copilot/status`; if disabled, shows "Copilot isn't configured yet." Errors render inline as an assistant-style error bubble.
- **`web/src/App.tsx`** — a ✨ "Ask Copilot" button in the top bar toggles the panel; a `copilotOpen` state. The button is shown always but the panel reports the disabled state itself (one status check, not gating the button).

## System prompt & grounding

The system message states the Copilot's role and hard constraints: answer **only** from the provided workspace snapshot; if the answer isn't in the data, say so plainly; never invent projects/tasks/people; keep answers concise. The snapshot is injected fresh every request (always current). Because the exchange is single-shot and read-only, there is no tool loop.

## Config

- `GEMINI_API_KEY` — unset for now; when unset, Copilot endpoints return 503 and `status.enabled=false`.
- `GEMINI_MODEL` — default pinned in the plan; overridable.
- Added to `.env.example` and the `api` service env in `compose.yml`.
- No key is required to build, test, run, or deploy the rest of the app.

## Error handling

| Condition | Response |
|---|---|
| Not authenticated | 401 (shared middleware) |
| No API key configured | 503 `{error:"Copilot isn't configured yet"}` |
| Empty / oversized question | 400 with a clear message |
| Rate limit exceeded | 429 |
| Gemini network/API error | 502 `{error:"Copilot is unavailable, please try again"}` (details logged server-side, not leaked) |

The web panel maps each to a readable inline message.

## Security & privacy

- Read-only, no tools/mutations: prompt-injection inside knowledge article bodies can at worst yield a poor answer, never a data change. The system prompt tells the model to treat snapshot content as data, not instructions.
- The snapshot excludes secrets, password hashes, emails, and session data — only the same workspace content users already see in the UI.
- Data sent to Gemini per request (the snapshot + the question) is disclosed in `docs/DEPLOY.md` so operators understand what leaves the server; the Copilot is off until a key is set, so this is opt-in.

## Testing

`node:test` + `fetch`, same harness as the rest of the API; no real key needed.

- `snapshot.ts`: unit tests over seeded Prisma data — includes the expected fields, truncates long article bodies, respects the total budget, and never contains a password hash or email. Empty-workspace case.
- `routes/copilot.ts`: inject a fake `askLLM`.
  - `GET /api/copilot/status` reflects configured/!configured.
  - `POST /api/copilot`: requires auth (401 anonymous); 400 on empty/oversized question; passes the built snapshot + question to `askLLM` and returns its answer as `{answer}`; caps history length.
  - Real-module path returns 503 when `GEMINI_API_KEY` is unset.
- web: no new lib logic to unit-test; verified in the final manual smoke (open panel → disabled message with no key; with a fake/stub key path, a question returns an answer bubble).

## Definition of done

1. `POST /api/copilot` and `GET /api/copilot/status` work behind auth; 503 when unconfigured.
2. Snapshot builder returns bounded, secret-free workspace context; unit-tested.
3. Slide-over panel sends questions and renders answers/errors; shows the not-configured state cleanly.
4. All new API tests pass with a fake LLM; full api suite stays green; both packages build.
5. `.env.example`, compose env, `CLAUDE.md`, and `docs/DEPLOY.md` updated (config + data-egress note); evidence appended to `VALIDATION.md`.
6. App builds, runs, and deploys unchanged when no key is set.
