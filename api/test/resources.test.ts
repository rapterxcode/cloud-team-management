import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('resource CRUD with monthly cost validation', async () => {
  const { base, close } = await makeServer();
  await createUser('m@team.test', 'pw123456');
  const { cookie } = await login(base, 'm@team.test', 'pw123456');

  const created = await fetch(base + '/api/resources', authed(cookie, 'POST', { name: 'prod-api', provider: 'AWS', type: 'Compute', monthlyCost: 842 }));
  assert.equal(created.status, 201);
  const rsc = await created.json();
  assert.equal(rsc.status, 'Healthy');

  const bad = await fetch(base + '/api/resources', authed(cookie, 'POST', { name: 'x', provider: 'AWS', type: 'Compute', monthlyCost: -5 }));
  assert.equal(bad.status, 400);

  const patched = await fetch(base + `/api/resources/${rsc.id}`, authed(cookie, 'PATCH', { monthlyCost: 900, status: 'Review needed' }));
  assert.equal((await patched.json()).monthlyCost, 900);

  assert.equal((await fetch(base + `/api/resources/${rsc.id}`, authed(cookie, 'DELETE'))).status, 204);
  assert.equal(await prisma.cloudResource.count(), 0);
  await close();
});
