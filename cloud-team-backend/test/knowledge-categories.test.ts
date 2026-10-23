import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setupUsers(base: string) {
  const member = await createUser('dev@team.test', 'pw123456', 'member');
  const auditor = await createUser('auditor@team.test', 'pw123456', 'auditor');
  const memberCookie = (await login(base, 'dev@team.test', 'pw123456')).cookie;
  const auditorCookie = (await login(base, 'auditor@team.test', 'pw123456')).cookie;
  return { member, auditor, memberCookie, auditorCookie };
}

test('knowledge categories: list, create, update, delete, and auditor protection', async () => {
  const { base, close } = await makeServer();
  const { memberCookie, auditorCookie } = await setupUsers(base);

  // 1. Initial list has default categories or empty
  let res = await fetch(base + '/api/knowledge/categories', { headers: { cookie: memberCookie } });
  assert.equal(res.status, 200);
  const initial = await res.json();
  assert.ok(Array.isArray(initial));

  // 2. Member creates a new category
  res = await fetch(base + '/api/knowledge/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({ name: 'Architecture & RFCs', color: 'blue', icon: 'Cpu' }),
  });
  assert.equal(res.status, 201);
  const cat = await res.json();
  assert.equal(cat.name, 'Architecture & RFCs');
  assert.equal(cat.color, 'blue');

  // Duplicate name rejected
  res = await fetch(base + '/api/knowledge/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({ name: 'Architecture & RFCs' }),
  });
  assert.equal(res.status, 400);

  // Auditor cannot create category (403)
  res = await fetch(base + '/api/knowledge/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: auditorCookie },
    body: JSON.stringify({ name: 'Security SOPs' }),
  });
  assert.equal(res.status, 403);

  // 3. Member updates category
  res = await fetch(base + `/api/knowledge/categories/${cat.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({ name: 'Architecture & RFCs Updated', color: 'emerald' }),
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.name, 'Architecture & RFCs Updated');
  assert.equal(updated.color, 'emerald');

  // Auditor cannot update category (403)
  res = await fetch(base + `/api/knowledge/categories/${cat.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: auditorCookie },
    body: JSON.stringify({ name: 'Hacked' }),
  });
  assert.equal(res.status, 403);

  // 4. Create an article using this category
  res = await fetch(base + '/api/knowledge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({
      name: 'System Architecture Overview',
      category: 'Architecture & RFCs Updated',
      body: '# Architecture\nDetailed diagrams...',
      format: 'markdown',
    }),
  });
  assert.equal(res.status, 201);
  const article = await res.json();
  assert.equal(article.format, 'markdown');

  // Cannot delete category while in use by an article (400)
  res = await fetch(base + `/api/knowledge/categories/${cat.id}`, {
    method: 'DELETE',
    headers: { cookie: memberCookie },
  });
  assert.equal(res.status, 400);

  // Delete the article first
  res = await fetch(base + `/api/knowledge/${article.id}`, {
    method: 'DELETE',
    headers: { cookie: memberCookie },
  });
  assert.equal(res.status, 204);

  // Auditor cannot delete category (403)
  res = await fetch(base + `/api/knowledge/categories/${cat.id}`, {
    method: 'DELETE',
    headers: { cookie: auditorCookie },
  });
  assert.equal(res.status, 403);

  // Member can now delete the unused category (204)
  res = await fetch(base + `/api/knowledge/categories/${cat.id}`, {
    method: 'DELETE',
    headers: { cookie: memberCookie },
  });
  assert.equal(res.status, 204);

  await close();
});

test('knowledge article format support: markdown and interactive html', async () => {
  const { base, close } = await makeServer();
  const { memberCookie } = await setupUsers(base);

  // Create HTML article
  const htmlBody = '<!DOCTYPE html><html><head><style>body{color:red}</style></head><body><h1>Interactive Calculator</h1><button onclick="alert(1)">Click</button></body></html>';
  let res = await fetch(base + '/api/knowledge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({
      name: 'Subnet Calculator Widget',
      category: 'Guides',
      body: htmlBody,
      format: 'html',
    }),
  });
  assert.equal(res.status, 201);
  const article = await res.json();
  assert.equal(article.name, 'Subnet Calculator Widget');
  assert.equal(article.format, 'html');
  assert.equal(article.body, htmlBody);

  // Update format via PATCH
  res = await fetch(base + `/api/knowledge/${article.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({
      format: 'markdown',
      body: '# Markdown Version',
    }),
  });
  assert.equal(res.status, 200);
  const patched = await res.json();
  assert.equal(patched.format, 'markdown');
  assert.equal(patched.body, '# Markdown Version');

  // Invalid format rejected (400)
  res = await fetch(base + `/api/knowledge/${article.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: memberCookie },
    body: JSON.stringify({
      format: 'invalid_format',
    }),
  });
  assert.equal(res.status, 400);

  await close();
});
