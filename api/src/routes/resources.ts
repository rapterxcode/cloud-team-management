import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { badRequest } from '../validate.js';
import { recordAuditLog } from '../audit.js';

function costOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw badRequest('Monthly cost must be a whole number of dollars (0 or more)');
  return n;
}

export function resourcesRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    res.json(await prisma.cloudResource.findMany({ orderBy: { name: 'asc' } }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const { name, provider, type, status = 'Healthy', monthlyCost = 0 } = req.body ?? {};
      if (!String(name ?? '').trim() || !String(provider ?? '').trim() || !String(type ?? '').trim())
        throw badRequest('Name, provider and type are required');
      const rsc = await prisma.cloudResource.create({
        data: { name: String(name).trim(), provider: String(provider).trim(), type: String(type).trim(), status: String(status), monthlyCost: costOf(monthlyCost) },
      });

      const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
      if (actor) {
        await recordAuditLog(prisma, {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: 'CREATE',
          entityType: 'CloudResource',
          entityId: rsc.id,
          details: { name: rsc.name, provider: rsc.provider, type: rsc.type, status: rsc.status, monthlyCost: rsc.monthlyCost },
        });
      }

      res.status(201).json(rsc);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.cloudResource.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Resource not found' });
      const { name, provider, type, status, monthlyCost } = req.body ?? {};
      const rsc = await prisma.cloudResource.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(provider !== undefined ? { provider: String(provider).trim() } : {}),
          ...(type !== undefined ? { type: String(type).trim() } : {}),
          ...(status !== undefined ? { status: String(status) } : {}),
          ...(monthlyCost !== undefined ? { monthlyCost: costOf(monthlyCost) } : {}),
        },
      });

      const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
      if (actor) {
        await recordAuditLog(prisma, {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: 'UPDATE',
          entityType: 'CloudResource',
          entityId: rsc.id,
          details: {
            before: { name: existing.name, provider: existing.provider, status: existing.status, monthlyCost: existing.monthlyCost },
            after: { name: rsc.name, provider: rsc.provider, status: rsc.status, monthlyCost: rsc.monthlyCost },
          },
        });
      }

      res.json(rsc);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.cloudResource.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    await prisma.cloudResource.delete({ where: { id: req.params.id } });

    const actor = await prisma.user.findUnique({ where: { id: req.session.userId! } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: 'DELETE',
        entityType: 'CloudResource',
        entityId: existing.id,
        details: { name: existing.name, provider: existing.provider, monthlyCost: existing.monthlyCost },
      });
    }

    res.status(204).end();
  });

  return r;
}
