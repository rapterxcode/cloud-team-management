import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeServer, resetDb, createUser, login, authed, prisma } from './helpers.js';

beforeEach(resetDb);
after(() => prisma.$disconnect());

test('login with valid credentials sets a session cookie; /me returns the user', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  const { status, cookie } = await login(base, 'alex@team.test', 'secret123');
  assert.equal(status, 200);
  assert.ok(cookie.length > 0);
  const me = await fetch(base + '/api/auth/me', authed(cookie));
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.email, 'alex@team.test');
  assert.equal(body.passwordHash, undefined);
  await close();
});

test('wrong password and unknown email both return 401', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  assert.equal((await login(base, 'alex@team.test', 'wrong')).status, 401);
  assert.equal((await login(base, 'ghost@team.test', 'secret123')).status, 401);
  await close();
});

test('deactivated user cannot log in', async () => {
  const { base, close } = await makeServer();
  await createUser('gone@team.test', 'secret123', 'member', { isActive: false });
  assert.equal((await login(base, 'gone@team.test', 'secret123')).status, 401);
  await close();
});

test('logout destroys the session', async () => {
  const { base, close } = await makeServer();
  await createUser('alex@team.test', 'secret123');
  const { cookie } = await login(base, 'alex@team.test', 'secret123');
  await fetch(base + '/api/auth/logout', authed(cookie, 'POST'));
  assert.equal((await fetch(base + '/api/auth/me', authed(cookie))).status, 401);
  await close();
});

test('cross-origin mutation is blocked (CSRF origin check)', async () => {
  const { base, close } = await makeServer();
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
  });
  assert.equal(res.status, 403);
  await close();
});

test('login is rate limited after 10 attempts', async () => {
  const { base, close } = await makeServer();
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await login(base, 'brute@team.test', 'nope')).status;
  assert.equal(last, 429);
  await close();
});
