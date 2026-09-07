# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **⚠ Migration in progress (paused):** an approved re-platform to a self-hosted Docker stack is designed and planned but **not yet implemented** — read `docs/HANDOFF.md` first before doing any work here. Everything below describes the current (old) Vinext app, which is still accurate until the plan's Task 1 begins.

## Commands

```sh
npm ci                       # Node >= 22.13 required
npm run dev                  # vinext dev — http://localhost:3000
npm run build                # vinext build -> dist/
npm run start                # wrangler dev --config dist/server/wrangler.json (build first)

node --test lib/*.test.mjs   # all behavior tests
node --test lib/gantt.test.mjs   # single test file
npx oxlint app lib           # authored-code lint gate (use this one)
npm run lint                 # full-tree oxlint; has known pre-existing findings in components/ui + hooks
```

`npm run format` (oxfmt) will reformat the hand-authored dense files in `app/` and `lib/` wholesale. Scope formatting to files you actually changed, or skip it.

## This is not a Next.js app

`next.config.ts`, the `app/` directory, and `next/font/google` imports look like Next, but **`next` is not a dependency**. `vinext` supplies the Next-compatible API surface and app-router semantics on top of Vite + `@vitejs/plugin-rsc`. Everything (dev, build, types via `vinext/types`) flows through `vite.config.ts`.

The deploy target is Cloudflare Workers. There is no checked-in `wrangler.toml` — bindings are built inline in `vite.config.ts` from `.openai/hosting.json`, whose `d1`/`r2` are currently `null`, so no bindings exist. The D1 `database_id` there is a local Miniflare placeholder. `project_id` points at the already-hosted Site; local dev never publishes to it.

## Architecture

**Single-page, session-only state.** `app/page.tsx` is one `'use client'` component holding every piece of state (`view`, `projects`, `tasks`, `knowledge`, `query`, `filter`, `modal`, `detail`). Navigation is a `view` string matched against the `nav` array — there are no routes beyond `/`. Seed data lives as module constants (`initialProjects`, `initialTasks`, `members`, `resources`, `initialKnowledge`). Changes are React state only; a reload resets everything. No database, auth, or cloud-provider connection.

**Logic lives in plain `.mjs` under `lib/`, not in components.** This is the testable seam and the reason `node --test` works with zero test dependencies:

- `lib/workspace.mjs` — pure array transforms (`addItem`, `updateItem`, `completeTask`, `filterItems`, `projectTasks`, `timelineTasks`). Every state mutation in `page.tsx` goes through these.
- `lib/gantt.mjs` — `validateDates()` (throws user-facing messages) and `schedule(tasks)` returning `{start, days, bars:[{id, offset, duration}]}` with inclusive day ranges across month boundaries.

When adding behavior, put it in a `lib/*.mjs` module with a `node:test` case first, then wire the component to it.

**`app/project-gantt.tsx`** is presentation over `schedule()`: it takes `tasks` plus `onAdd`/`onUpdate` callbacks (state stays in `page.tsx`), buckets tasks into the fixed `phases` array (`Planning`/`Development`/`Launch`), and derives pixel geometry from `zoom` and `plan.days`.

**`app/globals.css`** has two halves. Lines 1–135 are generated shadcn/Tailwind v4 scaffolding (`@theme inline`, token definitions, `@layer base`). Line 136 to the end is hand-authored compact CSS: the real palette override, app-specific classes (`.app-sidebar`, `.project-card`, `.gantt-panel`, `.knowledge-grid`, …) and the responsive breakpoints at 1500/1150/700px. The app is styled with those plain classes, not Tailwind utilities — edit the bottom section, not the token block.

**`components/ui/`** (60 files) is generated shadcn output — `base-nova` style, RSC-enabled, backed by `@base-ui/react`. Treat as vendored; its lint findings are intentionally preserved.

`page.tsx` also feature-detects `document.modelContext` and registers a read-only `navigate_workspace` WebMCP tool, aborting on unmount. It is optional and silently skipped when absent.

## Conventions

- `@/*` resolves to the repo root (`@/lib/...`, `@/components/ui/...`).
- Authored `app/` and `lib/` code is deliberately dense (minimal whitespace, multiple declarations per line). Match it rather than expanding it.
- `VALIDATION.md` is the evidence log for this project: each feature records its TDD red/green counts, scope limits, and which checks passed. Append to it when adding behavior instead of rewriting past entries.
- No git repository — this is a source export. `README-EXPORT.md` records the upstream commit.
