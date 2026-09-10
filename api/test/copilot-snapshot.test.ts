import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, prisma } from './helpers.js';
import { buildSnapshot } from '../src/copilot/snapshot.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('empty workspace still produces a usable snapshot', async () => {
  const snap = await buildSnapshot(prisma);
  assert.match(snap, /PROJECTS/);
  assert.match(snap, /KNOWLEDGE/);
});

test('snapshot includes workspace facts and never leaks secrets', async () => {
  const u = await prisma.user.create({ data: { email: 'sec@team.test', name: 'Sam Ops', passwordHash: 'scrypt:dead:beef', title: 'SRE', workload: 40 } });
  const p = await prisma.project.create({ data: { name: 'Migration', department: 'Platform', status: 'At risk', progress: 30 } });
  await prisma.task.create({ data: { projectId: p.id, name: 'Cut over DB', ownerId: u.id, status: 'In progress', priority: 'High', date: '2026-09-20' } });
  await prisma.cloudResource.create({ data: { name: 'prod-api', provider: 'AWS', type: 'Compute', status: 'Healthy', monthlyCost: 842 } });
  await prisma.knowledgeArticle.create({ data: { name: 'Deploy checklist', category: 'Runbooks', authorId: u.id, body: 'X'.repeat(1000) } });

  const snap = await buildSnapshot(prisma);
  assert.match(snap, /Migration/);
  assert.match(snap, /Cut over DB/);
  assert.match(snap, /Sam Ops/);
  assert.match(snap, /prod-api/);
  assert.match(snap, /842/);
  assert.match(snap, /Deploy checklist/);
  assert.ok(!snap.includes('scrypt:dead:beef'), 'must not leak password hash');
  assert.ok(!snap.includes('sec@team.test'), 'must not leak email');
  assert.ok(!snap.includes('X'.repeat(500)), 'article body must be capped');
});

test('total snapshot size stays bounded', async () => {
  const u = await prisma.user.create({ data: { email: 'a@b.c', name: 'A', passwordHash: 'scrypt:x:y' } });
  for (let i = 0; i < 40; i++)
    await prisma.knowledgeArticle.create({ data: { name: `Article ${i}`, category: 'Guides', authorId: u.id, body: 'Y'.repeat(400) } });
  const snap = await buildSnapshot(prisma);
  assert.ok(snap.length <= 13000, `snapshot too large: ${snap.length}`);
  assert.match(snap, /truncated/);
});
