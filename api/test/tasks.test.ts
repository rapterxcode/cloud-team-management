import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(base: string) {
  const member = await createUser('m@team.test', 'pw123456');
  const cookie = (await login(base, 'm@team.test', 'pw123456')).cookie;
  const project = await prisma.project.create({ data: { name: 'P' } });
  return { member, cookie, project };
}

test('creates task with defaults, completes it via PATCH', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const created = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'Ship it', ownerId: member.id, phase: 'Development', start: '2026-09-01', date: '2026-09-05',
  }));
  assert.equal(created.status, 201);
  const t = await created.json();
  assert.equal(t.priority, 'Medium'); // preserved silent default
  assert.equal(t.status, 'To do');
  assert.equal(t.owner.name, 'm');

  const done = await fetch(base + `/api/tasks/${t.id}`, authed(cookie, 'PATCH', { status: 'Done' }));
  assert.equal((await done.json()).status, 'Done');
  await close();
});

test('date validation matches gantt.mjs messages', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const reversed = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'X', ownerId: member.id, start: '2026-09-10', date: '2026-09-09',
  }));
  assert.equal(reversed.status, 400);
  assert.equal((await reversed.json()).error, 'Finish must be on or after start.');
  const half = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'X', ownerId: member.id, start: '2026-09-10', date: '',
  }));
  assert.equal((await half.json()).error, 'Enter both a start and finish date, or leave both empty.');
  await close();
});

test('owner must be an active user; deactivated owner keeps existing tasks', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const ghost = await createUser('ghost@team.test', 'pw123456', 'member', { isActive: false });
  const rejected = await fetch(base + '/api/tasks', authed(cookie, 'POST', { projectId: project.id, name: 'X', ownerId: ghost.id }));
  assert.equal(rejected.status, 400);

  const t = await prisma.task.create({ data: { projectId: project.id, name: 'Kept', ownerId: member.id } });
  await prisma.user.update({ where: { id: member.id }, data: { isActive: false } });
  assert.equal((await prisma.task.findUnique({ where: { id: t.id } }))?.ownerId, member.id);
  await close();
});

test('invalid phase/status rejected; delete works', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);
  const bad = await fetch(base + '/api/tasks', authed(cookie, 'POST', { projectId: project.id, name: 'X', ownerId: member.id, phase: 'Testing' }));
  assert.equal(bad.status, 400);
  const t = await prisma.task.create({ data: { projectId: project.id, name: 'Del', ownerId: member.id } });
  assert.equal((await fetch(base + `/api/tasks/${t.id}`, authed(cookie, 'DELETE'))).status, 204);
  assert.equal(await prisma.task.count(), 0);
  await close();
});

test('task description can be set, updated, and validated for max length', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);

  // Default description is empty string
  const created = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'With notes', ownerId: member.id,
    description: 'Detailed runbook notes\nStep 1: Check logs\nStep 2: Deploy',
  }));
  assert.equal(created.status, 201);
  const t = await created.json();
  assert.equal(t.description, 'Detailed runbook notes\nStep 1: Check logs\nStep 2: Deploy');

  // Update description via PATCH
  const updated = await fetch(base + `/api/tasks/${t.id}`, authed(cookie, 'PATCH', {
    description: 'Updated notes',
  }));
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).description, 'Updated notes');

  // Reject oversized description (> 10000 chars)
  const tooLong = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'Too long', ownerId: member.id,
    description: 'A'.repeat(10001),
  }));
  assert.equal(tooLong.status, 400);
  assert.match((await tooLong.json()).error, /Description cannot exceed 10000 characters/);

  await close();
});

test('task priority can be set on creation and rejects invalid priority', async () => {
  const { base, close } = await makeServer();
  const { member, cookie, project } = await setup(base);

  const created = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'Urgent task', ownerId: member.id, priority: 'High',
  }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).priority, 'High');

  const invalid = await fetch(base + '/api/tasks', authed(cookie, 'POST', {
    projectId: project.id, name: 'Bad priority', ownerId: member.id, priority: 'Critical',
  }));
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /Priority/);

  await close();
});

