import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, login, prisma } from './helpers.js';
import { seed } from '../prisma/seed.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('seed creates deactivated demo users, demo data, and an env admin; runs twice safely', async () => {
  process.env.ADMIN_EMAIL = 'boss@team.test';
  process.env.ADMIN_PASSWORD = 'boss-secret-1';
  await seed(prisma);
  await seed(prisma); // idempotent

  const demo = await prisma.user.findMany({ where: { email: { endsWith: '@demo.local' } } });
  assert.equal(demo.length, 4);
  assert.ok(demo.every((u) => !u.isActive));
  assert.equal(await prisma.project.count(), 5);
  assert.equal(await prisma.task.count(), 4);
  assert.equal(await prisma.knowledgeArticle.count(), 4);
  assert.equal(await prisma.cloudResource.count(), 4);
  assert.equal(await prisma.user.count({ where: { role: 'admin', isActive: true } }), 1);

  const { base, close } = await makeServer();
  assert.equal((await login(base, 'boss@team.test', 'boss-secret-1')).status, 200);
  assert.equal((await login(base, 'alex.morgan@demo.local', 'anything')).status, 401);
  await close();
});
