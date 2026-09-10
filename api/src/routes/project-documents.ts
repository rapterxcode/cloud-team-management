import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { ATTACHMENTS_DIR } from './knowledge.js';
import { AUDIT_CATEGORIES, DOCUMENT_EXTS, assertIn } from '../validate.js';

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
      if (!DOCUMENT_EXTS.has(extname(file.originalname).toLowerCase()))
        return cb(Object.assign(new Error('This file type is not allowed'), { status: 400 }));
      cb(null, true);
    },
  });
}

export function projectDocumentsRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);
  
  const upload = makeUpload();

  r.get('/project-documents', async (_req, res) => {
    const documents = await prisma.projectDocument.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        uploadedBy: { select: { id: true, name: true } }
      }
    });
    res.json(documents);
  });

  r.get('/projects/:id/documents', async (req, res) => {
    const { category } = req.query;
    const documents = await prisma.projectDocument.findMany({
      where: {
        projectId: req.params.id,
        ...(category ? { category: String(category) } : {})
      },
      orderBy: { createdAt: 'asc' },
      include: {
        uploadedBy: { select: { id: true, name: true } }
      }
    });
    res.json(documents);
  });

  r.post('/projects/:id/documents', (req, res, next) => {
    upload.single('file')(req, res, async (err: any) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status ?? 400);
        return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 25 MB' : err.message });
      }
      try {
        if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });
        
        const category = req.body.category;
        try {
          assertIn(category, [...AUDIT_CATEGORIES], 'Category');
        } catch (e: any) {
          await unlink(req.file.path).catch(() => {});
          return res.status(400).json({ error: e.message });
        }

        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!project) {
          await unlink(req.file.path).catch(() => {});
          return res.status(404).json({ error: 'Project not found' });
        }

        const doc = await prisma.projectDocument.create({
          data: {
            projectId: project.id,
            storedName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            category: String(category),
            referenceNo: req.body.referenceNo ? String(req.body.referenceNo) : '',
            uploadedById: req.session.userId!,
          },
        });
        res.status(201).json(doc);
      } catch (e) { next(e); }
    });
  });

  r.get('/project-documents/:id/download', async (req, res) => {
    const doc = await prisma.projectDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const safeName = doc.originalName.replace(/[^\w.\- ]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.sendFile(resolve(join(ATTACHMENTS_DIR(), doc.storedName)));
  });

  r.get('/project-documents/:id/preview', async (req, res) => {
    const doc = await prisma.projectDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const safeName = doc.originalName.replace(/[^\w.\- ]/g, '_');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.sendFile(resolve(join(ATTACHMENTS_DIR(), doc.storedName)));
  });

  r.delete('/project-documents/:id', async (req, res) => {
    const doc = await prisma.projectDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (doc.uploadedById !== req.session.userId && req.session.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: only uploader or admin can delete this document' });
    }

    await prisma.projectDocument.delete({ where: { id: doc.id } });
    await unlink(join(ATTACHMENTS_DIR(), doc.storedName)).catch(() => {});
    res.status(204).end();
  });

  return r;
}
