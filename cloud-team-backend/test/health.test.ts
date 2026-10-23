import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, prisma } from './helpers.js';

after(() => prisma.$disconnect());

test('GET /api/health returns ok without auth', async () => {
  const { base, close } = await makeServer();
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  await close();
});
