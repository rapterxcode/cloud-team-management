import test from 'node:test';
import assert from 'node:assert/strict';
import { COPILOT_ARTICLE_PRESETS, buildArticleCopilotPrompt } from './copilot-article.mjs';

test('COPILOT_ARTICLE_PRESETS contains standard authoring and editing actions', () => {
  assert.ok(COPILOT_ARTICLE_PRESETS.length >= 5);
  const ids = COPILOT_ARTICLE_PRESETS.map((p) => p.id);
  assert.ok(ids.includes('draft'));
  assert.ok(ids.includes('checklist'));
  assert.ok(ids.includes('format-code'));
  assert.ok(ids.includes('convert-html'));
  assert.ok(ids.includes('executive-summary'));
});

test('buildArticleCopilotPrompt uses customPrompt if provided', () => {
  const result = buildArticleCopilotPrompt('draft', {
    name: 'GKE Ingress Guide',
    customPrompt: 'Focus specifically on external HTTP(S) load balancer with Cloud Armor',
  });
  assert.equal(result, 'Focus specifically on external HTTP(S) load balancer with Cloud Armor');
});

test('buildArticleCopilotPrompt drafts from title with category context', () => {
  const result = buildArticleCopilotPrompt('draft', {
    name: 'PostgreSQL Failover Runbook',
    category: 'Runbooks',
  });
  assert.match(result, /PostgreSQL Failover Runbook/);
  assert.match(result, /Runbooks/);
  assert.match(result, /step-by-step procedures/);
});

test('buildArticleCopilotPrompt handles checklist preset', () => {
  const result = buildArticleCopilotPrompt('checklist', {
    name: 'Deploy',
  });
  assert.match(result, /verification and rollback checklist/);
  assert.match(result, /- \[ \]/);
});

test('buildArticleCopilotPrompt handles convert-html preset', () => {
  const result = buildArticleCopilotPrompt('convert-html', {
    name: 'Arch Overview',
  });
  assert.match(result, /Tailwind CSS/);
  assert.match(result, /Set format to html/);
});

test('buildArticleCopilotPrompt falls back safely when unknown preset passed', () => {
  const result = buildArticleCopilotPrompt('unknown-action', {
    name: 'Security Benchmark',
  });
  assert.equal(result, 'Draft or improve the knowledge article "Security Benchmark"');
});
