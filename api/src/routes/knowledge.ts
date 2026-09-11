import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { badRequest } from '../validate.js';

export const ATTACHMENTS_DIR = () => process.env.ATTACHMENTS_DIR ?? './attachments-dev';

export const DEFAULT_CATEGORIES = [
  { name: 'Guides', color: 'purple', icon: 'BookOpen' },
  { name: 'Runbooks', color: 'blue', icon: 'Terminal' },
  { name: 'Onboarding', color: 'emerald', icon: 'Compass' },
  { name: 'Meeting notes', color: 'amber', icon: 'FileText' },
];

const INCLUDE = {
  author: { select: { id: true, name: true } },
  attachments: { select: { id: true, originalName: true, sizeBytes: true } },
  project: { select: { id: true, name: true } }
};

export function knowledgeRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  // Categories endpoints
  r.get('/categories', async (_req, res, next) => {
    try {
      let categories = await prisma.knowledgeCategory.findMany({ orderBy: { createdAt: 'asc' } });
      if (categories.length === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await prisma.knowledgeCategory.upsert({
            where: { name: cat.name },
            update: {},
            create: cat,
          });
        }
        categories = await prisma.knowledgeCategory.findMany({ orderBy: { createdAt: 'asc' } });
      }
      res.json(categories);
    } catch (e) { next(e); }
  });

  r.post('/categories', async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('Category name is required');
      const color = String(req.body?.color ?? 'purple').trim();
      const icon = String(req.body?.icon ?? 'BookOpen').trim();

      const existing = await prisma.knowledgeCategory.findUnique({ where: { name } });
      if (existing) throw badRequest('A category with this name already exists');

      const cat = await prisma.knowledgeCategory.create({
        data: { name, color, icon },
      });
      res.status(201).json(cat);
    } catch (e) { next(e); }
  });

  r.patch('/categories/:id', async (req, res, next) => {
    try {
      const existing = await prisma.knowledgeCategory.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Category not found' });

      const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
      const color = req.body?.color !== undefined ? String(req.body.color).trim() : undefined;
      const icon = req.body?.icon !== undefined ? String(req.body.icon).trim() : undefined;

      if (name !== undefined && !name) throw badRequest('Category name cannot be blank');

      if (name && name !== existing.name) {
        const dup = await prisma.knowledgeCategory.findUnique({ where: { name } });
        if (dup) throw badRequest('A category with this name already exists');
      }

      const updated = await prisma.knowledgeCategory.update({
        where: { id: req.params.id },
        data: {
          ...(name ? { name } : {}),
          ...(color ? { color } : {}),
          ...(icon ? { icon } : {}),
        },
      });

      if (name && name !== existing.name) {
        await prisma.knowledgeArticle.updateMany({
          where: { category: existing.name },
          data: { category: name },
        });
      }

      res.json(updated);
    } catch (e) { next(e); }
  });

  r.delete('/categories/:id', async (req, res, next) => {
    try {
      const existing = await prisma.knowledgeCategory.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Category not found' });

      const inUseCount = await prisma.knowledgeArticle.count({ where: { category: existing.name } });
      if (inUseCount > 0) {
        return res.status(400).json({ error: `Cannot delete category "${existing.name}" because it is currently used by ${inUseCount} article(s). Reassign them first.` });
      }

      await prisma.knowledgeCategory.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // Articles endpoints
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
      const category = String(req.body?.category ?? '').trim();
      const format = String(req.body?.format ?? 'markdown').toLowerCase().trim();
      const projectId = req.body?.projectId;

      if (!name) throw badRequest('A name is required');
      if (!body) throw badRequest('Content is required');
      if (!category) throw badRequest('A category is required');
      if (format !== 'markdown' && format !== 'html') {
        throw badRequest('Format must be either markdown or html');
      }

      const validCategory = await prisma.knowledgeCategory.findUnique({ where: { name: category } });
      if (!validCategory && !DEFAULT_CATEGORIES.some(c => c.name === category)) {
        throw badRequest(`Category "${category}" does not exist. Please create it first.`);
      }

      const chatHistory = req.body?.chatHistory;

      const a = await prisma.knowledgeArticle.create({
        data: {
          name,
          body,
          category,
          format,
          authorId: req.session.userId!,
          ...(projectId ? { projectId: String(projectId) } : {}),
          ...(chatHistory !== undefined ? { chatHistory } : {}),
        },
        include: INCLUDE,
      });
      res.status(201).json(a);
    } catch (e) { next(e); }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const existing = await prisma.knowledgeArticle.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Article not found' });
      const { name, category, body, projectId, format, chatHistory } = req.body ?? {};

      if (name !== undefined && !String(name).trim()) throw badRequest('A name is required');
      if (body !== undefined && !String(body).trim()) throw badRequest('Content is required');
      if (category !== undefined) {
        const cat = String(category).trim();
        if (!cat) throw badRequest('A category is required');
        const validCategory = await prisma.knowledgeCategory.findUnique({ where: { name: cat } });
        if (!validCategory && !DEFAULT_CATEGORIES.some(c => c.name === cat)) {
          throw badRequest(`Category "${cat}" does not exist. Please create it first.`);
        }
      }
      if (format !== undefined) {
        const f = String(format).toLowerCase().trim();
        if (f !== 'markdown' && f !== 'html') {
          throw badRequest('Format must be either markdown or html');
        }
      }

      const a = await prisma.knowledgeArticle.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(category !== undefined ? { category: String(category).trim() } : {}),
          ...(body !== undefined ? { body: String(body).trim() } : {}),
          ...(format !== undefined ? { format: String(format).toLowerCase().trim() } : {}),
          ...(projectId !== undefined ? { projectId: projectId ? String(projectId) : null } : {}),
          ...(chatHistory !== undefined ? { chatHistory } : {}),
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
