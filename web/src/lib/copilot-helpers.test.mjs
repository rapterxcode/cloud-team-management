import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COPILOT_QUICK_ACTIONS,
  normalizeBatchDraftTasks,
  extractReportTitle,
  isSubstantiveReport,
} from './copilot-helpers.mjs';

test('COPILOT_QUICK_ACTIONS contains required actions', () => {
  assert.ok(Array.isArray(COPILOT_QUICK_ACTIONS));
  assert.equal(COPILOT_QUICK_ACTIONS.length, 4);
  const ids = COPILOT_QUICK_ACTIONS.map(a => a.id);
  assert.ok(ids.includes('exec-report'));
  assert.ok(ids.includes('risk-analysis'));
  assert.ok(ids.includes('workload-balance'));
  assert.ok(ids.includes('extract-tasks'));
});

test('normalizeBatchDraftTasks normalizes array of tasks', () => {
  const tasks = [
    { name: 'Task 1', projectName: 'Proj A', priority: 'High' },
    { name: '  Task 2  ', ownerName: 'Alice', phase: 'Development' },
    { name: '' }, // invalid, should be filtered
  ];
  const normalized = normalizeBatchDraftTasks(tasks, null);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].name, 'Task 1');
  assert.equal(normalized[0].phase, 'Planning');
  assert.equal(normalized[0].priority, 'High');
  assert.equal(normalized[1].name, 'Task 2');
  assert.equal(normalized[1].phase, 'Development');
  assert.equal(normalized[1].priority, 'Medium');
});

test('normalizeBatchDraftTasks falls back to single draftTask', () => {
  const single = { name: 'Single Task', priority: 'Low' };
  const normalized = normalizeBatchDraftTasks([], single);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, 'Single Task');
  assert.equal(normalized[0].priority, 'Low');
});

test('normalizeBatchDraftTasks handles empty/null gracefully', () => {
  assert.deepEqual(normalizeBatchDraftTasks(null, null), []);
  assert.deepEqual(normalizeBatchDraftTasks([], undefined), []);
});

test('extractReportTitle extracts markdown headings or first line', () => {
  const md = '# Weekly Executive Summary\n\nAll systems operational.';
  assert.equal(extractReportTitle(md), 'Weekly Executive Summary');

  const plain = 'Platform Modernization Milestone Report\n\nDetailed breakdown...';
  assert.equal(extractReportTitle(plain), 'Platform Modernization Milestone Report');

  assert.equal(extractReportTitle(''), 'Executive Workspace Report');
  assert.equal(extractReportTitle(null), 'Executive Workspace Report');
});

test('isSubstantiveReport identifies reports with structure', () => {
  const report = `# Executive Summary\n- Projects on track: 3\n- Projects at risk: 1\n\n| Project | Status |\n|---|---|\n| Alpha | On track |\n\nPlease review immediate actions.`;
  assert.equal(isSubstantiveReport(report), true);

  const shortChat = 'Sure, there are 4 projects currently in your workspace.';
  assert.equal(isSubstantiveReport(shortChat), false);
});

test('groupConversationsByDate groups conversations into today, yesterday, earlier', () => {
  const now = new Date();
  const todayItem = { id: '1', title: 'Chat today', updatedAt: now.toISOString() };
  const yesterdayDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const yesterdayItem = { id: '2', title: 'Chat yesterday', updatedAt: yesterdayDate.toISOString() };
  const earlierDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const earlierItem = { id: '3', title: 'Chat earlier', updatedAt: earlierDate.toISOString() };

  const groups = import('./copilot-helpers.mjs').then(m => {
    const res = m.groupConversationsByDate([todayItem, yesterdayItem, earlierItem]);
    assert.equal(res.today.length, 1);
    assert.equal(res.today[0].id, '1');
    assert.equal(res.earlier.length, 1);
    assert.equal(res.earlier[0].id, '3');
  });
});

