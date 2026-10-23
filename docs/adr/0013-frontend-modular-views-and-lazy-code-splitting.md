# ADR 0013: Frontend Modular View Architecture, Live Cloud Resources Inventory, and Lazy Code Splitting

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Engineering Team

## Context

`web/src/App.tsx` previously combined all primary workspace views (`Overview`, `Projects`, `Tasks`, `Team`, `Cloud resources`, `Reports`, `Project workspace`, `Knowledge`) and entity creation forms into a single minified-style file, while importing every heavy dialog and feature panel eagerly at startup:
1. The initial JavaScript bundle (`index-*.js`) exceeded `848 kB`, triggering Vite's `> 500 kB` chunk size warning.
2. The `Cloud resources` navigation view rendered a static "Coming Soon" placeholder even though the backend `/api/resources` CRUD endpoints and Prisma `CloudResource` model were already implemented and tested.
3. Creating projects or knowledge articles from the UI did not consistently attach `workspaceId: activeWorkspace?.id`, and `GET /api/compliance/matrix` returned projects across all workspaces without optional `workspaceId` scoping.

## Decision

1. **Modular Feature Views (`web/src/views/*`):**
   - Extract domain-focused view components into `web/src/views/`:
     - `overview-view.tsx` (`OverviewView`)
     - `projects-view.tsx` (`ProjectsView`, `ProjectWorkspaceView`)
     - `tasks-kanban-view.tsx` (`TasksKanbanView`)
     - `team-view.tsx` (`TeamView`)
     - `cloud-resources-view.tsx` (`CloudResourcesView`)
     - `reports-view.tsx` (`ReportsView`)
     - `knowledge-view.tsx` (`KnowledgeView`)
     - `entity-form-dialog.tsx` (`EntityFormDialog`)
2. **Route & Modal Code Splitting (`React.lazy` + `<Suspense>`):**
   - Load heavy views and dialogs lazily on demand (`AdminPanel`, `CopilotPanel`, `TaskDrawer`, `ComplianceMatrix`, `ArticleReaderDialog`, `CategoryManagerDialog`, `ArticleEditorDialog`, `UserProfileDialog`, `LogsViewer`, `ProjectGantt`, `ProjectDocuments`).
3. **Live Cloud Resources & FinOps Inventory (`CloudResourcesView`):**
   - Replace the static placeholder with a live interactive FinOps inventory view supporting search, provider/status filtering, KPI summary cards, and full CRUD operations wired to `/api/resources`, while enforcing read-only mode for the `auditor` role.
4. **End-to-End Multi-Workspace Scoping:**
   - Attach `workspaceId: activeWorkspace?.id` when creating projects and knowledge articles from `App.tsx`, and support optional `?workspaceId=` filtering in `GET /api/compliance/matrix`.

## Consequences

- **Bundle Reduction:** Initial main bundle size dropped from `848.87 kB` to `415.67 kB` (`130.80 kB` gzipped) with 12 on-demand feature chunks and zero Vite build warnings.
- **Maintainability:** Each workspace domain view has an isolated, typed component contract in `web/src/views/`.
- **Feature Completeness:** Cloud Resources & FinOps inventory is fully operational end-to-end while respecting ISO 27001 / BOT Segregation of Duties (`auditor` read-only guard).
