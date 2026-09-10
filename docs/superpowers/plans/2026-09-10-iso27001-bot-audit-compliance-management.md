# ISO 27001 & Bank of Thailand (BOT) Audit Compliance Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an audit-ready compliance framework across Projects, Tasks, and Knowledge Management aligned with ISO 27001 and Bank of Thailand (BOT) IT Governance standards. Key deliverables include:
1. Direct **Project Documents** upload, categorized by audit standards (CR, CC, Cloud Risk Assessment, Diagram, RBAC Matrix, Test Evidence) with in-browser preview (PDF, images, SVG) and download.
2. Read-only **`auditor`** role for Segregation of Duties (SoD) (ADR-0003).
3. Explicit **Task-to-CR/CC Change Traceability** (ADR-0004) and **Task-to-SOP Runbook** reference.
4. Document deletion governance protecting evidence (deletable only by uploader or admin; ADR-0005).
5. Central **Compliance Matrix** view displaying audit readiness checkpoints across all cloud projects.
6. Actionable **Copilot Compliance Intelligence** for audit gap analysis and Change Request summarization.

**Architecture & Decisions:**
- [`CONTEXT.md`](../../CONTEXT.md): Ubiquitous language for `Role` (auditor), `Project document`, `Compliance matrix`, `Task SOP`, `Change authorization`.
- [`docs/adr/0003-auditor-role-for-iso27001-bot-compliance.md`](../adr/0003-auditor-role-for-iso27001-bot-compliance.md): Read-only auditor role for SoD.
- [`docs/adr/0004-task-change-traceability-to-project-documents.md`](../adr/0004-task-change-traceability-to-project-documents.md): Foreign key link from `Task` to `ProjectDocument`.
- [`docs/adr/0005-project-document-deletion-governance.md`](../adr/0005-project-document-deletion-governance.md): Deletion restricted to uploader and admin.

**Tech Stack:** Express 5 + Prisma Client 6 (PostgreSQL 17), React 19 SPA (Vite + Tailwind CSS), Multer, Google GenAI SDK.

---

## Global Constraints

- **Single Database Migration:** All schema additions in one clean Prisma migration (`..._iso27001_bot_audit_compliance`).
- **Segregation of Duties:** `auditor` role must be strictly read-only on the backend API (403 on POST/PATCH/PUT/DELETE) and UI (all mutation buttons hidden).
- **Supported File Types:** `.pdf`, `.xls`, `.xlsx`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.svg`, `.csv`, `.zip`, `.yaml`, `.json` up to 25 MB.
- **Preview Support:** In-browser viewing for PDF, images, and SVG (`Content-Disposition: inline`).
- **Tests First:** Follow TDD — write failing API and Web tests before implementing features. All existing 37 API tests and 14 web tests must continue to pass.
- **Git Hygiene:** Work on dedicated branch `feat/iso27001-bot-compliance-management`. Commit cleanly at each task boundary.

---

## File Structure (End State)

```
api/prisma/
  schema.prisma                       # (modify) ProjectDocument model, User role, Task relations, KnowledgeArticle relation
  seed.ts                             # (modify) add auditor user, demo project documents (CRA, CR, RBAC), linked tasks
  migrations/                         # (new) migration SQL for compliance models and foreign keys
api/src/
  middleware.ts                       # (modify) add requireAuditorReadOnly guard
  app.ts                              # (modify) mount project documents and compliance routes
  validate.ts                         # (modify) add AUDIT_CATEGORIES and file extension sets
api/src/routes/
  users.ts                            # (modify) support auditor role in user management
  tasks.ts                            # (modify) support sopArticleId and changeDocumentId
  knowledge.ts                        # (modify) support optional projectId on articles
  project-documents.ts                # (new) CRUD, upload, preview, download, deletion governance
  compliance.ts                       # (new) GET /api/compliance/matrix calculation endpoint
api/src/copilot/
  tools.ts                            # (modify/new) auditGapAnalysis and draftChangeRequest tools
  gemini.ts                           # (modify) register new compliance tools
