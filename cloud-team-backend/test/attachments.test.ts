import { test, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer, resetDb, createUser, login, prisma } from './helpers.js';

before(async () => {
  process.env.ATTACHMENTS_DIR = await mkdtemp(join(tmpdir(), 'ctm-att-'));
});
beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(base: string) {
  const u = await createUser('w@team.test', 'pw123456');
  const cookie = (await login(base, 'w@team.test', 'pw123456')).cookie;
  const article = await prisma.knowledgeArticle.create({
    data: { name: 'A', category: 'Guides', body: 'b', authorId: u.id },
  });
  return { cookie, article };
}

function filePost(cookie: string, name: string, content: string, type = 'text/plain') {
  const form = new FormData();
  form.append('file', new File([content], name, { type }));
  return { method: 'POST', headers: { cookie }, body: form } as RequestInit;
}

test('upload txt, download it back with attachment disposition, then delete', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);

  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'notes.txt', 'hello world'));
  assert.equal(up.status, 201);
  const att = await up.json();
  assert.equal(att.originalName, 'notes.txt');

  const down = await fetch(base + `/api/attachments/${att.id}/download`, { headers: { cookie } });
  assert.equal(down.status, 200);
  assert.match(down.headers.get('content-disposition') ?? '', /^attachment/);
  assert.equal(await down.text(), 'hello world');

  const anon = await fetch(base + `/api/attachments/${att.id}/download`);
  assert.equal(anon.status, 401);

  assert.equal((await fetch(base + `/api/attachments/${att.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);
  assert.equal(await prisma.knowledgeAttachment.count(), 0);
  await close();
});

test('disallowed extension rejected with 400', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);
  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'evil.sh', 'echo hi'));
  assert.equal(up.status, 400);
  await close();
});

test('oversize file rejected with 413', async () => {
  const { base, close } = await makeServer();
  const { cookie, article } = await setup(base);
  const big = 'x'.repeat(26 * 1024 * 1024);
  const up = await fetch(base + `/api/knowledge/${article.id}/attachments`, filePost(cookie, 'big.txt', big));
  assert.equal(up.status, 413);
  await close();
});
