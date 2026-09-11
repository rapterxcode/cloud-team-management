import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWorkspaceTypeLabel,
  canManageWorkspace,
  canCreateEntities,
  isAuditorReadOnly,
  filterAuditLogs,
  filterAccessLogs,
} from './workspace-rbac.mjs';

test('getWorkspaceTypeLabel returns readable labels', () => {
  assert.equal(getWorkspaceTypeLabel('engineering'), 'Engineering team');
  assert.equal(getWorkspaceTypeLabel('audit'), 'Internal Audit & Compliance');
  assert.equal(getWorkspaceTypeLabel('operations'), 'Cloud Operations & SRE');
  assert.equal(getWorkspaceTypeLabel('general'), 'General Project Team');
  assert.equal(getWorkspaceTypeLabel('unknown'), 'Engineering team');
});

test('RBAC role permission checks', () => {
  // Platform admin can manage any workspace
  assert.equal(canManageWorkspace('admin', 'member'), true);
  // Workspace admin can manage workspace
  assert.equal(canManageWorkspace('member', 'admin'), true);
  // Standard member cannot
  assert.equal(canManageWorkspace('member', 'member'), false);
  // Auditor cannot
  assert.equal(canManageWorkspace('auditor', 'viewer'), false);

  // canCreateEntities
  assert.equal(canCreateEntities('member', 'member'), true);
  assert.equal(canCreateEntities('member', 'lead'), true);
  assert.equal(canCreateEntities('auditor', 'member'), false); // platform auditor blocked
  assert.equal(canCreateEntities('member', 'auditor'), false); // workspace auditor blocked
  assert.equal(canCreateEntities('member', 'viewer'), false); // workspace viewer blocked

  // isAuditorReadOnly
  assert.equal(isAuditorReadOnly('auditor', 'member'), true);
  assert.equal(isAuditorReadOnly('member', 'auditor'), true);
  assert.equal(isAuditorReadOnly('member', 'member'), false);
});

test('filterAuditLogs filters by action, entity, and search query', () => {
  const sampleLogs = [
    { id: '1', action: 'CREATE', entityType: 'Project', actorName: 'Alice Morgan', entityId: 'proj-1' },
    { id: '2', action: 'UPDATE', entityType: 'Task', actorName: 'Bob Chen', entityId: 'task-1' },
    { id: '3', action: 'DELETE', entityType: 'Project', actorName: 'Alice Morgan', entityId: 'proj-2' },
  ];

  const filteredAction = filterAuditLogs(sampleLogs, { action: 'CREATE' });
  assert.equal(filteredAction.length, 1);
  assert.equal(filteredAction[0].id, '1');

  const filteredEntity = filterAuditLogs(sampleLogs, { entityType: 'Project' });
  assert.equal(filteredEntity.length, 2);

  const filteredSearch = filterAuditLogs(sampleLogs, { search: 'Bob' });
  assert.equal(filteredSearch.length, 1);
  assert.equal(filteredSearch[0].actorName, 'Bob Chen');
});

test('filterAccessLogs filters by action and search query', () => {
  const sampleAccess = [
    { id: '1', action: 'LOGIN_SUCCESS', email: 'alice@cloudteam.internal', ipAddress: '192.168.1.1' },
    { id: '2', action: 'LOGIN_FAILURE', email: 'bob@cloudteam.internal', ipAddress: '10.0.0.5', failureReason: 'INVALID_PASSWORD' },
  ];

  const failedOnly = filterAccessLogs(sampleAccess, { action: 'LOGIN_FAILURE' });
  assert.equal(failedOnly.length, 1);
  assert.equal(failedOnly[0].email, 'bob@cloudteam.internal');

  const searchIp = filterAccessLogs(sampleAccess, { search: '192.168' });
  assert.equal(searchIp.length, 1);
  assert.equal(searchIp[0].id, '1');
});
