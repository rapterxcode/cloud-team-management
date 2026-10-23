import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';
import { recordAuditLog } from '../audit.js';

export function workspacesRoutes(prisma: PrismaClient) {
  const r = Router();

  // Helper to fetch user's role in a workspace
  async function getMemberRole(workspaceId: string, userId: string, platformRole: string) {
    if (platformRole === 'admin') return 'admin';
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member?.role ?? null;
  }

  // GET /api/workspaces - List all workspaces user is a member of (or all if platform admin)
  r.get('/', requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const platformRole = req.session.role!;

    if (platformRole === 'admin') {
      const all = await prisma.workspace.findMany({
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, title: true } },
            },
          },
          _count: { select: { projects: true, members: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return res.json(all);
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: { select: { projects: true, members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      myRole: m.role,
    }));
    res.json(workspaces);
  });

  // POST /api/workspaces - Create a new workspace
  r.post('/', requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const platformRole = req.session.role!;

    // Auditors cannot create workspaces
    if (platformRole === 'auditor') {
      return res.status(403).json({ error: 'Auditor cannot create workspaces' });
    }

    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });
    if (name.length > 100) return res.status(400).json({ error: 'Name must be at most 100 characters' });

    const type = String(req.body?.type ?? 'engineering').trim();
    const description = String(req.body?.description ?? '').trim().slice(0, 1000);
    const color = String(req.body?.color ?? 'purple').trim();
    const icon = String(req.body?.icon ?? 'Cloud').trim();

    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (!actor) return res.status(401).json({ error: 'User not found' });

    const workspace = await prisma.workspace.create({
      data: {
        name,
        type,
        description,
        color,
        icon,
        members: {
          create: {
            userId,
            role: 'admin', // Creator is automatically admin of this workspace
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, title: true } },
          },
        },
      },
    });

    await recordAuditLog(prisma, {
      actor: { id: actor.id, name: actor.name, role: actor.role },
      workspaceId: workspace.id,
      action: 'CREATE',
      entityType: 'Workspace',
      entityId: workspace.id,
      details: { name: workspace.name, type: workspace.type },
    });

    res.status(201).json(workspace);
  });

  // GET /api/workspaces/:id - Get workspace details & members
  r.get('/:id', requireAuth, async (req, res) => {
    const workspaceId = String(req.params.id);
    const userId = req.session.userId!;
    const platformRole = req.session.role!;

    const role = await getMemberRole(workspaceId, userId, platformRole);
    if (!role) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, title: true, isActive: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        projects: {
          select: { id: true, name: true, status: true, progress: true, department: true, year: true },
        },
      },
    });

    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    res.json({ ...workspace, myRole: role });
  });

  // PATCH /api/workspaces/:id - Update workspace details
  r.patch('/:id', requireAuth, async (req, res) => {
    const workspaceId = String(req.params.id);
    const userId = req.session.userId!;
    const platformRole = req.session.role!;

    const role = await getMemberRole(workspaceId, userId, platformRole);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admin can modify workspace settings' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : undefined;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;
    const color = typeof req.body?.color === 'string' ? req.body.color.trim() : undefined;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon.trim() : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'Workspace name cannot be empty' });
    }

    const current = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!current) return res.status(404).json({ error: 'Workspace not found' });

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(icon !== undefined ? { icon } : {}),
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        workspaceId: updated.id,
        action: 'UPDATE',
        entityType: 'Workspace',
        entityId: updated.id,
        details: { before: current, after: updated },
      });
    }

    res.json(updated);
  });

  // POST /api/workspaces/:id/members - Add or update a member in workspace
  r.post('/:id/members', requireAuth, async (req, res) => {
    const workspaceId = String(req.params.id);
    const currentUserId = req.session.userId!;
    const platformRole = req.session.role!;

    const role = await getMemberRole(workspaceId, currentUserId, platformRole);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admin can manage members' });
    }

    const targetUserId = String(req.body?.userId ?? '').trim();
    const newRole = String(req.body?.role ?? 'member').trim();

    if (!targetUserId) return res.status(400).json({ error: 'User ID is required' });
    if (!['admin', 'lead', 'member', 'auditor', 'viewer'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      update: { role: newRole },
      create: { workspaceId, userId: targetUserId, role: newRole },
      include: {
        user: { select: { id: true, name: true, email: true, title: true } },
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        workspaceId,
        action: 'ROLE_CHANGE',
        entityType: 'WorkspaceMember',
        entityId: member.id,
        details: { targetUser: targetUser.email, role: newRole },
      });
    }

    res.json(member);
  });

  // DELETE /api/workspaces/:id/members/:userId - Remove a member from workspace
  r.delete('/:id/members/:targetUserId', requireAuth, async (req, res) => {
    const workspaceId = String(req.params.id);
    const targetUserId = String(req.params.targetUserId);
    const currentUserId = req.session.userId!;
    const platformRole = req.session.role!;

    const role = await getMemberRole(workspaceId, currentUserId, platformRole);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admin can remove members' });
    }

    // Check if removing the last admin of the workspace
    const adminCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: 'admin' },
    });
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (targetMembership?.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last workspace admin' });
    }

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    const actor = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        workspaceId,
        action: 'DELETE',
        entityType: 'WorkspaceMember',
        entityId: targetUserId,
        details: { removedUserId: targetUserId },
      });
    }

    res.json({ ok: true });
  });

  // DELETE /api/workspaces/:id - Delete a workspace
  r.delete('/:id', requireAuth, async (req, res) => {
    const workspaceId = String(req.params.id);
    const currentUserId = req.session.userId!;
    const platformRole = req.session.role!;

    if (workspaceId === 'default-workspace-engineering') {
      return res.status(400).json({ error: 'Default engineering workspace cannot be deleted' });
    }

    const role = await getMemberRole(workspaceId, currentUserId, platformRole);
    if (role !== 'admin' && platformRole !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admin can delete this workspace' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    await prisma.workspace.delete({ where: { id: workspaceId } });

    const actor = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (actor) {
      await recordAuditLog(prisma, {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        workspaceId: null,
        action: 'DELETE',
        entityType: 'Workspace',
        entityId: workspaceId,
        details: { name: workspace.name },
      });
    }

    res.json({ ok: true });
  });

  return r;
}
