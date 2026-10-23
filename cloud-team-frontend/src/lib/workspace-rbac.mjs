/**
 * Pure functions for Workspace, RBAC, and Audit Logging
 */

export function getWorkspaceTypeLabel(type) {
  switch (type) {
    case 'audit':
      return 'Internal Audit & Compliance';
    case 'operations':
      return 'Cloud Operations & SRE';
    case 'general':
      return 'General Project Team';
    case 'engineering':
    default:
      return 'Engineering team';
  }
}

export function canManageWorkspace(platformRole, workspaceRole) {
  if (platformRole === 'admin') return true;
  return workspaceRole === 'admin';
}

export function canCreateEntities(platformRole, workspaceRole) {
  if (platformRole === 'auditor' || workspaceRole === 'auditor' || workspaceRole === 'viewer') {
    return false;
  }
  return true;
}

export function isAuditorReadOnly(platformRole, workspaceRole) {
  return platformRole === 'auditor' || workspaceRole === 'auditor';
}

export function filterAuditLogs(logs, { action, entityType, search }) {
  return logs.filter((log) => {
    if (action && action !== 'All' && log.action !== action) return false;
    if (entityType && entityType !== 'All' && log.entityType !== entityType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchActor = (log.actorName || '').toLowerCase().includes(q);
      const matchEntity = (log.entityId || '').toLowerCase().includes(q);
      const matchAction = (log.action || '').toLowerCase().includes(q);
      if (!matchActor && !matchEntity && !matchAction) return false;
    }
    return true;
  });
}

export function filterAccessLogs(logs, { action, search }) {
  return logs.filter((log) => {
    if (action && action !== 'All' && log.action !== action) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchEmail = (log.email || '').toLowerCase().includes(q);
      const matchIp = (log.ipAddress || '').toLowerCase().includes(q);
      const matchReason = (log.failureReason || '').toLowerCase().includes(q);
      if (!matchEmail && !matchIp && !matchReason) return false;
    }
    return true;
  });
}
