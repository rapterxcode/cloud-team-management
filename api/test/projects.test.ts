import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function memberCookie(base: string) {
  await createUser('m@team.test', 'pw123456');
  return (await login(base, 'm@team.test', 'pw123456')).cookie;
}

test('member creates, edits, lists projects; blank name rejected', async () => {
  const { base, close } = await makeServer();
  const cookie = await memberCookie(base);

  const created = await fetch(base + '/api/projects', authed(cookie, 'POST', { name: '  Migration  ', description: 'd' }));
  assert.equal(created.status, 201);
  const p = await created.json();
  assert.equal(p.name, 'Migration'); // trimmed
  assert.equal(p.status, 'On track');
  assert.equal(p.color, 'purple'); // preserved default

  const blank = await fetch(base + '/api/projects', authed(cookie, 'POST', { name: '  ' }));
  assert.equal(blank.status, 400);
  assert.equal((await blank.json()).error, 'A name is required');

  const patched = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'PATCH', { status: 'At risk', progress: 40, department: 'DevOps' }));
  assert.equal((await patched.json()).status, 'At risk');

  const badStatus = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'PATCH', { status: 'Broken' }));
  assert.equal(badStatus.status, 400);

  const list = await fetch(base + '/api/projects', authed(cookie));
  assert.equal((await list.json()).length, 1);
  await close();
});

test('deleting a project cascades its tasks', async () => {
  const { base, close } = await makeServer();
  const cookie = await memberCookie(base);
  const owner = await prisma.user.findFirst();
  const p = await prisma.project.create({ data: { name: 'P' } });
  await prisma.task.create({ data: { projectId: p.id, name: 'T', ownerId: owner!.id } });
  const del = await fetch(base + `/api/projects/${p.id}`, authed(cookie, 'DELETE'));
  assert.equal(del.status, 204);
  assert.equal(await prisma.task.count(), 0);
  await close();
});
