# Cloud Team Frontend (`cloud-team-frontend`)

Standalone React 19 + Vite 8 + Tailwind CSS 4 Single-Page Application (SPA) served via Caddy 2 with automatic TLS for the Cloud Team Management platform.

## Architecture & Decoupling

- **Modular Domain Views (`src/views/*`):** Separated feature views (`OverviewView`, `ProjectsView`, `ProjectWorkspaceView`, `TasksKanbanView`, `CloudResourcesView`, `KnowledgeView`, `TeamView`, `ReportsView`, `EntityFormDialog`).
- **Dynamic Code Splitting (`React.lazy` + `<Suspense>`):** On-demand loading of heavy views and dialogs (`CopilotPanel`, `ComplianceMatrix`, `ProjectGantt`, `ProjectDocuments`, `LogsViewer`, `AdminPanel`, `ArticleEditorDialog`).
- **Decoupled Backend Routing:** Caddy forwards `/api/*` to `${API_UPSTREAM:-ctm-api:3000}` over `ctm-network` (or Vite Dev Server proxies `/api` to `VITE_API_TARGET`).

## Quick Start

```bash
cp .env.example .env
npm ci
npm test
npm run build
docker compose up -d --build
```
