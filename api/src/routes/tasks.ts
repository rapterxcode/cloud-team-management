import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, PHASES, PRIORITIES, TASK_STATUSES, validateDates } from '../validate.js';
import { recordAuditLog } from '../audit.js';

const TASK_INCLUDE = {
  owner: { select: { id: true, name: true } },
  changeDocument: { select: { id: true, originalName: true, category: true, referenceNo: true } },
  sopArticle: { select: { id: true, name: true, category: true } }
};

export function tasksRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  async function assertActiveOwner(ownerId: unknown) {
    const owner = await prisma.user.findUnique({ where: { id: String(ownerId ?? '') } });
    if (!owner || !owner.isActive) throw badRequest('Owner must be an active team member');
  }

  r.get('/', async (req, res) => {
    const where: Record<string, unknown> = {};
    if (req.query.workspaceId) {
      where.project = { workspaceId: String(req.query.workspaceId) };
    }
    if (req.query.projectId) {
      where.projectId = String(req.query.projectId);
    }
    res.json(await prisma.task.findMany({ where, include: TASK_INCLUDE, orderBy: { createdAt: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const { projectId, name, ownerId, phase = 'Planning', priority = 'Medium', start = '', date = '', description = '', sopArticleId, changeDocumentId } = req.body ?? {};
      const trimmed = String(name ?? '').trim();
      if (!trimmed) throw badRequest('A name is required');
      if (description !== undefined && String(description).length > 10000)
        throw badRequest('Description cannot exceed 10000 characters');
      const project = await prisma.project.findUnique({ where: { id: String(projectId ?? '') } });
      if (!project) throw badRequest('Choose a project');
      await assertActiveOwner(ownerId);
      const phaseStr = String(phase ?? 'Planning').trim();
      if (!phaseStr) throw badRequest('Phase is required');
      if (phaseStr.length > 50) throw badRequest('Phase must be 50 characters or less');
      assertIn(priority, PRIORITIES, 'Priority');
      validateDates(String(start), String(date));
      const t = await prisma.task.create({
        data: { projectId, name: trimmed, ownerId, phase: phaseStr, priority, start: String(start), date: String(date), description: String(description), ...(sopArticleId ? { sopArticleId: String(sopArticleId) } : {}), ...(changeDocumentId ? { changeDocumentId: String(changeDocumentId) } : {}) },
        include: TASK_INCLUDE,
      });

      const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
      if (actor) {
        await recordAuditLog(prisma, {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          workspaceId: project.workspaceId,
          action: 'CREATE',
          entityType: 'Task',
          entityId: t.id,
          details: { name: t.name, projectId: t.projectId, priority: t.priority, status: t.status },
        });
      }

      res.status(201).json(t);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.task.findUnique({ where: { id: req.params.id }, include: { project: true } });
      if (!existing) return res.status(404).json({ error: 'Task not found' });
      const { name, ownerId, phase, status, priority, start, date, description, sopArticleId, changeDocumentId } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (description !== undefined && String(description).length > 10000)
        throw badRequest('Description cannot exceed 10000 characters');
      if (ownerId !== undefined) await assertActiveOwner(ownerId);
      if (phase !== undefined) {
        const p = String(phase).trim();
        if (!p) throw badRequest('Phase cannot be empty');
        if (p.length > 50) throw badRequest('Phase must be 50 characters or less');
      }
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
          ...(phase !== undefined ? { phase: String(phase).trim() } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(start !== undefined ? { start: nextStart } : {}),
          ...(date !== undefined ? { date: nextDate } : {}),
          ...(description !== undefined ? { description: String(description) } : {}),
          ...(sopArticleId !== undefined ? { sopArticleId: sopArticleId ? String(sopArticleId) : null } : {}),
          ...(changeDocumentId !== undefined ? { changeDocumentId: changeDocumentId ? String(changeDocumentId) : null } : {}),
        },
        include: TASK_INCLUDE,
      });

      const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
      if (actor) {
        await recordAuditLog(prisma, {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          workspaceId: existing.project?.workspaceId,
          action: 'UPDATE',
          entityType: 'Task',
          entityId: t.id,
          details: {
            before: { name: existing.name, status: existing.status, priority: existing.priority },
            after: { name: t.name, status: t.status, priority: t.priority },
          },
        });
      }

      res.json(t);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    await prisma.task.delete({ where: { id: req.params.id } });

    const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        workspaceId: existing.project?.workspaceId,
        action: 'DELETE',
        entityType: 'Task',
        entityId: existing.id,
        details: { name: existing.name },
      });
    }

    res.status(204).end();
  });

  return r;
}