api/test/
  project-documents.test.ts           # (new) test upload, download, preview, and deletion permissions
  compliance-matrix.test.ts           # (new) test dynamic compliance checkpoint rollup
  auditor-guard.test.ts               # (new) verify auditor role blocked from all mutations
  tasks.test.ts                       # (modify) test sopArticleId and changeDocumentId
web/src/lib/
  types.ts                            # (modify) add ProjectDocument, AuditCategory, auditor role
  compliance.mjs                      # (new) pure compliance rollup and checkpoint helper
  compliance.test.mjs                 # (new) unit tests for compliance helper
web/src/
  project-documents.tsx               # (new) Project Documents tab, category filter, upload modal, preview dialog
  compliance-matrix.tsx               # (new) Central cross-project compliance readiness matrix
  task-drawer.tsx                     # (modify) SOP runbook link and Change Authorization link
  App.tsx                             # (modify) mount Compliance Matrix nav, documents tab, auditor mode banner
  globals.css                         # (modify) styles for document previewer and compliance badges
VALIDATION.md                         # (modify) append full test and verification evidence
```

---

### Task 1: Prisma Schema Migration & Demo Seed

**Files:**
- Modify: `api/prisma/schema.prisma`
- Modify: `api/prisma/seed.ts`
- Create: `api/prisma/migrations/..._iso27001_bot_audit_compliance/migration.sql`

- [ ] **Step 1: Update schema.prisma**
  - Add `ProjectDocument` model:
    ```prisma
    model ProjectDocument {
      id           String   @id @default(uuid())
      projectId    String   @map("project_id")
      project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
      storedName   String   @unique @map("stored_name")
      originalName String   @map("original_name")
      mimeType     String   @map("mime_type")
      sizeBytes    Int      @map("size_bytes")
      category     String   // "CR", "CC", "CRA", "Diagram", "RBAC", "TestEvidence", "General"
      referenceNo  String   @default("") @map("reference_no") // e.g. "CR-2026-001"
      uploadedById String   @map("uploaded_by")
      uploadedBy   User     @relation("ProjectDocumentUploader", fields: [uploadedById], references: [id])
      createdAt    DateTime @default(now()) @map("created_at")
      tasks        Task[]   @relation("TaskChangeAuthorization")

      @@map("project_documents")
    }
    ```
  - Update `Task`:
    - Add `sopArticleId String? @map("sop_article_id")` with relation to `KnowledgeArticle`.
    - Add `changeDocumentId String? @map("change_document_id")` with relation `"TaskChangeAuthorization"` to `ProjectDocument`.
  - Update `KnowledgeArticle`:
    - Add `projectId String? @map("project_id")` with optional relation to `Project`.
    - Add `tasks Task[]` relation for SOP references.
  - Update `User`:
    - Add `projectDocuments ProjectDocument[] @relation("ProjectDocumentUploader")`.

- [ ] **Step 2: Generate and apply Prisma migration**
  - Run `npx prisma migrate dev --name iso27001_bot_audit_compliance` from `api/`.
  - Verify migration executes cleanly against local PostgreSQL.

- [ ] **Step 3: Update seed.ts**
  - Add a seeded user with `role: "auditor"` (e.g. `auditor@cloudteam.internal`).
  - Seed sample `ProjectDocument` records for an active project (CRA, Architecture Diagram, approved CR).
  - Bind a deployment Task to the seeded CR document (`changeDocumentId`).
  - Link a runbook Knowledge article to the project and task (`sopArticleId`).
  - Run `npx prisma db seed` and verify clean seed.

- [ ] **Step 4: Commit**
  - `git commit -am "feat(db): add ProjectDocument, task audit relations, and auditor seed data"`

---

### Task 2: Backend Security Middleware & Auditor Role Guard

**Files:**
- Modify: `api/src/middleware.ts`
- Modify: `api/src/routes/users.ts`
- Create: `api/test/auditor-guard.test.ts`

- [ ] **Step 1: Write failing tests for auditor mutation restrictions**
  - In `api/test/auditor-guard.test.ts`:
    - Create a test user with `role: "auditor"`.
    - Test that `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id` return `403 Forbidden`.
    - Test that `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` return `403 Forbidden`.
    - Test that `GET /api/projects`, `GET /api/tasks`, `GET /api/users` return `200 OK`.
  - Run `npm --prefix api test` and observe RED.

- [ ] **Step 2: Implement requireAuditorReadOnly guard in middleware.ts**
  - Export `requireAuditorReadOnly(req, res, next)`:
    - If `req.session.role === 'auditor'` and method is not `GET` or `HEAD`:
      return `res.status(403).json({ error: 'Auditor role has read-only access' })`.
  - Apply `requireAuditorReadOnly` globally in `api/src/app.ts` or mount on router layers.

- [ ] **Step 3: Update users.ts to support auditor role**
  - Allow `role: "auditor"` in `assertIn(role, ['admin', 'member', 'auditor'])`.
  - Ensure only `admin` can assign or change roles.

- [ ] **Step 4: Run tests and verify GREEN**
  - Run `npm --prefix api test` and verify all tests pass.

- [ ] **Step 5: Commit**
  - `git commit -am "feat(auth): enforce read-only auditor role for ISO 27001 / BOT segregation of duties"`

---

### Task 3: Backend API: Project Documents Routes & Deletion Governance

**Files:**
- Create: `api/src/routes/project-documents.ts`
- Modify: `api/src/app.ts`
- Modify: `api/src/validate.ts`
- Create: `api/test/project-documents.test.ts`

- [ ] **Step 1: Define audit categories & allowed extensions in validate.ts**
  - `AUDIT_CATEGORIES = ['CR', 'CC', 'CRA', 'Diagram', 'RBAC', 'TestEvidence', 'General']`
  - `DOCUMENT_EXTS = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.svg', '.csv', '.zip', '.yaml', '.json']`

