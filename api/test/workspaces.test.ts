import test from 'node:test';
import assert from 'node:assert/strict';
import { authed, createUser, login, makeServer, prisma, resetDb } from './helpers.js';

test('workspaces: CRUD, member roles, and isolation', async (t) => {
  await resetDb();
  const server = await makeServer();
  t.after(server.close);

  const admin = await createUser('admin@example.com', 'password123', 'admin');
  const lead = await createUser('lead@example.com', 'password123', 'member');
  const auditor = await createUser('auditor@example.com', 'password123', 'auditor');

  const { cookie: adminCookie } = await login(server.base, admin.email, 'password123');
  const { cookie: leadCookie } = await login(server.base, lead.email, 'password123');
  const { cookie: auditorCookie } = await login(server.base, auditor.email, 'password123');

  // 1. Auditor cannot create workspace (read-only guard)
  const auditCreate = await fetch(`${server.base}/api/workspaces`, authed(auditorCookie, 'POST', {
    name: 'Audit Review Workspace',
  }));
  assert.equal(auditCreate.status, 403);

  // 2. Admin creates a new workspace
  const createRes = await fetch(`${server.base}/api/workspaces`, authed(adminCookie, 'POST', {
    name: 'Security & Governance',
    type: 'audit',
    description: 'Workspace for ISO 27001 & BOT compliance checks',
    color: 'emerald',
    icon: 'ShieldCheck',
  }));
  assert.equal(createRes.status, 201);
  const createdWs = await createRes.json();
  assert.equal(createdWs.name, 'Security & Governance');
  assert.equal(createdWs.type, 'audit');

  // 3. Add lead user to workspace as 'lead'
  const addMemberRes = await fetch(`${server.base}/api/workspaces/${createdWs.id}/members`, authed(adminCookie, 'POST', {
    userId: lead.id,
    role: 'lead',
  }));
  assert.equal(addMemberRes.status, 200);
  const memberObj = await addMemberRes.json();
  assert.equal(memberObj.role, 'lead');

  // 4. Lead lists workspaces they belong to
  const leadWsRes = await fetch(`${server.base}/api/workspaces`, authed(leadCookie));
  assert.equal(leadWsRes.status, 200);
  const leadWorkspaces = await leadWsRes.json();
  assert.ok(leadWorkspaces.some((w: any) => w.id === createdWs.id));

  // 5. Update workspace settings
  const patchWs = await fetch(`${server.base}/api/workspaces/${createdWs.id}`, authed(adminCookie, 'PATCH', {
    description: 'Updated description for ISO 27001 audits',
  }));
  assert.equal(patchWs.status, 200);
  const updatedWs = await patchWs.json();
  assert.equal(updatedWs.description, 'Updated description for ISO 27001 audits');

  // 6. Default workspace cannot be deleted
  const deleteDefault = await fetch(`${server.base}/api/workspaces/default-workspace-engineering`, authed(adminCookie, 'DELETE'));
  assert.equal(deleteDefault.status, 400);

  // 7. Delete custom workspace
  const deleteWs = await fetch(`${server.base}/api/workspaces/${createdWs.id}`, authed(adminCookie, 'DELETE'));
  assert.equal(deleteWs.status, 200);
});
