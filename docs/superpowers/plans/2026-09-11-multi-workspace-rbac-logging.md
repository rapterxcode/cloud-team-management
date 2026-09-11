# Multi-Workspace, Granular RBAC, Audit & Access Logging, and User Profile

## Goal Description
Evolve the Cloud Team Management platform from a single-team structure into an enterprise multi-workspace system with:
1. **Interactive Workspace Switcher (`<div className="workspace">`)**: Dynamic dropdown in the sidebar to switch workspaces, context-aware navigation (e.g. Engineering vs Audit workspaces), and workspace creation modal.
2. **Granular Per-Workspace RBAC**: Segregation of Duties (SoD) where user permissions (`admin`, `lead`, `member`, `auditor`, `viewer`) are enforced per workspace, while maintaining backward-compatible global user accounts.
3. **Enterprise Access Logs & Audit Trail**: Automated recording of authentication attempts (`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `PASSWORD_CHANGE`) with client IP and user-agent; immutable mutation audit logs (`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `ROLE_CHANGE`) with JSON diffs; dedicated UI log viewer with date/actor filtering and CSV export.
4. **User Profile & Account Settings (`<div className="profile">`)**: Interactive modal to manage display name, job title, avatar color, change password securely, and view recent login access history.

---

## User Review Required

> [!IMPORTANT]
> **Data Migration & Backward Compatibility**:
> - A default workspace **"Cloud workspace (Engineering team)"** (`type: "engineering"`) will be automatically created in the database during migration.
> - All existing projects, tasks, documents, and users will be automatically associated with this default workspace.
> - **Zero data loss or orphaned records** during the upgrade.

> [!NOTE]
> **Hybrid Knowledge Sharing Model (Confirmed)**:
> - Projects, Tasks, and Compliance Documents are strictly scoped to the active workspace.
> - Knowledge Articles support an `isGlobal` flag: articles can be scoped to a specific workspace or made global (visible across all workspaces) to prevent duplicating shared company runbooks.

> [!NOTE]
> **Segregation of Duties (ISO 27001 / Bank of Thailand IT Governance)**:
> - Users with the `auditor` role in a workspace have strictly read-only access: they can review projects, tasks, compliance matrices, access logs, and audit logs, but cannot create, update, or delete any entity.
> - Audit and Access logs are write-only / immutable: no API endpoint permits updating or deleting log records.

---

## Open Questions
*All key architectural decisions were resolved during the grilling interview:*
- **RBAC**: Per-workspace roles via `WorkspaceMember` (`admin`, `lead`, `member`, `auditor`, `viewer`).
- **Data Isolation**: Hybrid (Projects/Tasks strictly workspace-isolated; Knowledge articles support workspace-scoped or global).
- **Profile Scope**: Self-service Profile info + Password change + Recent 5 login attempts.

---

## Proposed Changes

Grouped logically by architectural layer:

---

### Database & Prisma Schema

#### [MODIFY] [schema.prisma](file:///Users/pasitc/PH/cloud-team-management/api/prisma/schema.prisma)
- Add `model Workspace`:
  - `id`: UUID `@id @default(uuid())`
  - `name`: String
  - `type`: String (`"engineering" | "audit" | "operations" | "general"`)
  - `description`: String `@default("")`
  - `color`: String `@default("purple")`
  - `icon`: String `@default("Cloud")`
  - `createdAt`: DateTime `@default(now())`
  - `updatedAt`: DateTime `@updatedAt`
  - Relations: `members WorkspaceMember[]`, `projects Project[]`, `articles KnowledgeArticle[]`, `auditLogs AuditLog[]`
- Add `model WorkspaceMember`:
  - `id`: UUID `@id @default(uuid())`
  - `workspaceId`: String `@map("workspace_id")`
  - `userId`: String `@map("user_id")`
  - `role`: String `@default("member")` (`"admin" | "lead" | "member" | "auditor" | "viewer"`)
  - `joinedAt`: DateTime `@default(now()) @map("joined_at")`
  - `@@unique([workspaceId, userId])`
- Add `model AccessLog`:
  - `id`: UUID `@id @default(uuid())`
  - `userId`: String? `@map("user_id")`
  - `email`: String
  - `action`: String (`"LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT" | "PASSWORD_CHANGE"`)
  - `ipAddress`: String `@map("ip_address")`
  - `userAgent`: String `@map("user_agent")`
  - `failureReason`: String? `@map("failure_reason")`
  - `createdAt`: DateTime `@default(now()) @map("created_at")`
