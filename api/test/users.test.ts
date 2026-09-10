import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('anonymous requests are rejected; members can read roster but not create users', async () => {
  const { base, close } = await makeServer();
  await createUser('member@team.test', 'pw123456');
  assert.equal((await fetch(base + '/api/users')).status, 401);
  const { cookie } = await login(base, 'member@team.test', 'pw123456');
  const list = await fetch(base + '/api/users', authed(cookie));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).length, 1);
  const create = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'x@y.z', name: 'X', password: 'pw123456' }));
  assert.equal(create.status, 403);
  await close();
});

test('admin creates a user, resets password, deactivates', async () => {
  const { base, close } = await makeServer();
  await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');

  const created = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'new@team.test', name: 'New Person', password: 'first-pass-1', title: 'SRE' }));
  assert.equal(created.status, 201);
  const newUser = await created.json();
  assert.equal((await login(base, 'new@team.test', 'first-pass-1')).status, 200);

  await fetch(base + `/api/users/${newUser.id}`, authed(cookie, 'PATCH', { password: 'second-pass-2' }));
  assert.equal((await login(base, 'new@team.test', 'first-pass-1')).status, 401);
  assert.equal((await login(base, 'new@team.test', 'second-pass-2')).status, 200);

  await fetch(base + `/api/users/${newUser.id}`, authed(cookie, 'PATCH', { isActive: false }));
  assert.equal((await login(base, 'new@team.test', 'second-pass-2')).status, 401);
  await close();
});

test('duplicate email returns 400 with error body', async () => {
  const { base, close } = await makeServer();
  await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');
  const dup = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'admin@team.test', name: 'Dup', password: 'pw123456' }));
  assert.equal(dup.status, 400);
  assert.ok((await dup.json()).error);
  await close();
});

test('the last active admin cannot deactivate or demote themselves; short passwords rejected', async () => {
  const { base, close } = await makeServer();
  const admin = await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');

  const selfOff = await fetch(base + `/api/users/${admin.id}`, authed(cookie, 'PATCH', { isActive: false }));
  assert.equal(selfOff.status, 400);
  const demote = await fetch(base + `/api/users/${admin.id}`, authed(cookie, 'PATCH', { role: 'member' }));
  assert.equal(demote.status, 400);
  const shortPw = await fetch(base + '/api/users', authed(cookie, 'POST', { email: 'x@team.test', name: 'X', password: 'short' }));
  assert.equal(shortPw.status, 400);

  // With a second admin present, demotion is allowed.
  await createUser('admin2@team.test', 'pw123456', 'admin');
  const ok = await fetch(base + `/api/users/${admin.id}`, authed(cookie, 'PATCH', { role: 'member' }));
  assert.equal(ok.status, 200);
  await close();
});

test('GET /users derives workload from active tasks (20% per task, max 100%, ignores Done)', async () => {
  const { base, close } = await makeServer();
  await createUser('admin@team.test', 'pw123456', 'admin');
  const member = await createUser('member@team.test', 'pw123456', 'member');
  const { cookie } = await login(base, 'member@team.test', 'pw123456');

  // Initially 0 tasks => workload 0
  let res = await fetch(base + '/api/users', authed(cookie));
  let users = await res.json();
  let m = users.find((u: any) => u.id === member.id);
  assert.equal(m.workload, 0);

  const project = await prisma.project.create({ data: { name: 'P' } });
  // Add 2 active tasks for member
  await prisma.task.create({ data: { projectId: project.id, name: 'T1', ownerId: member.id, status: 'To do' } });
  await prisma.task.create({ data: { projectId: project.id, name: 'T2', ownerId: member.id, status: 'In progress' } });

  res = await fetch(base + '/api/users', authed(cookie));
  users = await res.json();
  m = users.find((u: any) => u.id === member.id);
  assert.equal(m.workload, 40);

  // Complete one task => drops to 20
  const t1 = await prisma.task.findFirst({ where: { name: 'T1' } });
  await prisma.task.update({ where: { id: t1!.id }, data: { status: 'Done' } });

  res = await fetch(base + '/api/users', authed(cookie));
  users = await res.json();
  m = users.find((u: any) => u.id === member.id);
  assert.equal(m.workload, 20);

  // Add 5 more active tasks (total 6 active) => capped at 100
  for (let i = 0; i < 5; i++) {
    await prisma.task.create({ data: { projectId: project.id, name: `More ${i}`, ownerId: member.id, status: 'To do' } });
  }

  res = await fetch(base + '/api/users', authed(cookie));
  users = await res.json();
  m = users.find((u: any) => u.id === member.id);
  assert.equal(m.workload, 100);

  await close();
});

