import test from 'node:test';
import assert from 'node:assert/strict';
import { authed, createUser, login, makeServer, prisma, resetDb } from './helpers.js';

test('profile: update profile details and change password securely', async (t) => {
  await resetDb();
  const server = await makeServer();
  t.after(server.close);

  const user = await createUser('user@example.com', 'initialPass123', 'member', {
    name: 'Initial User',
    title: 'Junior DevOps',
  });

  const { cookie } = await login(server.base, user.email, 'initialPass123');

  // 1. Update profile name and title
  const updateProfileRes = await fetch(`${server.base}/api/auth/profile`, authed(cookie, 'PATCH', {
    name: 'Senior User',
    title: 'Lead SRE',
  }));
  assert.equal(updateProfileRes.status, 200);
  const updatedUser = await updateProfileRes.json();
  assert.equal(updatedUser.name, 'Senior User');
  assert.equal(updatedUser.title, 'Lead SRE');

  // 2. Reject password change with incorrect current password
  const badCurrentRes = await fetch(`${server.base}/api/auth/change-password`, authed(cookie, 'POST', {
    currentPassword: 'wrongPassword!',
    newPassword: 'BrandNewSecurePassword123!',
  }));
  assert.equal(badCurrentRes.status, 400);

  // 3. Reject password change with short new password
  const shortNewRes = await fetch(`${server.base}/api/auth/change-password`, authed(cookie, 'POST', {
    currentPassword: 'initialPass123',
    newPassword: 'short',
  }));
  assert.equal(shortNewRes.status, 400);

  // 4. Successful password change
  const successChangeRes = await fetch(`${server.base}/api/auth/change-password`, authed(cookie, 'POST', {
    currentPassword: 'initialPass123',
    newPassword: 'BrandNewSecurePassword123!',
  }));
  assert.equal(successChangeRes.status, 200);

  // 5. Old password fails
  const oldLogin = await login(server.base, user.email, 'initialPass123');
  assert.equal(oldLogin.status, 401);

  // 6. New password succeeds
  const newLogin = await login(server.base, user.email, 'BrandNewSecurePassword123!');
  assert.equal(newLogin.status, 200);
});
