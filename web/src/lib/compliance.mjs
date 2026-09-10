export const AUDIT_CATEGORIES = ['CR', 'CC', 'CRA', 'Diagram', 'RBAC', 'TestEvidence', 'General'];

export const AUDIT_CHECKPOINTS = ['CRA', 'Diagram', 'RBAC', 'CC'];

export function calculateProjectReadiness(docs = [], tasks = []) {
  const hasCRA = docs.some(d => d.category === 'CRA');
  const hasDiagram = docs.some(d => d.category === 'Diagram');
  const hasRBAC = docs.some(d => d.category === 'RBAC');
  const hasCC = docs.some(d => d.category === 'CC' || d.category === 'CR');

  const missingCheckpoints = [];
  if (!hasCRA) missingCheckpoints.push('CRA');
  if (!hasDiagram) missingCheckpoints.push('Diagram');
  if (!hasRBAC) missingCheckpoints.push('RBAC');
  if (!hasCC) missingCheckpoints.push('CC');

  let deploymentTasksTotal = 0;
  let deploymentTasksTraceable = 0;

  for (const task of tasks) {
    const phaseLower = (task.phase || '').toLowerCase();
    const nameLower = (task.name || '').toLowerCase();
    
    if (phaseLower === 'deployment' || phaseLower.includes('deploy') || nameLower.includes('deploy')) {
      deploymentTasksTotal++;
      if (task.changeDocumentId) {
        deploymentTasksTraceable++;
      }
    }
  }

  let score = 0;
  if (hasCRA) score += 20;
  if (hasDiagram) score += 20;
  if (hasRBAC) score += 20;
  if (hasCC) score += 20;
  
  if (deploymentTasksTotal > 0) {
    score += Math.round((deploymentTasksTraceable / deploymentTasksTotal) * 20);
  } else {
    // If there are no deployment tasks, the base checkpoints count for 100% (25% each)
    score = 0;
    if (hasCRA) score += 25;
    if (hasDiagram) score += 25;
    if (hasRBAC) score += 25;
    if (hasCC) score += 25;
  }

  return {
    hasCRA,
    hasDiagram,
    hasRBAC,
    hasCC,
    deploymentTasksTotal,
    deploymentTasksTraceable,
    readinessScore: score,
    missingCheckpoints
  };
}