- [ ] **Step 2: Write failing tests for Project Documents in project-documents.test.ts**
  - Test `GET /api/projects/:id/documents` returns list with uploader and category.
  - Test `POST /api/projects/:id/documents` uploads file, validates category, and returns document record.
  - Test `GET /api/project-documents/:id/download` serves file with `Content-Disposition: attachment`.
  - Test `GET /api/project-documents/:id/preview` serves file with `Content-Disposition: inline`.
  - Test `DELETE /api/project-documents/:id` (ADR-0005):
    - Succeeds if performed by original uploader.
    - Succeeds if performed by `admin`.
    - Returns `403` if performed by another `member`.
    - Returns `403` if performed by `auditor`.
  - Run `npm --prefix api test` and observe RED.

- [ ] **Step 3: Implement project-documents.ts**
  - Implement Multer disk storage pointing to `ATTACHMENTS_DIR()`.
  - Implement GET list, POST upload, GET download/preview with MIME mapping.
  - Implement DELETE with ownership guard checking `req.session.userId === doc.uploadedById || req.session.role === 'admin'`.

- [ ] **Step 4: Mount routes in app.ts and verify GREEN**
  - Mount `/api/projects/:id/documents` and `/api/project-documents/:id`.
  - Run `npm --prefix api test` and verify all tests pass.

- [ ] **Step 5: Commit**
  - `git commit -am "feat(api): implement Project Documents endpoints with audit deletion governance"`

---

### Task 4: Backend API: Task Traceability & Knowledge Project Scoping

**Files:**
- Modify: `api/src/routes/tasks.ts`
- Modify: `api/src/routes/knowledge.ts`
- Modify: `api/test/tasks.test.ts`
- Modify: `api/test/knowledge.test.ts`

- [ ] **Step 1: Write failing tests for Task Traceability & Project-scoped Knowledge**
  - In `tasks.test.ts`: test `POST /tasks` and `PATCH /tasks/:id` with `changeDocumentId` and `sopArticleId`.
  - In `knowledge.test.ts`: test creating an article with `projectId`, and querying `GET /api/knowledge?projectId=...`.
  - Run `npm --prefix api test` and observe RED.

- [ ] **Step 2: Implement Task SOP & Change Traceability in tasks.ts**
  - Accept `changeDocumentId` and `sopArticleId` in create and update payloads.
  - Include relations in task responses:
    - `changeDocument: { select: { id: true, originalName: true, category: true, referenceNo: true } }`
    - `sopArticle: { select: { id: true, name: true, category: true } }`

