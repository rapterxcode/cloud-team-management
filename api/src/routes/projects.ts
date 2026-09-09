import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PROJECT_STATUSES } from '../validate.js';

export function projectsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.project.findMany({ orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('A name is required');
      const p = await prisma.project.create({
        data: { name, description: String(req.body?.description ?? 'Ready to get started.') },
      });
      res.status(201).json(p);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Project not found' });
      const { name, description, status, progress, department, due } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (status !== undefined) assertIn(status, PROJECT_STATUSES, 'Status');
      if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100))
        throw badRequest('Progress must be a whole number from 0 to 100');
      const p = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description: String(description) } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(progress !== undefined ? { progress } : {}),
          ...(department !== undefined ? { department: String(department) } : {}),
          ...(due !== undefined ? { due: String(due) } : {}),
        },
      });
      res.json(p);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  return r;
}
