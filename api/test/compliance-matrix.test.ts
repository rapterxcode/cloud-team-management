import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, prisma, authed } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('GET /api/compliance/matrix returns calculated compliance checkpoints', async () => {
  const { base, close } = await makeServer();
  const admin = await createUser('admin@team.test', 'pw123456', 'admin');
  const { cookie } = await login(base, 'admin@team.test', 'pw123456');

  const p1 = await prisma.project.create({ data: { name: 'Compliant Project' } });
  const p2 = await prisma.project.create({ data: { name: 'Non-compliant Project' } });

  // P1: Fully compliant (CRA, Diagram, RBAC, CC, Traceable Deployment Task)
  await prisma.projectDocument.create({ data: { projectId: p1.id, storedName: '1', originalName: 'a.pdf', mimeType: 'pdf', sizeBytes: 10, category: 'CRA', uploadedById: admin.id } });
  await prisma.projectDocument.create({ data: { projectId: p1.id, storedName: '2', originalName: 'b.pdf', mimeType: 'pdf', sizeBytes: 10, category: 'Diagram', uploadedById: admin.id } });
  await prisma.projectDocument.create({ data: { projectId: p1.id, storedName: '3', originalName: 'c.pdf', mimeType: 'pdf', sizeBytes: 10, category: 'RBAC', uploadedById: admin.id } });
  const ccDoc = await prisma.projectDocument.create({ data: { projectId: p1.id, storedName: '4', originalName: 'd.pdf', mimeType: 'pdf', sizeBytes: 10, category: 'CC', uploadedById: admin.id } });
  await prisma.task.create({ data: { projectId: p1.id, name: 'Deploy to Prod', ownerId: admin.id, phase: 'Deployment', changeDocumentId: ccDoc.id } });

  // P2: Partially compliant (Only CRA, untraceable deployment task)
  await prisma.projectDocument.create({ data: { projectId: p2.id, storedName: '5', originalName: 'e.pdf', mimeType: 'pdf', sizeBytes: 10, category: 'CRA', uploadedById: admin.id } });
  await prisma.task.create({ data: { projectId: p2.id, name: 'Deploy to Staging', ownerId: admin.id, phase: 'Deployment' } });

  const res = await fetch(base + '/api/compliance/matrix', authed(cookie));
  assert.equal(res.status, 200);
  const data = await res.json();
  
  assert.equal(data.summary.totalProjects, 2);
  assert.equal(data.summary.readyProjects, 1);
  assert.equal(data.summary.pendingProjects, 1);
  assert.equal(data.summary.avgReadiness, 60); // (100 + 20) / 2 = 60

  const p1Res = data.projects.find((p: any) => p.id === p1.id);
  assert.equal(p1Res.readinessScore, 100);
  assert.equal(p1Res.missingCheckpoints.length, 0);

  const p2Res = data.projects.find((p: any) => p.id === p2.id);
  assert.equal(p2Res.readinessScore, 20); // only CRA (20) and no traceability
  assert.ok(p2Res.missingCheckpoints.includes('Diagram'));
  assert.ok(p2Res.missingCheckpoints.includes('RBAC'));
  assert.ok(p2Res.missingCheckpoints.includes('CC'));
  assert.ok(p2Res.missingCheckpoints.includes('Deployment Traceability'));

  await close();
});
