import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('create/edit/list articles; author comes from session; category validated', async () => {
  const { base, close } = await makeServer();
  await createUser('writer@team.test', 'pw123456');
  const { cookie } = await login(base, 'writer@team.test', 'pw123456');

  const created = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'Guide', category: 'Guides', body: 'Steps' }));
  assert.equal(created.status, 201);
  const a = await created.json();
  assert.equal(a.author.name, 'writer');
  assert.deepEqual(a.attachments, []);

  const badCat = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'X', category: 'Random', body: 'b' }));
  assert.equal(badCat.status, 400);
  const emptyBody = await fetch(base + '/api/knowledge', authed(cookie, 'POST', { name: 'X', category: 'Guides', body: '  ' }));
  assert.equal(emptyBody.status, 400);

  const patched = await fetch(base + `/api/knowledge/${a.id}`, authed(cookie, 'PATCH', { body: 'New body' }));
  assert.equal((await patched.json()).body, 'New body');

  const del = await fetch(base + `/api/knowledge/${a.id}`, authed(cookie, 'DELETE'));
  assert.equal(del.status, 204);
  assert.equal(await prisma.knowledgeArticle.count(), 0);
  await close();
});
