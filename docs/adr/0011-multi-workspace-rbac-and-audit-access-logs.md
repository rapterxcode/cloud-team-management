# ADR 0011: Multi-Workspace Switcher, Per-Workspace RBAC, Access & Audit Logs, and User Profile

## Context
As the Cloud Team Management platform expands beyond a single engineering team to multi-disciplinary teams (e.g. Platform Engineering, DevSecOps, Cloud Governance, and Internal Audit), the system faces four critical architectural requirements:
1. **Workspace Context Switcher (`<div className="workspace">`)**: Previously, the workspace banner was hardcoded static HTML. Different teams require dedicated, isolated workspaces with context-aware navigation and project separation.
2. **Per-Workspace Role-Based Access Control (RBAC)**: A user may be a `lead` or `member` in the Platform Engineering workspace, but an `auditor` or `viewer` in the Compliance and Governance workspace. A monolithic global role is insufficient.
3. **Enterprise Compliance Logging (Access Logs & Mutation Audit Trail)**: Under ISO 27001 (A.12.4 Logging & Monitoring) and Bank of Thailand (BOT) IT Governance standards, all authentication attempts (successful/failed) and data mutations (CREATE, UPDATE, DELETE, ROLE_CHANGE) must be recorded in an immutable, searchable audit trail with CSV export capability.
4. **User Profile & Account Settings (`<div className="profile">`)**: Users need a self-service way to update their display name, job title, avatar color, change their password securely, and review their recent login activity.

## Decisions

### 1. Multi-Workspace Architecture & Hybrid Data Isolation
- **Data Model**:
  - `Workspace`: `id`, `name`, `type` (`engineering` | `audit` | `operations` | `general`), `description`, `color`, `icon`, `createdAt`, `updatedAt`.
  - `WorkspaceMember`: `id`, `workspaceId`, `userId`, `role` (`admin` | `lead` | `member` | `auditor` | `viewer`), `joinedAt`, with `@@unique([workspaceId, userId])`.
  - `Project.workspaceId`: Foreign key to `Workspace.id` (onDelete: Cascade).
  - `KnowledgeArticle.workspaceId`: Optional foreign key to `Workspace.id`. Articles also have an `isGlobal` boolean flag (default `false`). When `isGlobal` is true, the article is accessible across all workspaces.
- **Backward-Compatible Migration**:
  - Initial database migration automatically creates a default `"Cloud workspace"` (`type: "engineering"`).
  - All existing projects and all active users are linked into this default workspace.
  - Zero existing projects, tasks, or documents are orphaned.
- **Frontend Workspace Switcher**:
  - The static `<div className="workspace">` in the sidebar header becomes an interactive dropdown menu displaying the current active workspace, team type badge, and a list of all workspaces the authenticated user belongs to.
  - Users with `admin` permission can create new workspaces via a modal.

### 2. Per-Workspace RBAC & Segregation of Duties (SoD)
- **Role Hierarchy**:
  - `admin`: Full administrative control over the workspace (member invites, role assignments, workspace settings).
  - `lead`: Project manager and team leader; has Maker-Checker approval authority and project creation rights.
  - `member`: Standard engineer/contributor; can create/update tasks, author SOPs, and upload project documents.
  - `auditor`: Strictly read-only compliance inspector (ISO 27001 / BOT SoD); can view compliance matrix, inspect audit/access logs, download evidence, but cannot mutate any records.
  - `viewer`: Read-only observer.
- **Platform Role vs Workspace Role**:
  - `User.role` remains as platform super-admin flag (`admin` vs `member`).
  - Workspace actions are authorized via `WorkspaceMember.role`.

### 3. Enterprise Access Logs & Data Audit Trail
- **Access Logs (`access_logs` table)**:
  - Records every login attempt (`LOGIN_SUCCESS`, `LOGIN_FAILURE`), logout (`LOGOUT`), and password update (`PASSWORD_CHANGE`).
  - Captures: `id`, `userId` (optional), `email`, `action`, `ipAddress` (from `X-Forwarded-For` or socket), `userAgent`, `failureReason`, `createdAt`.
- **Data Audit Logs (`audit_logs` table)**:
  - Immutable audit trail capturing mutations across `Project`, `Task`, `KnowledgeArticle`, `ProjectDocument`, and `WorkspaceMember`.
  - Captures: `id`, `workspaceId` (optional), `actorId`, `actorName`, `actorRole`, `action` (`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `ROLE_CHANGE`), `entityType`, `entityId`, `details` (JSON payload diff/metadata), `createdAt`.
  - Immutability: No update or delete endpoints exist for audit logs.
- **Audit & Access Log Viewer UI**:
  - A dedicated view accessible in the sidebar (under "Logs & Audit" or Governance).
  - Provides date filtering, actor search, action filter, entity filter, and CSV export.

### 4. User Profile & Account Settings Modal
- Clicking `<div className="profile">` in the sidebar footer opens the User Profile modal:
  - **Profile Information**: Update Display Name, Job Title, Avatar color.
  - **Security**: Change password (validates current password, enforces minimum length).
  - **Recent Logins**: Displays the user's last 5 access log entries with timestamp, IP, device, and status.

## Consequences & Compliance
- Satisfies ISO 27001 Control A.9 (Access Control) and A.12.4 (Logging and Monitoring).
- Satisfies Bank of Thailand (BOT) Segregation of Duties (SoD) by separating operational engineers (`member`) from compliance auditors (`auditor`).
- Retains 100% backward compatibility with all existing test suites and live database records.
