import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { assertIn, badRequest, CATEGORIES } from '../validate.js';

export const ATTACHMENTS_DIR = () => process.env.ATTACHMENTS_DIR ?? './attachments-dev';

const INCLUDE = {
  author: { select: { id: true, name: true } },
  attachments: { select: { id: true, originalName: true, sizeBytes: true } },
  project: { select: { id: true, name: true } }
};

export function knowledgeRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (req, res) => {
    const { projectId } = req.query;
    res.json(await prisma.knowledgeArticle.findMany({ 
      where: projectId ? { projectId: String(projectId) } : undefined,
      include: INCLUDE, 
      orderBy: { createdAt: 'asc' } 
    }));
  });

  r.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const body = String(req.body?.body ?? '').trim();
      const projectId = req.body?.projectId;
      if (!name) throw badRequest('A name is required');
      if (!body) throw badRequest('Content is required');
      assertIn(req.body?.category, CATEGORIES, 'Category');
      const a = await prisma.knowledgeArticle.create({
        data: { name, body, category: req.body.category, authorId: req.session.userId!, ...(projectId ? { projectId: String(projectId) } : {}) },
        include: INCLUDE,
      });
      res.status(201).json(a);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.knowledgeArticle.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Article not found' });
      const { name, category, body, projectId } = req.body ?? {};
      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (body !== undefined && !String(body).trim()) throw badRequest('Content is required');
      if (category !== undefined) assertIn(category, CATEGORIES, 'Category');
      const a = await prisma.knowledgeArticle.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(body !== undefined ? { body: String(body).trim() } : {}),
          ...(projectId !== undefined ? { projectId: projectId ? String(projectId) : null } : {}),
        },
        include: INCLUDE,
      });
      res.json(a);
    } catch (e) { next(e); }
  });

  r.delete('/:id', async (req, res) => {
    const existing = await prisma.knowledgeArticle.findUnique({
      where: { id: req.params.id },
      include: { attachments: true },
    });
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    await prisma.knowledgeArticle.delete({ where: { id: req.params.id } }); // attachments cascade
    for (const att of existing.attachments) {
      await unlink(join(ATTACHMENTS_DIR(), att.storedName)).catch(() => {});
    }
    res.status(204).end();
  });

  return r;
}
