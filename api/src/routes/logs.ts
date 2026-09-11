import { Router } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../middleware.js';

export function logsRoutes(prisma: PrismaClient) {
  const r = Router();

  // Guard: Only platform admin, workspace admins, or auditors can view logs
  const requireLogViewer = (req: any, res: any, next: any) => {
    const role = req.session?.role;
    if (role === 'admin' || role === 'auditor') {
      return next();
    }
    return res.status(403).json({ error: 'Access denied: Only administrators and compliance auditors can inspect logs' });
  };

  // GET /api/logs/access - Query access logs
  r.get('/access', requireAuth, requireLogViewer, async (req, res) => {
    const action = req.query.action ? String(req.query.action) : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

    const where: Prisma.AccessLogWhereInput = {};
    if (action) {
      where.action = action;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { failureReason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.accessLog.count({ where }),
    ]);

    res.json({ items, total, limit, offset });
  });

  // GET /api/logs/audit - Query data mutation audit logs
  r.get('/audit', requireAuth, requireLogViewer, async (req, res) => {
    const workspaceId = req.query.workspaceId ? String(req.query.workspaceId) : undefined;
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

    const where: Prisma.AuditLogWhereInput = {};
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    if (action) {
      where.action = action;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (search) {
      where.OR = [
        { actorName: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, limit, offset });
  });

  // GET /api/logs/export - Stream CSV export for audits
  r.get('/export', requireAuth, requireLogViewer, async (req, res) => {
    const type = String(req.query.type || 'audit');

    if (type === 'access') {
      const logs = await prisma.accessLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      const header = 'ID,Timestamp,Email,Action,IP Address,User Agent,Failure Reason\n';
      const rows = logs.map((l) =>
        [
          `"${l.id}"`,
          `"${l.createdAt.toISOString()}"`,
          `"${l.email.replace(/"/g, '""')}"`,
          `"${l.action}"`,
          `"${l.ipAddress}"`,
          `"${(l.userAgent || '').replace(/"/g, '""')}"`,
          `"${(l.failureReason || '').replace(/"/g, '""')}"`,
        ].join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="access_logs_${Date.now()}.csv"`);
      return res.send(header + rows);
    }

    // Default: audit logs export
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const header = 'ID,Timestamp,Actor Name,Actor Role,Action,Entity Type,Entity ID,Workspace ID,Details\n';
    const rows = logs.map((l) =>
      [
        `"${l.id}"`,
        `"${l.createdAt.toISOString()}"`,
        `"${l.actorName.replace(/"/g, '""')}"`,
        `"${l.actorRole}"`,
        `"${l.action}"`,
        `"${l.entityType}"`,
        `"${l.entityId}"`,
        `"${l.workspaceId || ''}"`,
        `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
      ].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    res.send(header + rows);
  });

  return r;
}
