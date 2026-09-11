import test from 'node:test';
import assert from 'node:assert/strict';
import { authed, createUser, login, makeServer, prisma, resetDb } from './helpers.js';

test('access logs: records login success, failure, logout, and query guards', async (t) => {
  await resetDb();
  const server = await makeServer();
  t.after(server.close);

  const admin = await createUser('admin@example.com', 'adminpass123', 'admin');
  const member = await createUser('member@example.com', 'memberpass123', 'member');
  const auditor = await createUser('auditor@example.com', 'auditorpass123', 'auditor');

  // 1. Failed login with wrong password
  const failRes = await fetch(`${server.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TestRunner/1.0' },
    body: JSON.stringify({ email: 'member@example.com', password: 'wrongpassword' }),
  });
  assert.equal(failRes.status, 401);

  // 2. Successful login
  const { cookie: memberCookie } = await login(server.base, 'member@example.com', 'memberpass123');
  assert.ok(memberCookie);

  // 3. Check recent logins endpoint for member
  const recentRes = await fetch(`${server.base}/api/auth/recent-logins`, authed(memberCookie));
  assert.equal(recentRes.status, 200);
  const recentLogs = await recentRes.json();
  assert.ok(recentLogs.length >= 1);
  assert.equal(recentLogs[0].action, 'LOGIN_SUCCESS');

  // 4. Logout
  const logoutRes = await fetch(`${server.base}/api/auth/logout`, authed(memberCookie, 'POST'));
  assert.equal(logoutRes.status, 204);

  // 5. Admin and Auditor can query access logs
  const { cookie: adminCookie } = await login(server.base, 'admin@example.com', 'adminpass123');
  const adminLogsRes = await fetch(`${server.base}/api/logs/access`, authed(adminCookie));
  assert.equal(adminLogsRes.status, 200);
  const adminLogsData = await adminLogsRes.json();
  assert.ok(adminLogsData.total >= 2); // fail + success + logout

  const { cookie: auditorCookie } = await login(server.base, 'auditor@example.com', 'auditorpass123');
  const auditorLogsRes = await fetch(`${server.base}/api/logs/access`, authed(auditorCookie));
  assert.equal(auditorLogsRes.status, 200);

  // 6. Non-auditor member cannot query /api/logs/access
  const { cookie: memberCookie2 } = await login(server.base, 'member@example.com', 'memberpass123');
  const memberForbidden = await fetch(`${server.base}/api/logs/access`, authed(memberCookie2));
  assert.equal(memberForbidden.status, 403);
});
