import test from 'node:test';
import assert from 'node:assert/strict';
import { authed, createUser, login, makeServer, prisma, resetDb } from './helpers.js';

test('audit logs: records mutations on projects/tasks and provides CSV export', async (t) => {
  await resetDb();
  const server = await makeServer();
  t.after(server.close);

  const admin = await createUser('admin@example.com', 'adminpass123', 'admin');
  const { cookie: adminCookie } = await login(server.base, admin.email, 'adminpass123');

  // 1. Create a project -> triggers CREATE AuditLog
  const createProj = await fetch(`${server.base}/api/projects`, authed(adminCookie, 'POST', {
    name: 'Kubernetes Cluster Upgrade 2026',
    department: 'Platform',
    year: 2026,
  }));
  assert.equal(createProj.status, 201);
  const project = await createProj.json();

  // 2. Create a task -> triggers CREATE AuditLog
  const createTask = await fetch(`${server.base}/api/tasks`, authed(adminCookie, 'POST', {
    projectId: project.id,
    name: 'Drain worker nodes',
    ownerId: admin.id,
    priority: 'High',
  }));
  assert.equal(createTask.status, 201);
  const task = await createTask.json();

  // 3. Patch the task -> triggers UPDATE AuditLog
  const patchTask = await fetch(`${server.base}/api/tasks/${task.id}`, authed(adminCookie, 'PATCH', {
    status: 'In progress',
  }));
  assert.equal(patchTask.status, 200);

  // 4. Query audit logs via /api/logs/audit
  const queryLogs = await fetch(`${server.base}/api/logs/audit?entityType=Task`, authed(adminCookie));
  assert.equal(queryLogs.status, 200);
  const logsData = await queryLogs.json();
  assert.ok(logsData.items.length >= 2); // CREATE + UPDATE
  assert.equal(logsData.items[0].entityType, 'Task');

  // 5. CSV export of audit logs
  const exportRes = await fetch(`${server.base}/api/logs/export?type=audit`, authed(adminCookie));
  assert.equal(exportRes.status, 200);
  assert.ok(exportRes.headers.get('content-type')?.includes('text/csv'));
  const csvContent = await exportRes.text();
  assert.ok(csvContent.includes('Drain worker nodes') || csvContent.includes('Kubernetes Cluster Upgrade'));
});
