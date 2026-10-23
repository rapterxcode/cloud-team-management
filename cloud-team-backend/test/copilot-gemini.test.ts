import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConfigured, realAskLLM, CopilotNotConfiguredError } from '../src/copilot/gemini.js';

test('isConfigured reflects GEMINI_API_KEY', () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(isConfigured(), false);
  process.env.GEMINI_API_KEY = 'x';
  assert.equal(isConfigured(), true);
  if (prev === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = prev;
});

test('realAskLLM throws CopilotNotConfiguredError when no key', async () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => realAskLLM('sys', [{ role: 'user', content: 'hi' }]), CopilotNotConfiguredError);
  if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
});
