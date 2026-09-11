import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';
import type { AskLLM } from '../src/copilot/gemini.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('POST /api/copilot/article requires auth', async () => {
  const { base, close } = await makeServer({ askLLM: async () => 'x' });
  const res = await fetch(base + '/api/copilot/article', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Draft article' }),
  });
  assert.equal(res.status, 401);
  await close();
});

test('POST /api/copilot/article blocks auditor role with 403 Forbidden', async () => {
  const { base, close } = await makeServer({ askLLM: async () => 'x' });
  await createUser('auditor@team.test', 'pw123456', 'auditor');
  const { cookie } = await login(base, 'auditor@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', { prompt: 'Write an audit guide' }),
  );
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Auditor role/i);
  await close();
});

test('empty or oversized prompt is rejected with 400', async () => {
  const { base, close } = await makeServer({ askLLM: async () => 'x' });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const resEmpty = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', { prompt: '   ' }),
  );
  assert.equal(resEmpty.status, 400);
  assert.equal((await resEmpty.json()).error, 'Prompt is required');

  const resOversized = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', { prompt: 'a'.repeat(2001) }),
  );
  assert.equal(resOversized.status, 400);
  assert.match((await resOversized.json()).error, /too long/i);

  await close();
});

test('generates new draft when currentBody is empty', async () => {
  let capturedSystem = '';
  let capturedUser = '';
  const fake: AskLLM = async (system, messages) => {
    capturedSystem = system;
    capturedUser = messages[messages.length - 1].content;
    return {
      answer: 'Drafted article for Kubernetes Deployment Guide',
      draftArticle: {
        name: 'Kubernetes Deployment Guide',
        body: '# Kubernetes Deployment Guide\n\nStep 1: Apply deployment manifests.\nStep 2: Check rollout status.',
        format: 'markdown',
        summary: 'Created initial deployment runbook with prerequisites and steps.',
      },
    };
  };

  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('eng@team.test', 'pw123456');
  await prisma.project.create({ data: { name: 'Cloud Migration' } });
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', {
      prompt: 'Draft a deployment runbook',
      name: 'Kubernetes Deployment Guide',
      category: 'Runbooks',
      format: 'markdown',
    }),
  );

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.draftArticle);
  assert.equal(data.draftArticle.name, 'Kubernetes Deployment Guide');
  assert.equal(data.draftArticle.format, 'markdown');
  assert.match(data.draftArticle.body, /# Kubernetes Deployment Guide/);
  assert.equal(data.draftArticle.summary, 'Created initial deployment runbook with prerequisites and steps.');

  assert.match(capturedSystem, /Cloud Migration/);
  assert.match(capturedUser, /Requested Action \/ Instruction: Draft a deployment runbook/);
  assert.match(capturedUser, /Article Title: Kubernetes Deployment Guide/);
  assert.match(capturedUser, /Category: Runbooks/);

  await close();
});

test('modifies existing content when currentBody is provided', async () => {
  let capturedUser = '';
  const fake: AskLLM = async (_system, messages) => {
    capturedUser = messages[messages.length - 1].content;
    return {
      answer: 'Added rollback checklist to the runbook.',
      draftArticle: {
        name: 'Production Deploy Runbook',
        body: '# Production Deploy Runbook\n\n## Steps\n1. Deploy image\n\n## Rollback Checklist\n- [ ] Notify incident lead\n- [ ] Revert git SHA',
        format: 'markdown',
        summary: 'Appended rollback checklist section.',
      },
    };
  };

  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', {
      prompt: 'Add a rollback checklist section to this runbook',
      name: 'Production Deploy Runbook',
      category: 'Runbooks',
      format: 'markdown',
      currentBody: '# Production Deploy Runbook\n\n## Steps\n1. Deploy image',
    }),
  );

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.draftArticle.name, 'Production Deploy Runbook');
  assert.match(data.draftArticle.body, /## Rollback Checklist/);
  assert.equal(data.draftArticle.summary, 'Appended rollback checklist section.');

  assert.match(capturedUser, /Current Article Content:/);
  assert.match(capturedUser, /1\. Deploy image/);

  await close();
});

