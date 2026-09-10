import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';
import type { AskLLM } from '../src/copilot/gemini.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('POST /api/copilot requires auth', async () => {
  const { base, close } = await makeServer({ askLLM: async () => 'x' });
  const res = await fetch(base + '/api/copilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'hi' }) });
  assert.equal(res.status, 401);
  await close();
});

test('POST /api/copilot passes snapshot + question to the LLM and returns the answer', async () => {
  let seenSystem = '';
  let seenUser = '';
  const fake: AskLLM = async (system, messages) => {
    seenSystem = system;
    seenUser = messages[messages.length - 1].content;
    return 'The Migration project is At risk.';
  };
  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('m@team.test', 'pw123456');
  await prisma.project.create({ data: { name: 'Migration', status: 'At risk' } });
  const { cookie } = await login(base, 'm@team.test', 'pw123456');
  const res = await fetch(base + '/api/copilot', authed(cookie, 'POST', { question: 'How is Migration doing?' }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).answer, 'The Migration project is At risk.');
  assert.match(seenSystem, /Migration/);
  assert.equal(seenUser, 'How is Migration doing?');
  await close();
});

test('empty or oversized question is rejected', async () => {
  const { base, close } = await makeServer({ askLLM: async () => 'x' });
  await createUser('m@team.test', 'pw123456');
  const { cookie } = await login(base, 'm@team.test', 'pw123456');
  assert.equal((await fetch(base + '/api/copilot', authed(cookie, 'POST', { question: '   ' }))).status, 400);
  assert.equal((await fetch(base + '/api/copilot', authed(cookie, 'POST', { question: 'x'.repeat(2001) }))).status, 400);
  await close();
});

test('provider failure maps to 502; not-configured maps to 503', async () => {
  const boom: AskLLM = async () => {
    throw new Error('network down');
  };
  const s1 = await makeServer({ askLLM: boom });
  await createUser('m@team.test', 'pw123456');
  const { cookie } = await login(s1.base, 'm@team.test', 'pw123456');
  assert.equal((await fetch(s1.base + '/api/copilot', authed(cookie, 'POST', { question: 'hi' }))).status, 502);
  await s1.close();

  const { CopilotNotConfiguredError } = await import('../src/copilot/gemini.js');
  const missing: AskLLM = async () => {
    throw new CopilotNotConfiguredError();
  };
  const s2 = await makeServer({ askLLM: missing });
  const { cookie: c2 } = await login(s2.base, 'm@team.test', 'pw123456');
  assert.equal((await fetch(s2.base + '/api/copilot', authed(c2, 'POST', { question: 'hi' }))).status, 503);
  await s2.close();
});

test('GET /api/copilot/status reflects env key', async () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const { base, close } = await makeServer();
  await createUser('m@team.test', 'pw123456');
  const { cookie } = await login(base, 'm@team.test', 'pw123456');
  const body = await (await fetch(base + '/api/copilot/status', authed(cookie))).json();
  assert.equal(body.enabled, false);
  await close();
  if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
});

test('POST /api/copilot returns draftTask with resolved project and owner IDs', async () => {
  const fake: AskLLM = async () => ({
    answer: 'I have drafted a task for Sam.',
    draftTask: {
      name: 'Upgrade Redis cluster',
      projectName: 'Platform Modern',
      ownerName: 'Sam Ops',
      priority: 'High',
      phase: 'Development',
      date: '2026-09-30',
      description: 'Run deployment checklist',
    },
  });
  const { base, close } = await makeServer({ askLLM: fake });
  const sam = await createUser('sam@team.test', 'pw123456', 'member', { name: 'Sam Ops' });
  const proj = await prisma.project.create({ data: { name: 'Platform Modernization' } });
  const { cookie } = await login(base, 'sam@team.test', 'pw123456');

  const res = await fetch(base + '/api/copilot', authed(cookie, 'POST', { question: 'Create a task for Sam to upgrade Redis' }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.answer, 'I have drafted a task for Sam.');
  assert.ok(data.draftTask);
  assert.equal(data.draftTask.name, 'Upgrade Redis cluster');
  assert.equal(data.draftTask.projectId, proj.id);
  assert.equal(data.draftTask.projectName, 'Platform Modernization');
  assert.equal(data.draftTask.ownerId, sam.id);
  assert.equal(data.draftTask.ownerName, 'Sam Ops');
  assert.equal(data.draftTask.priority, 'High');
  assert.equal(data.draftTask.phase, 'Development');
  assert.equal(data.draftTask.date, '2026-09-30');
  assert.equal(data.draftTask.description, 'Run deployment checklist');
  await close();
});
