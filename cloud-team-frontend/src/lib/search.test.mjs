import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterArticles, highlightMatches, snippetWithMatch } from './search.mjs';

const SAMPLE_ARTICLES = [
  { id: '1', name: 'PostgreSQL Disaster Recovery', category: 'Runbooks', body: 'Step 1: Check backups in S3. Step 2: Restore cluster.' },
  { id: '2', name: 'Redis Cache Architecture', category: 'Guides', body: 'High availability Redis sentinel setup notes.' },
  { id: '3', name: 'New Engineer Onboarding', category: 'Onboarding', body: 'Welcome to the cloud team! Setup SSH keys and AWS SSO.' },
];

test('filterArticles filters by category', () => {
  const runbooks = filterArticles(SAMPLE_ARTICLES, '', 'Runbooks');
  assert.equal(runbooks.length, 1);
  assert.equal(runbooks[0].id, '1');

  const all = filterArticles(SAMPLE_ARTICLES, '', 'All');
  assert.equal(all.length, 3);
});

test('filterArticles matches single and multi-term queries case-insensitively', () => {
  const res1 = filterArticles(SAMPLE_ARTICLES, 'cluster', 'All');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].name, 'PostgreSQL Disaster Recovery');

  const res2 = filterArticles(SAMPLE_ARTICLES, 'REDIS setup', 'All');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].name, 'Redis Cache Architecture');

  const empty = filterArticles(SAMPLE_ARTICLES, 'nonexistentxyz', 'All');
  assert.equal(empty.length, 0);
});

test('highlightMatches breaks text into matched and non-matched segments', () => {
  const segments = highlightMatches('Deploy Redis on Kubernetes', 'redis');
  assert.deepEqual(segments, [
    { text: 'Deploy ', match: false },
    { text: 'Redis', match: true },
    { text: ' on Kubernetes', match: false },
  ]);

  const emptyQuery = highlightMatches('Hello world', '');
  assert.deepEqual(emptyQuery, [{ text: 'Hello world', match: false }]);

  // Regex special characters do not break
  const specialChars = highlightMatches('Cost: $100 [USD]', '$100 [');
  assert.equal(specialChars.some((s) => s.match && s.text === '$100'), true);
  assert.equal(specialChars.some((s) => s.match && s.text === '['), true);
});

test('snippetWithMatch centers context around query match', () => {
  const longBody = 'A'.repeat(300) + ' TARGET_PHRASE ' + 'B'.repeat(300);
  const snippet = snippetWithMatch(longBody, 'target_phrase', 100);
  assert.match(snippet, /TARGET_PHRASE/);
  assert.ok(snippet.length <= 120);

  const fallback = snippetWithMatch('Short text', '', 100);
  assert.equal(fallback, 'Short text');
});