test('converts markdown to interactive HTML with Tailwind', async () => {
  const fake: AskLLM = async () => ({
    answer: 'Converted to HTML styled with Tailwind CSS',
    draftArticle: {
      name: 'Incident Escalation Flow',
      body: '<div class="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700"><h2 class="text-xl font-bold text-amber-400">Incident Flow</h2><p class="mt-2 text-slate-300">Follow on-call protocol.</p></div>',
      format: 'html',
      summary: 'Converted document into modern styled HTML card with Tailwind classes.',
    },
  });

  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', {
      prompt: 'Convert this markdown into styled HTML with Tailwind CSS',
      name: 'Incident Escalation Flow',
      format: 'html',
      currentBody: '## Incident Flow\nFollow on-call protocol.',
    }),
  );

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.draftArticle.format, 'html');
  assert.match(data.draftArticle.body, /<div class="p-6 bg-slate-900/);
  assert.equal(data.draftArticle.summary, 'Converted document into modern styled HTML card with Tailwind classes.');

  await close();
});

test('handles fallback when LLM returns plain string response without tool call', async () => {
  const fake: AskLLM = async () => 'Here is a suggested troubleshooting guide for Cloud SQL.';

  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', {
      prompt: 'Draft troubleshooting guide',
      name: 'Cloud SQL Troubleshooting',
    }),
  );

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.draftArticle.name, 'Cloud SQL Troubleshooting');
  assert.equal(data.draftArticle.body, 'Here is a suggested troubleshooting guide for Cloud SQL.');
  assert.equal(data.draftArticle.format, 'markdown');

  await close();
});

test('provider failure maps to 502; not-configured maps to 503', async () => {
  const boom: AskLLM = async () => {
    throw new Error('network down');
  };
  const s1 = await makeServer({ askLLM: boom });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(s1.base, 'eng@team.test', 'pw123456');

  const res502 = await fetch(
    s1.base + '/api/copilot/article',
    authed(cookie, 'POST', { prompt: 'draft guide' }),
  );
  assert.equal(res502.status, 502);
  await s1.close();

  const { CopilotNotConfiguredError } = await import('../src/copilot/gemini.js');
  const missing: AskLLM = async () => {
    throw new CopilotNotConfiguredError();
  };
  const s2 = await makeServer({ askLLM: missing });
  const { cookie: c2 } = await login(s2.base, 'eng@team.test', 'pw123456');

  const res503 = await fetch(
    s2.base + '/api/copilot/article',
    authed(c2, 'POST', { prompt: 'draft guide' }),
  );
  assert.equal(res503.status, 503);
  await s2.close();
});

test('POST /api/copilot/article passes conversation history to LLM', async () => {
  let capturedMessages: { role: string; content: string }[] = [];
  const fake: AskLLM = async (_system, messages) => {
    capturedMessages = messages;
    return {
      answer: 'Refined draft based on history',
      draftArticle: {
        name: 'GKE Hardening Guide',
        body: '# GKE Hardening Guide\n\n- Enable Workload Identity\n- Disable basic auth',
        format: 'markdown',
        summary: 'Added security checklist based on previous discussion.',
      },
    };
  };

  const { base, close } = await makeServer({ askLLM: fake });
  await createUser('eng@team.test', 'pw123456');
  const { cookie } = await login(base, 'eng@team.test', 'pw123456');

  const res = await fetch(
    base + '/api/copilot/article',
    authed(cookie, 'POST', {
      prompt: 'Now add security recommendations',
      name: 'GKE Hardening Guide',
      history: [
        { role: 'user', content: 'Draft initial GKE guide' },
        { role: 'assistant', content: 'Here is the initial draft.' },
      ],
    }),
  );

  assert.equal(res.status, 200);
  assert.equal(capturedMessages.length, 3);
  assert.equal(capturedMessages[0].role, 'user');
  assert.equal(capturedMessages[0].content, 'Draft initial GKE guide');
  assert.equal(capturedMessages[1].role, 'assistant');
  assert.equal(capturedMessages[1].content, 'Here is the initial draft.');
  assert.equal(capturedMessages[2].role, 'user');
  assert.match(capturedMessages[2].content, /Requested Action \/ Instruction: Now add security recommendations/);

  await close();
});

