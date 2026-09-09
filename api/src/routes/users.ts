import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAdmin, requireAuth } from '../middleware.js';
import { hashPassword } from '../passwords.js';

const PUBLIC_FIELDS = { id: true, name: true, title: true, role: true, isActive: true, workload: true };

export function usersRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', requireAdmin(prisma), async (req, res) => {
    const { email, name, password, title = '', role = 'member', workload = 0 } = req.body ?? {};
    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name and password are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
    if (await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } }))
      return res.status(400).json({ error: 'A user with this email already exists' });
    const u = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        name: String(name).trim(),
        title: String(title),
        role,
        workload: Number(workload) || 0,
        passwordHash: await hashPassword(String(password)),
      },
      select: PUBLIC_FIELDS,
    });
    res.status(201).json(u);
  });

  r.patch('/:id', requireAdmin(prisma), async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const { name, title, role, isActive, workload, password } = req.body ?? {};
    if (role !== undefined && !['admin', 'member'].includes(role))
      return res.status(400).json({ error: 'Role must be admin or member' });
    if (password !== undefined && String(password).length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    // Last-admin guard: never let the final active admin be deactivated or demoted.
    const demoting = (role !== undefined && role !== 'admin') || isActive === false;
    if (existing.role === 'admin' && existing.isActive && demoting) {
      const otherAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true, id: { not: existing.id } } });
      if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot deactivate or demote the last active admin' });
    }
    const u = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(workload !== undefined ? { workload: Number(workload) || 0 } : {}),
        ...(password !== undefined ? { passwordHash: await hashPassword(String(password)) } : {}),
      },
      select: PUBLIC_FIELDS,
    });
    res.json(u);
  });

  return r;
}
