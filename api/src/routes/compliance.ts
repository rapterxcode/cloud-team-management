import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware.js';

export function complianceRoutes(prisma: PrismaClient) {
  const r = Router();
  r.use(requireAuth);

  r.get('/matrix', async (_req, res) => {
    const projects = await prisma.project.findMany({
      include: {
        tasks: { select: { id: true, phase: true, status: true, changeDocumentId: true, name: true } },
        documents: { select: { id: true, category: true, referenceNo: true, originalName: true } },
      },
    });

    let readyCount = 0;
    
    const results = projects.map(p => {
      const docs = p.documents;
      const tasks = p.tasks;

      const hasCRA = docs.some(d => d.category === 'CRA');
      const hasDiagram = docs.some(d => d.category === 'Diagram');
      const hasRBAC = docs.some(d => d.category === 'RBAC');
      const hasCC = docs.some(d => d.category === 'CC' || d.category === 'CR');
      
      const deploymentTasks = tasks.filter(t => t.phase === 'Deployment' || t.name.toLowerCase().includes('deploy'));
      const deploymentTasksTotal = deploymentTasks.length;
      const deploymentTasksTraceable = deploymentTasks.filter(t => t.changeDocumentId !== null).length;
      
      const hasTraceability = deploymentTasksTotal === 0 || deploymentTasksTraceable === deploymentTasksTotal;

      let score = 0;
      const missingCheckpoints: string[] = [];
      if (hasCRA) score += 20; else missingCheckpoints.push('CRA');
      if (hasDiagram) score += 20; else missingCheckpoints.push('Diagram');
      if (hasRBAC) score += 20; else missingCheckpoints.push('RBAC');
      if (hasCC) score += 20; else missingCheckpoints.push('CC');
      if (hasTraceability) score += 20; else missingCheckpoints.push('Deployment Traceability');

      if (score === 100) readyCount++;

      return {
        id: p.id,
        name: p.name,
        hasCRA,
        hasDiagram,
        hasRBAC,
        hasCC,
        deploymentTasksTotal,
        deploymentTasksTraceable,
        readinessScore: score,
        missingCheckpoints
      };
    });

    const totalProjects = projects.length;
    const pendingProjects = totalProjects - readyCount;
    const avgReadiness = totalProjects === 0 ? 0 : Math.round(results.reduce((acc, p) => acc + p.readinessScore, 0) / totalProjects);

    res.json({
      projects: results,
      summary: {
        totalProjects,
        readyProjects: readyCount,
        pendingProjects,
        avgReadiness
      }
    });
  });

  return r;
}
