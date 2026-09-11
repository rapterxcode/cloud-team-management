import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
}

export function extractClientInfo(req: Request): ClientInfo {
  const forwarded = req.headers['x-forwarded-for'];
  let ipAddress = '';
  if (Array.isArray(forwarded)) {
    ipAddress = forwarded[0] || '';
  } else if (typeof forwarded === 'string') {
    ipAddress = forwarded.split(',')[0].trim();
  }
  if (!ipAddress) {
    ipAddress = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  }
  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 500);
  return { ipAddress, userAgent };
}

export interface RecordAccessLogParams {
  userId?: string | null;
  email: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'PASSWORD_CHANGE';
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string | null;
}

export async function recordAccessLog(prisma: PrismaClient, params: RecordAccessLogParams) {
  try {
    return await prisma.accessLog.create({
      data: {
        userId: params.userId || null,
        email: params.email.toLowerCase(),
        action: params.action,
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
        failureReason: params.failureReason || null,
      },
    });
  } catch (err) {
    // Audit log write failure must not crash business flow, but should be logged to stderr
    console.error('[audit] failed to record access log:', err);
    return null;
  }
}

export interface RecordAuditLogParams {
  actor: {
    id: string;
    name: string;
    role: string;
  };
  workspaceId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'ROLE_CHANGE' | 'UPLOAD';
  entityType: 'Project' | 'Task' | 'KnowledgeArticle' | 'ProjectDocument' | 'WorkspaceMember' | 'User' | 'Workspace';
  entityId: string;
  details?: Record<string, any>;
}

export async function recordAuditLog(prisma: PrismaClient, params: RecordAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorRole: params.actor.role,
        workspaceId: params.workspaceId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ?? {},
      },
    });
  } catch (err) {
    console.error('[audit] failed to record audit log:', err);
    return null;
  }
}