- Add `model AuditLog`:
  - `id`: UUID `@id @default(uuid())`
  - `workspaceId`: String? `@map("workspace_id")`
  - `actorId`: String `@map("actor_id")`
  - `actorName`: String `@map("actor_name")`
  - `actorRole`: String `@map("actor_role")`
  - `action`: String (`"CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "ROLE_CHANGE" | "UPLOAD"`)
  - `entityType`: String (`"Project" | "Task" | "KnowledgeArticle" | "ProjectDocument" | "WorkspaceMember" | "User" | "Workspace"`)
  - `entityId`: String `@map("entity_id")`
  - `details`: Json? `@default("{}")`
  - `createdAt`: DateTime `@default(now()) @map("created_at")`
- Update existing models:
  - `Project`: add `workspaceId String @map("workspace_id")`, relation to `Workspace` (`onDelete: Cascade`)
  - `KnowledgeArticle`: add `workspaceId String? @map("workspace_id")`, `isGlobal Boolean @default(false) @map("is_global")`
  - `User`: add `memberships WorkspaceMember[]`, `accessLogs AccessLog[]`

#### [NEW] [api/prisma/migrations/...](file:///Users/pasitc/PH/cloud-team-management/api/prisma/migrations)
- Create migration script creating tables `workspaces`, `workspace_members`, `access_logs`, `audit_logs`.
- Data backfill SQL to initialize default `"Cloud workspace"`, backfill all existing `projects.workspace_id`, and register all users as members of the default workspace.

---

### Backend API Services & Routes

#### [NEW] [api/src/audit.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/audit.ts)
- Helper function `recordAuditLog(prisma, { actor, workspaceId, action, entityType, entityId, details })` to record immutable mutation events cleanly without cluttering route code.
- Helper function `recordAccessLog(prisma, { userId, email, action, ipAddress, userAgent, failureReason })`.

#### [MODIFY] [api/src/routes/auth.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/auth.ts)
- In `POST /api/auth/login`:
  - Extract IP (`req.headers['x-forwarded-for'] || req.socket.remoteAddress`) and User-Agent (`req.headers['user-agent']`).
  - Log `LOGIN_FAILURE` when credentials fail or user is inactive.
  - Log `LOGIN_SUCCESS` upon successful session start.
- In `POST /api/auth/logout`:
  - Log `LOGOUT` in `access_logs`.
- In `GET /api/auth/me`:
  - Return current user's profile info and their list of `workspaces` (with their per-workspace role).
- Add `PATCH /api/auth/profile`:
  - Update `name` and `title` for the authenticated user.
  - Record `UPDATE` audit log.
- Add `POST /api/auth/change-password`:
  - Verify current password using `verifyPassword`.
  - Validate new password strength.
  - Update `passwordHash` using `hashPassword`.
  - Record `PASSWORD_CHANGE` in `access_logs` and `audit_logs`.
- Add `GET /api/auth/recent-logins`:
  - Retrieve the last 5 `access_logs` for `userId: req.session.userId`.

#### [NEW] [api/src/routes/workspaces.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/workspaces.ts)
- `GET /api/workspaces`: List workspaces the authenticated user belongs to.
- `POST /api/workspaces`: Create a new workspace (`admin` platform role or workspace creator), adds creator as `admin`.
- `GET /api/workspaces/:id`: Get workspace details and member list.
- `PATCH /api/workspaces/:id`: Update workspace name/description/type (`admin` only).
- `POST /api/workspaces/:id/members`: Add or invite user to workspace with specific role (`admin` only).
- `PATCH /api/workspaces/:id/members/:userId`: Update member's workspace role (`admin` only).
- `DELETE /api/workspaces/:id/members/:userId`: Remove member from workspace (`admin` only).

#### [NEW] [api/src/routes/logs.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/logs.ts)
- `GET /api/logs/access`: Query access logs (accessible by `admin` and `auditor`), supports filtering by `action`, `search`, and date range.
- `GET /api/logs/audit`: Query data audit logs (accessible by `admin` and `auditor`), supports filtering by `workspaceId`, `entityType`, `action`, `actorId`, and date range.
- `GET /api/logs/export`: Stream CSV download of filtered audit or access logs for ISO 27001 / BOT regulatory audits.

#### [MODIFY] [api/src/routes/projects.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/projects.ts)
- Scope `GET /api/projects` by `workspaceId` query param or active workspace session header.
- On `POST /api/projects`: validate workspace membership, record `CREATE` audit log.
- On `PATCH /api/projects/:id` and `DELETE /api/projects/:id`: verify role and record `UPDATE` / `DELETE` audit log.

#### [MODIFY] [api/src/routes/tasks.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/tasks.ts)
- Scope tasks by workspace through their parent project.
- Record `CREATE`, `UPDATE`, `DELETE` audit logs for all task modifications.

#### [MODIFY] [api/src/routes/knowledge.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/routes/knowledge.ts)
- Scope `GET /api/knowledge` to show articles where `isGlobal === true` OR `workspaceId === activeWorkspaceId`.
- Record `CREATE`, `UPDATE`, `DELETE` audit logs.

