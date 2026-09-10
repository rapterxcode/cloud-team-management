import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PROJECT_STATUSES } from '../validate.js';

export function projectsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (req, res) => {
    const where: Record<string, unknown> = {};
    if (req.query.status && req.query.status !== 'All') {
      where.status = String(req.query.status);
    }
    if (req.query.year && req.query.year !== 'All') {
      const y = Number(req.query.year);
      if (Number.isInteger(y)) where.year = y;
    }
    res.json(await prisma.project.findMany({ where, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('A name is required');
      const year = req.body?.year !== undefined ? Number(req.body.year) : 2026;
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Year must be between 2000 and 2100');
      const status = req.body?.status !== undefined ? String(req.body.status) : undefined;
      if (status !== undefined) assertIn(status, PROJECT_STATUSES, 'Status');
      const p = await prisma.project.create({
        data: {
          name,
          description: String(req.body?.description ?? 'Ready to get started.'),
          year,
          ...(status !== undefined ? { status } : {}),
        },
      });
      res.status(201).json(p);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Project not found' });
      const { name, description, status, progress, department, due, year } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (status !== undefined) assertIn(status, PROJECT_STATUSES, 'Status');
      if (year !== undefined && (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100))
        throw badRequest('Year must be between 2000 and 2100');
      if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100))
        throw badRequest('Progress must be a whole number from 0 to 100');
      const p = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description: String(description) } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(year !== undefined ? { year: Number(year) } : {}),
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
