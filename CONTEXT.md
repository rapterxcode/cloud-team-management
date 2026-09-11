# Cloud Team Management

The platform a cloud engineering team uses to track projects, tasks, knowledge, team roster, and cloud resource inventory.

## Language

**User**:
A person with a login account on the platform. Replaces the old hardcoded "member" concept — the Team directory is now a view over Users, not a separate roster.
_Avoid_: Member, account, team member (when referring to the entity itself — "team member" is fine as prose, not as a schema/type name)

**Task**:
A distinct unit of work belonging to a single Project and owned by one User, with an execution phase, status, dates, description notes, an optional SOP reference to a Knowledge article, and an optional change authorization link to a CR/CC Project document.
_Avoid_: Ticket, issue, item, action item, subtask

**Task SOP**:
A referenced Knowledge article linked to a Task to guide the Task owner through procedures or runbook execution.
_Avoid_: Task guide, instructions link

**Change authorization**:
A direct link between a Task and an approved Change Request (CR) or Change Control (CC) Project document, providing audit-ready traceability under ISO 27001 (A.12.1.2) and BOT IT Governance.
_Avoid_: CR link, approval note

**Task owner**:
The single User responsible for a Task, stored as a foreign key to `users.id` (not a name snapshot). Chosen from the same closed list of Users that populates the Team directory.
_Avoid_: Assignee (not used anywhere in the existing UI copy)

**Team**:
The full roster of Users on the platform. Shown on the Team page/nav item.
_Avoid_: Using "team" for anything other than the User roster — see Project department below for the collision this used to cause.

**Deactivated user**:
A User whose `is_active` flag is off: they cannot log in and don't appear in the Owner picker for new Tasks, but their User row is never deleted — Tasks they own keep their `owner_id` and history stays intact. Users are deactivated, never hard-deleted.
_Avoid_: Deleting a user, removing a user (as an action name)

**Role**:
An access level flag on a User: `admin`, `member`, or `auditor`.
- `admin`: Full administration, user creation/deactivation, and unrestricted CRUD.
- `member`: Engineering team members with standard CRUD access across projects, tasks, knowledge, and document uploads.
- `auditor`: Read-only compliance inspector role satisfying ISO 27001 (A.9) and Bank of Thailand (BOT) segregation of duties. Can view dashboards, projects, tasks, knowledge, and preview/download project documents, but cannot create, modify, or delete any entities.
_Avoid_: Viewer, guest, read-only user

**Project department**:
A free-text label on a Project naming which department/squad owns it (e.g. "Platform", "Engineering", "DevOps"). Stored as `Project.department`, not `Project.team` — the old field name collided with the Team (User roster) concept above. Display copy may still say "Team" in the UI; the rename is schema/code only.
_Avoid_: Project.team (old field name, retired)

**Knowledge article**:
A documentation or runbook record, written in Markdown. May be Global (shared across the engineering team) or Project-scoped (linked directly to a specific Project).
_Avoid_: Wiki page, note, doc

**Attachment**:
A file (PDF, Office doc, image, or plain text; capped per file) uploaded to a Knowledge article. One article may have any number of Attachments — it's a one-to-many relationship, not a single-file field.

**Project document**:
An audit evidence or compliance artifact (e.g. PDF, spreadsheet, diagram, Office doc) attached directly to a Project and categorized by regulatory standards (ISO 27001 / BOT), such as Change Request (CR), Change Control (CC), Cloud Risk Assessment, Architecture Diagram, or RBAC Matrix. Deletable only by its uploader or an admin; auditors have strictly read-only access.
_Avoid_: File, project attachment (distinguished from Knowledge article Attachment)

**Compliance matrix**:
A cross-project audit readiness view mapping each Project against mandatory regulatory checkpoints (Cloud Risk Assessment, Architecture Diagram, RBAC Matrix, Change Control, and Test Evidence) required by ISO 27001 and BOT standards.
_Avoid_: Audit dashboard, compliance report

**Workload**:
The percentage capacity utilized by a User, derived dynamically from the count of active, incomplete Tasks they currently own.
_Avoid_: Bandwidth, effort, story points, logged hours

**Table of Contents (TOC)**:
An interactive outline extracted dynamically from Markdown headings (H1–H3) of a Knowledge article, providing rapid anchor jumps and scrollspy tracking during runbook and SOP review.
_Avoid_: Index, header list, outline tree

**Interactive HTML page**:
A Knowledge article format supporting HTML, CSS, and client-side JavaScript executed inside an isolated, secure sandboxed iframe to render interactive tools, calculators, and rich visual documentation safely without privilege escalation.
_Avoid_: Custom widget, embedded site

**Knowledge category**:
A dynamic organizational taxonomy for classifying Knowledge articles (e.g. Guides, Runbooks, Security SOPs, Architecture) that can be created, edited, customized, and filtered across the platform.
_Avoid_: Tag, topic label

**Knowledge document importer**:
A document intake workflow that reads uploaded `.md`, `.html`, or `.txt` files directly into a Knowledge article with automatic title and format extraction.
_Avoid_: Bulk uploader, file sync

**Knowledge Copilot Assistant**:
An in-editor AI co-author powered by Gemini and grounded in live workspace context (projects, resources, roster) that drafts new Knowledge articles, refines existing documentation, enhances formatting (checklists, code blocks, tables), and transforms Markdown into interactive HTML pages with user-in-the-loop review.
_Avoid_: Auto-writer, bot generator





