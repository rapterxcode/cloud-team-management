import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProjectReadiness } from './compliance.mjs';

test('Project Readiness - 0% score when no docs exist', () => {
  const result = calculateProjectReadiness([], []);
  assert.equal(result.readinessScore, 0);
  assert.deepEqual(result.missingCheckpoints, ['CRA', 'Diagram', 'RBAC', 'CC']);
  assert.equal(result.hasCRA, false);
  assert.equal(result.hasDiagram, false);
  assert.equal(result.hasRBAC, false);
  assert.equal(result.hasCC, false);
});

test('Project Readiness - 100% score with no deployment tasks', () => {
  const docs = [
    { category: 'CRA' },
    { category: 'Diagram' },
    { category: 'RBAC' },
    { category: 'CC' },
  ];
  const result = calculateProjectReadiness(docs, []);
  assert.equal(result.readinessScore, 100);
  assert.deepEqual(result.missingCheckpoints, []);
  assert.equal(result.hasCRA, true);
  assert.equal(result.hasDiagram, true);
  assert.equal(result.hasRBAC, true);
  assert.equal(result.hasCC, true);
});

test('Project Readiness - 100% score with fully traceable deployment tasks', () => {
  const docs = [
    { category: 'CRA' },
    { category: 'Diagram' },
    { category: 'RBAC' },
    { category: 'CC' },
  ];
  const tasks = [
    { phase: 'Deployment', changeDocumentId: 'doc1' },
    { name: 'Deploy to prod', changeDocumentId: 'doc2' }
  ];
  const result = calculateProjectReadiness(docs, tasks);
  assert.equal(result.readinessScore, 100);
  assert.equal(result.deploymentTasksTotal, 2);
  assert.equal(result.deploymentTasksTraceable, 2);
});

test('Project Readiness - partial score with missing checkpoints', () => {
  const docs = [
    { category: 'CRA' },
    { category: 'Diagram' },
  ];
  const tasks = [
    { phase: 'Deployment', changeDocumentId: 'doc1' }, // traceable
    { name: 'deploy db' } // untraceable
  ];
  const result = calculateProjectReadiness(docs, tasks);
  // CRA(20) + Diagram(20) + RBAC(0) + CC(0) + Traceability(10) = 50
  assert.equal(result.readinessScore, 50);
  assert.deepEqual(result.missingCheckpoints, ['RBAC', 'CC']);
  assert.equal(result.deploymentTasksTotal, 2);
  assert.equal(result.deploymentTasksTraceable, 1);
});

test('Project Readiness - CC checkpoint matches either CC or CR category', () => {
  const docsCR = [{ category: 'CR' }];
  const resultCR = calculateProjectReadiness(docsCR, []);
  assert.equal(resultCR.hasCC, true);

  const docsCC = [{ category: 'CC' }];
  const resultCC = calculateProjectReadiness(docsCC, []);
  assert.equal(resultCC.hasCC, true);
});
