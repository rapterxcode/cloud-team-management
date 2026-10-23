import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('auditor guard: allows read-only access but blocks mutations', async () => {
  const { base, close } = await makeServer();
  await createUser('auditor@team.test', 'pw123456', 'auditor');
  const { cookie } = await login(base, 'auditor@team.test', 'pw123456');

  // Should allow GET requests
  const getProjects = await fetch(base + '/api/projects', authed(cookie));
  assert.equal(getProjects.status, 200);

  const getTasks = await fetch(base + '/api/tasks', authed(cookie));
  assert.equal(getTasks.status, 200);

  // Should block POST/PATCH/DELETE
  const createProject = await fetch(base + '/api/projects', authed(cookie, 'POST', { name: 'Hack' }));
  assert.equal(createProject.status, 403);
  assert.equal((await createProject.json()).error, 'Auditor role has read-only access');

  const patchProject = await fetch(base + '/api/projects/123', authed(cookie, 'PATCH', { name: 'Hack' }));
  assert.equal(patchProject.status, 403);

  const deleteProject = await fetch(base + '/api/projects/123', authed(cookie, 'DELETE'));
  assert.equal(deleteProject.status, 403);

  await close();
});