- [ ] **Step 3: Implement Project Scoping in knowledge.ts**
  - Allow `projectId` (nullable string) on article creation and patch.
  - Support filtering articles by `projectId` or `global=true`.

- [ ] **Step 4: Verify tests pass**
  - Run `npm --prefix api test` and verify GREEN.

- [ ] **Step 5: Commit**
  - `git commit -am "feat(api): add task change traceability to CR/CC and project-scoped knowledge articles"`

---

### Task 5: Backend API: Central Compliance Matrix & Copilot Intelligence

**Files:**
- Create: `api/src/routes/compliance.ts`
- Modify: `api/src/copilot/snapshot.ts`
- Modify: `api/src/copilot/gemini.ts`
- Create: `api/test/compliance-matrix.test.ts`

- [ ] **Step 1: Write failing tests for Compliance Matrix**
  - Test `GET /api/compliance/matrix`:
    - Returns each project with compliance checkpoints:
      - `hasCRA: boolean`
      - `hasDiagram: boolean`
      - `hasRBAC: boolean`
      - `hasCC: boolean`
      - `deploymentTasksTotal: number`
      - `deploymentTasksTraceable: number`
      - `readinessScore: number` (0 to 100%)
  - Run `npm --prefix api test` and observe RED.

- [ ] **Step 2: Implement compliance.ts endpoint**
  - Query projects with included `projectDocuments` and `tasks`.
  - Calculate checkpoint fulfillment based on ISO 27001 / BOT requirements.

- [ ] **Step 3: Expand Copilot System Prompt & Function Calling**
  - In `api/src/copilot/snapshot.ts`: include compliance matrix summary in the system prompt.
  - In `api/src/copilot/gemini.ts`: add `analyzeComplianceGap` tool declaration for project audit checks.

- [ ] **Step 4: Verify tests pass**
  - Run `npm --prefix api test` and verify GREEN.

- [ ] **Step 5: Commit**
  - `git commit -am "feat(api): add central compliance matrix and copilot audit analysis"`

---

### Task 6: Web Client: Types, Pure Compliance Library & Unit Tests

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/compliance.mjs`
- Create: `web/src/lib/compliance.test.mjs`

- [ ] **Step 1: Write unit tests in compliance.test.mjs**
  - Test pure helper `calculateProjectReadiness(docs, tasks)`:
    - Returns 0% when no documents exist.
    - Returns 100% when CRA, Diagram, RBAC, CC exist and all deployment tasks have `changeDocumentId`.
    - Returns partial score and lists missing checkpoints.
  - Run `node --test src/lib/compliance.test.mjs` and observe RED.

- [ ] **Step 2: Implement compliance.mjs and update types.ts**
  - Export `calculateProjectReadiness`, `AUDIT_CHECKPOINTS`, `AUDIT_CATEGORIES`.
  - Update `web/src/lib/types.ts` with `ProjectDocument`, `AuditCategory`, and updated `Task` / `User`.

- [ ] **Step 3: Run web tests and verify GREEN**
  - Run `npm --prefix web test` (all 15+ tests pass).

- [ ] **Step 4: Commit**
  - `git commit -am "feat(web): add compliance pure calculations, audit types, and unit tests"`

---

### Task 7: Web Client: Project Detail "Documents & Audit Evidence" Tab & In-Browser Preview

**Files:**
- Create: `web/src/project-documents.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/globals.css`

- [ ] **Step 1: Create ProjectDocuments component**
  - Tabbed category filter: `All`, `CR / CC`, `Cloud Risk Assessment`, `Architecture & Diagram`, `RBAC Matrix`, `Test Evidence`, `General`.
  - Upload Document Modal:
    - File input (accepting PDF, Excel, Word, SVG, images, etc.).
    - Category select dropdown with ISO 27001 / BOT descriptions.
    - Reference number input (e.g. `CR-2026-004`).
  - Document Card / Table:
    - File icon by extension, original file name, size, category badge.
    - Upload metadata: date & uploader name.
    - Action buttons:
      - **Preview**: Opens modal preview for `.pdf`, `.svg`, `.png`, `.jpg`.
      - **Download**: Triggers direct file download.
      - **Delete**: Visible only if current user is `admin` or the document's uploader. Completely hidden for `auditor`.

- [ ] **Step 2: Mount Documents Tab inside Project detail view in App.tsx**
  - Add tab selector in Project View: `[Tasks] [Gantt] [Documents & Audit Evidence] [Runbooks & Knowledge]`.

- [ ] **Step 3: Verify build**
  - Run `npm --prefix web run build` (`tsc` clean).

- [ ] **Step 4: Commit**
  - `git commit -am "feat(web): build Project Documents tab with category filters, previewer, and upload modal"`

---

### Task 8: Web Client: Central Compliance Matrix View & Auditor Mode

**Files:**
- Create: `web/src/compliance-matrix.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Build ComplianceMatrix component**
  - Overview cards: Total Projects, Fully Audit-Ready, Incomplete, Missing Critical Evidence.
  - Interactive Table:
    - Columns: Project Name, Department, Cloud Risk Assessment (CRA), Architecture Diagram, RBAC Matrix, Change Control (CC), Deployment Tasks Traceability, Overall Readiness Bar.
    - Checkpoint badges: Green checkmark (Uploaded & Verified), Amber warning (In Review / Partial), Red cross (Missing).
    - Clicking a badge navigates directly to that project's Documents tab with the category pre-filtered.

