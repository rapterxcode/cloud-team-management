import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PHASES, PRIORITIES, TASK_STATUSES, validateDates } from '../validate.js';

const OWNER = { owner: { select: { id: true, name: true } } };

export function tasksRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  async function assertActiveOwner(ownerId: unknown) {
    const owner = await prisma.user.findUnique({ where: { id: String(ownerId ?? '') } });
    if (!owner || !owner.isActive) throw badRequest('Owner must be an active team member');
  }

  r.get('/', async (_req, res) => {
    res.json(await prisma.task.findMany({ include: OWNER, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const { projectId, name, ownerId, phase = 'Planning', start = '', date = '' } = req.body ?? {};
      const trimmed = String(name ?? '').trim();
      if (!trimmed) throw badRequest('A name is required');
      if (!(await prisma.project.findUnique({ where: { id: String(projectId ?? '') } })))
        throw badRequest('Choose a project');
      await assertActiveOwner(ownerId);
      assertIn(phase, PHASES, 'Phase');
      validateDates(String(start), String(date));
      const t = await prisma.task.create({
        data: { projectId, name: trimmed, ownerId, phase, start: String(start), date: String(date) },
        include: OWNER,
      });
      res.status(201).json(t);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Task not found' });
      const { name, ownerId, phase, status, priority, start, date } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (ownerId !== undefined) await assertActiveOwner(ownerId);
      if (phase !== undefined) assertIn(phase, PHASES, 'Phase');
      if (status !== undefined) assertIn(status, TASK_STATUSES, 'Status');
      if (priority !== undefined) assertIn(priority, PRIORITIES, 'Priority');
      const nextStart = start !== undefined ? String(start) : existing.start;
      const nextDate = date !== undefined ? String(date) : existing.date;
      validateDates(nextStart, nextDate);
      const t = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(ownerId !== undefined ? { ownerId } : {}),
          ...(phase !== undefined ? { phase } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(start !== undefined ? { start: nextStart } : {}),
          ...(date !== undefined ? { date: nextDate } : {}),
        },
        include: OWNER,
      });
      res.json(t);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  return r;
}
