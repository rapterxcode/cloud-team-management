# Cloud Team Management

The platform a cloud engineering team uses to track projects, tasks, knowledge, team roster, and cloud resource inventory.

## Language

**User**:
A person with a login account on the platform. Replaces the old hardcoded "member" concept — the Team directory is now a view over Users, not a separate roster.
_Avoid_: Member, account, team member (when referring to the entity itself — "team member" is fine as prose, not as a schema/type name)

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
An admin or member flag on a User. `admin` can additionally create and deactivate User accounts. `member` has the same flat, unrestricted CRUD access on projects/tasks/knowledge/cloud resources that every logged-in user has today — no ownership-based restrictions.

**Project department**:
A free-text label on a Project naming which department/squad owns it (e.g. "Platform", "Engineering", "DevOps"). Stored as `Project.department`, not `Project.team` — the old field name collided with the Team (User roster) concept above. Display copy may still say "Team" in the UI; the rename is schema/code only.
_Avoid_: Project.team (old field name, retired)

**Attachment**:
A file (PDF, Office doc, image, or plain text; capped per file) uploaded to a Knowledge article. One article may have any number of Attachments — it's a one-to-many relationship, not a single-file field.