#### [MODIFY] [api/src/app.ts](file:///Users/pasitc/PH/cloud-team-management/api/src/app.ts)
- Mount `app.use('/api/workspaces', workspacesRoutes(prisma))`.
- Mount `app.use('/api/logs', logsRoutes(prisma))`.

---

### Frontend UI Features

#### [NEW] [web/src/workspace-switcher.tsx](file:///Users/pasitc/PH/cloud-team-management/web/src/workspace-switcher.tsx)
- Replaces static `<div className="workspace">` with an interactive dropdown:
  - Displays active workspace name, team type badge (`Engineering`, `Audit`, etc.), and icon.
  - Dropdown lists all available workspaces with active checkmark.
  - Prominent `+ New Workspace` button for admins.
  - Modal to create a new workspace (Name, Type, Description).

#### [NEW] [web/src/user-profile-dialog.tsx](file:///Users/pasitc/PH/cloud-team-management/web/src/user-profile-dialog.tsx)
- Modal triggered by clicking `<div className="profile">` in the sidebar footer:
  - **Tab 1: Profile Details**: Edit display name, job title, and choose avatar color with live preview.
  - **Tab 2: Password & Security**: Change password form (Current password, New password, Confirm password) with validation.
  - **Tab 3: Recent Activity**: Table showing last 5 login access logs (IP, Device/Browser, Timestamp, Status badge).

#### [NEW] [web/src/logs-viewer.tsx](file:///Users/pasitc/PH/cloud-team-management/web/src/logs-viewer.tsx)
- Dedicated view for "Logs & Audit Trail":
  - Sub-tabs: **Audit Logs** (mutations) and **Access Logs** (logins/logouts).
  - Search filter (by actor, entity, IP, or email).
  - Type & Action dropdown filters.
  - "Export CSV" button for compliance submissions.
  - Detailed diff viewer showing modified fields in JSON format.

#### [MODIFY] [web/src/App.tsx](file:///Users/pasitc/PH/cloud-team-management/web/src/App.tsx)
- Integrate `activeWorkspace` state and `workspaces` list.
- Replace static `<div className="workspace">` with `<WorkspaceSwitcher>`.
- Hook `<div className="profile">` click event to open `<UserProfileDialog>`.
- Add `"Logs & Audit"` item to sidebar navigation (accessible to `admin` and `auditor`).
- Pass active workspace ID to API requests for scoped project and task filtering.

---

## Verification Plan

### Automated Tests
1. **Backend Integration Tests** (`npm --prefix api test`):
   - `api/test/workspaces.test.ts`: Verify workspace CRUD, member role assignments, and workspace isolation.
   - `api/test/access-logs.test.ts`: Verify login success/failure logging, IP recording, and recent-logins endpoint.
   - `api/test/audit-logs.test.ts`: Verify mutation recording on Projects, Tasks, and Knowledge articles, immutability check (no deletion allowed), and CSV export.
   - `api/test/profile.test.ts`: Verify profile updates, password change validation with current password verification.
   - Run full regression suite: `DATABASE_URL=postgresql://postgres:change-me-long-random@127.0.0.1:5432/ctm_test npm --prefix api test`.
2. **Frontend Unit Tests** (`npm --prefix web test`):
   - `web/src/workspace-switcher.test.tsx`: Test switching workspaces, rendering active workspace, and opening create modal.
   - `web/src/user-profile-dialog.test.tsx`: Test profile edit, password change validation, and login history display.
   - `web/src/logs-viewer.test.tsx`: Test audit log filtering, tab switching, and CSV export action.
   - Full web test suite: `npm --prefix web test`.
3. **Production Builds**:
   - `npm --prefix api run build` (TypeScript check)
   - `npm --prefix web run build` (Vite build)

### Manual Verification
1. **Workspace Switching**:
   - Click `<div className="workspace">`, observe dropdown.
   - Switch from "Cloud workspace (Engineering team)" to an "Internal Audit" workspace.
   - Verify that projects list updates according to the selected workspace.
2. **Per-Workspace Roles**:
   - Verify that in an Audit workspace, the banner shows Compliance Inspector Mode (Read-Only) and mutation buttons are hidden for auditors.
3. **Profile Modal**:
   - Click `<div className="profile">` in the sidebar footer.
   - Update display name and save; verify UI updates immediately.
   - Attempt password change with incorrect current password -> verify error message.
   - Change password successfully -> verify new password works on next login.
   - View recent login logs in the modal.
4. **Audit Trail**:
   - Create a task -> Navigate to "Logs & Audit" -> verify `CREATE` `Task` entry with actor name.
   - Click "Export CSV" and inspect downloaded CSV structure.
5. **Docker Compose Rebuild**:
   - Run `docker compose up -d --build` and verify `caddy`, `api`, and `postgres` containers start cleanly and health checks pass.
