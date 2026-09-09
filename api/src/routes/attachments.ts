import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { ATTACHMENTS_DIR } from './knowledge.js';

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.txt']);
const MAX_BYTES = 25 * 1024 * 1024;

function makeUpload() {
  mkdirSync(ATTACHMENTS_DIR(), { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR()),
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_EXT.has(extname(file.originalname).toLowerCase()))
        return cb(Object.assign(new Error('This file type is not allowed'), { status: 400 }));
      cb(null, true);
    },
  });
}

export function attachmentUploadRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);
  const upload = makeUpload();

  r.post('/:id/attachments', (req, res, next) => {
    upload.single('file')(req, res, async (err: (Error & { status?: number; code?: string }) | null) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status ?? 400);
        return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 25 MB' : err.message });
      }
      try {
        if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });
        const article = await prisma.knowledgeArticle.findUnique({ where: { id: req.params.id } });
        if (!article) {
          await unlink(req.file.path).catch(() => {});
          return res.status(404).json({ error: 'Article not found' });
        }
        const att = await prisma.knowledgeAttachment.create({
          data: {
            articleId: article.id,
            storedName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            uploadedById: req.session.userId!,
          },
          select: { id: true, originalName: true, sizeBytes: true },
        });
        res.status(201).json(att);
      } catch (e) { next(e); }
    });
  });

  return r;
}

export function attachmentsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/:id/download', async (req, res) => {
    const att = await prisma.knowledgeAttachment.findUnique({ where: { id: req.params.id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    const safeName = att.originalName.replace(/[^\w.\- ]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.sendFile(resolve(join(ATTACHMENTS_DIR(), att.storedName)));
  });

  r.delete('/:id', async (req, res) => {
    const att = await prisma.knowledgeAttachment.findUnique({ where: { id: req.params.id } });
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    await prisma.knowledgeAttachment.delete({ where: { id: att.id } });
    await unlink(join(ATTACHMENTS_DIR(), att.storedName)).catch(() => {});
    res.status(204).end();
  });

  return r;
}