- [ ] **Step 2: Mount Compliance Matrix in App navigation**
  - Add "Compliance Matrix" to main sidebar navigation.
  - Show a prominent top banner when logged in as `auditor`:
    `"Compliance Inspector Mode (Read-Only) — ISO 27001 / BOT Segregation of Duties active."`

- [ ] **Step 3: Hide mutation controls in Auditor mode**
  - Condition all "Create Task", "Edit Task", "New Project", "Delete", "Upload Document" buttons on `currentUser.role !== 'auditor'`.

- [ ] **Step 4: Verify build**
  - Run `npm --prefix web run build`.

- [ ] **Step 5: Commit**
  - `git commit -am "feat(web): build Central Compliance Matrix view and auditor read-only UX"`

---

### Task 9: Web Client: Task Drawer SOP Runbook & Change Authorization

**Files:**
- Modify: `web/src/task-drawer.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Update TaskDrawer with compliance links**
  - Add **"Change Authorization (ISO 27001 / BOT)"** section:
    - Dropdown to link task to an approved CR/CC `ProjectDocument`.
    - If linked, display clickable badge `Authorized by: [CR-2026-004]` with 1-click preview.
  - Add **"Standard Operating Procedure (SOP / Runbook)"** section:
    - Dropdown to select a Knowledge Article.
    - If selected, display link `Referenced Runbook: [Open SOP]` opening the article modal.

- [ ] **Step 2: Test interactivity in browser & verify build**
  - Run `npm --prefix web run build`.

- [ ] **Step 3: Commit**
  - `git commit -am "feat(web): integrate SOP runbook and change authorization links in TaskDrawer"`

---

### Task 10: End-to-End Verification, Docker Compose Deployment & Final Report

**Files:**
- Modify: `VALIDATION.md`

- [ ] **Step 1: Run complete automated test suite**
  - Run `npm --prefix api test` (expect all 40+ tests passing).
  - Run `npm --prefix web test` (expect all 16+ tests passing).
  - Run `npm --prefix api run build` && `npm --prefix web run build`.

- [ ] **Step 2: Rebuild & redeploy Docker Compose stack**
  - Run `docker compose up -d --build`.
  - Check `docker compose ps` (all services Up and Healthy).
  - Check API startup logs to verify migration applied cleanly.

- [ ] **Step 3: Document validation evidence in VALIDATION.md**
  - Record test outputs, database migration confirmation, and role access verification.

- [ ] **Step 4: Final Commit & Handoff**
  - `git commit -am "docs: complete ISO 27001 & BOT compliance implementation and verification"`
