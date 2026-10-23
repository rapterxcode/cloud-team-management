import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';
import { config } from '../src/config/index.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('modular config exposes domain-scoped namespaces (app, db, auth, storage, ai)', () => {
  assert.equal(typeof config.app.port, 'number');
  assert.equal(typeof config.app.domain, 'string');
  assert.ok(config.db.url.startsWith('postgresql://'));
  assert.equal(typeof config.auth.loginRateLimitMax, 'number');
  assert.equal(typeof config.storage.maxAttachmentBytes, 'number');
  assert.equal(typeof config.ai.model, 'string');
  assert.equal(typeof config.ai.snapshotBudget, 'number');
});

test('GET /api/config requires auth and returns sanitized runtime config without secrets', async () => {
  const { base, close } = await makeServer();
  const anonRes = await fetch(base + '/api/config');
  assert.equal(anonRes.status, 401);

  await createUser('dev@team.test', 'pw12345678');
  const { cookie } = await login(base, 'dev@team.test', 'pw12345678');
  const res = await fetch(base + '/api/config', authed(cookie));
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(typeof body.app?.domain, 'string');
  assert.equal(typeof body.limits?.maxAttachmentBytes, 'number');
  assert.equal(typeof body.limits?.maxCopilotFileBytes, 'number');
  assert.equal(typeof body.ai?.enabled, 'boolean');
  assert.equal(typeof body.ai?.model, 'string');

  // Ensure secrets never leak in runtime config payload
  const rawJson = JSON.stringify(body);
  assert.equal(rawJson.includes('sessionSecret'), false);
  assert.equal(rawJson.includes('adminPassword'), false);
  assert.equal(rawJson.includes('apiKey'), false);
  assert.equal(rawJson.includes(config.auth.sessionSecret), false);

  await close();
});
