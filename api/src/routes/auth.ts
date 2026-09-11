import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { verifyPassword, hashPassword } from '../passwords.js';
import { loginLimiter, requireAuth } from '../middleware.js';
import { extractClientInfo, recordAccessLog, recordAuditLog } from '../audit.js';

export function authRoutes(prisma: PrismaClient) {
  const r = Router();

  r.post('/login', loginLimiter, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const clientInfo = extractClientInfo(req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      const failureReason = !user
        ? 'USER_NOT_FOUND'
        : !user.isActive
        ? 'USER_DEACTIVATED'
        : 'INVALID_PASSWORD';

      await recordAccessLog(prisma, {
        userId: user?.id ?? null,
        email,
        action: 'LOGIN_FAILURE',
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        failureReason,
      });

      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    await recordAccessLog(prisma, {
      userId: user.id,
      email: user.email,
      action: 'LOGIN_SUCCESS',
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    req.session.userId = user.id;
    req.session.role = user.role;
    // Persist the session before responding so an immediately-following request
    // (e.g. logout) reliably sees it — otherwise the store write can land after
    // the next request has already read an empty session.
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Could not start session' });
      res.json({ id: user.id, name: user.name, role: user.role });
    });
  });

  r.post('/logout', async (req, res) => {
    const userId = req.session?.userId;
    if (userId) {
      const clientInfo = extractClientInfo(req);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await recordAccessLog(prisma, {
          userId: user.id,
          email: user.email,
          action: 'LOGOUT',
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        });
      }
    }
    req.session.destroy(() => res.status(204).end());
  });

  r.get('/me', requireAuth, async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });
    if (!u || !u.isActive) return res.status(401).json({ error: 'Sign in required' });
    const count = await prisma.task.count({ where: { ownerId: u.id, status: { not: 'Done' } } });
    
    const workspaces = u.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      type: m.workspace.type,
      description: m.workspace.description,
      color: m.workspace.color,
      icon: m.workspace.icon,
      role: m.role,
    }));

    res.json({
      id: u.id,
      email: u.email,
      name: u.name,
      title: u.title,
      role: u.role,
      workload: Math.min(100, count * 20),
      workspaces,
    });
  });

  r.patch('/profile', requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'Name cannot be blank' });
    }

    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current || !current.isActive) return res.status(401).json({ error: 'Sign in required' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(title !== undefined ? { title } : {}),
      },
    });

    await recordAuditLog(prisma, {
      actor: { id: updated.id, name: updated.name, role: updated.role },
      action: 'UPDATE',
      entityType: 'User',
      entityId: updated.id,
      details: {
        before: { name: current.name, title: current.title },
        after: { name: updated.name, title: updated.title },
      },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      title: updated.title,
      role: updated.role,
    });
  });

  r.post('/change-password', requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    const clientInfo = extractClientInfo(req);

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Sign in required' });

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      await recordAccessLog(prisma, {
        userId: user.id,
        email: user.email,
        action: 'PASSWORD_CHANGE',
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        failureReason: 'CURRENT_PASSWORD_INCORRECT',
      });
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await recordAccessLog(prisma, {
      userId: user.id,
      email: user.email,
      action: 'PASSWORD_CHANGE',
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    await recordAuditLog(prisma, {
      actor: { id: user.id, name: user.name, role: user.role },
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      details: { note: 'Password changed by user' },
    });

    res.json({ ok: true, message: 'Password changed successfully' });
  });

  r.get('/recent-logins', requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const logs = await prisma.accessLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        failureReason: true,
        createdAt: true,
      },
    });
    res.json(logs);
  });

  return r;
}
