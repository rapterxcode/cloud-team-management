import { test, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer, resetDb, createUser, login, prisma } from './helpers.js';
import type { AskLLM, ChatMessage } from '../src/copilot/gemini.js';

before(async () => {
  process.env.ATTACHMENTS_DIR = await mkdtemp(join(tmpdir(), 'ctm-copilot-att-'));
});
beforeEach(resetDb);
after(() => prisma.$disconnect());

function filePost(cookie: string, name: string, content: string | Uint8Array, type = 'text/plain') {
  const form = new FormData();
  form.append('file', new File([content], name, { type }));
  return { method: 'POST', headers: { cookie }, body: form } as RequestInit;
}

test('POST /api/copilot/upload and GET /api/copilot/attachments/:storedName', async () => {
  const { base, close } = await makeServer();
  await createUser('engineer@team.test', 'pw123456');
  const { cookie } = await login(base, 'engineer@team.test', 'pw123456');

  // Anonymous upload rejected
  const anonUp = await fetch(base + '/api/copilot/upload', { method: 'POST', body: new FormData() });
  assert.equal(anonUp.status, 401);

  // Valid upload text
  const upRes = await fetch(base + '/api/copilot/upload', filePost(cookie, 'spec.txt', 'Architecture spec details'));
  assert.equal(upRes.status, 201);
  const upData = await upRes.json();
  assert.ok(upData.storedName);
  assert.equal(upData.originalName, 'spec.txt');

  // Download attachment
  const downRes = await fetch(base + `/api/copilot/attachments/${upData.storedName}`, { headers: { cookie } });
  assert.equal(downRes.status, 200);
  assert.equal(await downRes.text(), 'Architecture spec details');

  // Anonymous download rejected
  const anonDown = await fetch(base + `/api/copilot/attachments/${upData.storedName}`);
  assert.equal(anonDown.status, 401);

  // Disallowed extension rejected
  const disRes = await fetch(base + '/api/copilot/upload', filePost(cookie, 'bad.exe', 'binary'));
  assert.equal(disRes.status, 400);

  await close();
});

test('POST /api/copilot parses attachment and includes it in askLLM & conversation history', async () => {
  let seenMessage: ChatMessage | undefined;
  const fakeLLM: AskLLM = async (_system, messages) => {
    seenMessage = messages[messages.length - 1];
    return 'Analyzed document successfully.';
  };

  const { base, close } = await makeServer({ askLLM: fakeLLM });
  await createUser('lead@team.test', 'pw123456');
  const { cookie } = await login(base, 'lead@team.test', 'pw123456');

  // 1. Upload a file
  const up = await fetch(base + '/api/copilot/upload', filePost(cookie, 'server.log', 'Error 500 in auth handler'));
  assert.equal(up.status, 201);
  const att = await up.json();

  // 2. Ask Copilot with the attachment
  const chatRes = await fetch(base + '/api/copilot', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      question: 'Please analyze this log file',
      attachments: [att],
    }),
  });
  assert.equal(chatRes.status, 200);
  const chatData = await chatRes.json();
  assert.equal(chatData.answer, 'Analyzed document successfully.');
  assert.ok(chatData.conversationId);

  // 3. Verify seen message by LLM had parsed text
  assert.ok(seenMessage);
  assert.equal(seenMessage.role, 'user');
  assert.ok(seenMessage.attachments && seenMessage.attachments.length === 1);
  assert.equal(seenMessage.attachments[0].type, 'text');
  assert.match((seenMessage.attachments[0] as any).content, /Error 500 in auth handler/);

  // 4. Verify conversation history in DB preserves attachment metadata
  const convRes = await fetch(base + `/api/copilot/conversations/${chatData.conversationId}`, { headers: { cookie } });
  assert.equal(convRes.status, 200);
  const conv = await convRes.json();
  assert.equal(conv.messages.length, 2);
  assert.equal(conv.messages[0].role, 'user');
  assert.ok(Array.isArray(conv.messages[0].attachments));
  assert.equal(conv.messages[0].attachments[0].originalName, 'server.log');

  await close();
});
