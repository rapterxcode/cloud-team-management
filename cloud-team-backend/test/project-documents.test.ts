import { test, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer, resetDb, createUser, login, prisma, authed } from './helpers.js';

before(async () => {
  process.env.ATTACHMENTS_DIR = await mkdtemp(join(tmpdir(), 'ctm-att-'));
});
beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(base: string) {
  const uploader = await createUser('uploader@team.test', 'pw123456');
  const otherMember = await createUser('other@team.test', 'pw123456');
  const admin = await createUser('admin@team.test', 'pw123456', 'admin');
  const auditor = await createUser('auditor@team.test', 'pw123456', 'auditor');

  const uploaderCookie = (await login(base, 'uploader@team.test', 'pw123456')).cookie;
  const otherCookie = (await login(base, 'other@team.test', 'pw123456')).cookie;
  const adminCookie = (await login(base, 'admin@team.test', 'pw123456')).cookie;
  const auditorCookie = (await login(base, 'auditor@team.test', 'pw123456')).cookie;

  const project = await prisma.project.create({
    data: { name: 'Proj1' },
  });
  return { uploaderCookie, otherCookie, adminCookie, auditorCookie, project };
}

function filePost(cookie: string, name: string, content: string, category: string, referenceNo?: string) {
  const form = new FormData();
  form.append('file', new File([content], name, { type: 'text/plain' }));
  form.append('category', category);
  if (referenceNo) form.append('referenceNo', referenceNo);
  return { method: 'POST', headers: { cookie }, body: form } as RequestInit;
}

test('project documents API: list, upload, download, preview, and deletion governance', async () => {
  const { base, close } = await makeServer();
  const { uploaderCookie, otherCookie, adminCookie, auditorCookie, project } = await setup(base);

  // 1. Upload
  const up = await fetch(base + `/api/projects/${project.id}/documents`, filePost(uploaderCookie, 'doc.txt', 'test content', 'CR', 'REF-1'));
  assert.equal(up.status, 201);
  const doc = await up.json();
  assert.equal(doc.originalName, 'doc.txt');
  assert.equal(doc.category, 'CR');
  assert.equal(doc.referenceNo, 'REF-1');

  // 2. List
  const list = await fetch(base + `/api/projects/${project.id}/documents`, authed(uploaderCookie));
  assert.equal(list.status, 200);
  const docs = await list.json();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, doc.id);
  assert.equal(docs[0].uploadedBy.name, 'uploader');

  // 3. Download
  const down = await fetch(base + `/api/project-documents/${doc.id}/download`, authed(uploaderCookie));
  assert.equal(down.status, 200);
  assert.match(down.headers.get('content-disposition') ?? '', /^attachment/);
  assert.equal(await down.text(), 'test content');

  // 4. Preview
  const prev = await fetch(base + `/api/project-documents/${doc.id}/preview`, authed(uploaderCookie));
  assert.equal(prev.status, 200);
  assert.match(prev.headers.get('content-disposition') ?? '', /^inline/);
  assert.equal(await prev.text(), 'test content');

  // 5. Deletion Permissions
  
  // Auditor should get 403 (due to global middleware)
  const delAuditor = await fetch(base + `/api/project-documents/${doc.id}`, authed(auditorCookie, 'DELETE'));
  assert.equal(delAuditor.status, 403);

  // Other member should get 403 (due to route governance)
  const delOther = await fetch(base + `/api/project-documents/${doc.id}`, authed(otherCookie, 'DELETE'));
  assert.equal(delOther.status, 403);

  // Uploader can delete (wait, I want to test admin can delete, so I will upload another)
  const up2 = await fetch(base + `/api/projects/${project.id}/documents`, filePost(uploaderCookie, 'doc2.txt', 'test content 2', 'General'));
  const doc2 = await up2.json();

  // Admin can delete
  const delAdmin = await fetch(base + `/api/project-documents/${doc2.id}`, authed(adminCookie, 'DELETE'));
  assert.equal(delAdmin.status, 204);

  // Uploader can delete
  const delUploader = await fetch(base + `/api/project-documents/${doc.id}`, authed(uploaderCookie, 'DELETE'));
  assert.equal(delUploader.status, 204);

  assert.equal(await prisma.projectDocument.count(), 0);

  await close();
});
