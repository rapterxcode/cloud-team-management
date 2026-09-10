import type { PrismaClient } from '@prisma/client';

const ARTICLE_PREVIEW = 400;
const TOTAL_BUDGET = 12000;

function preview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > ARTICLE_PREVIEW ? oneLine.slice(0, ARTICLE_PREVIEW) + '…' : oneLine;
}

export async function buildSnapshot(prisma: PrismaClient): Promise<string> {
  const [projects, tasks, users, resources, articles] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany({ include: { owner: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { name: true, title: true, workload: true }, orderBy: { createdAt: 'asc' } }),
    prisma.cloudResource.findMany({ orderBy: { name: 'asc' } }),
    prisma.knowledgeArticle.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const totalCost = resources.reduce((s, r) => s + r.monthlyCost, 0);
  const sections: string[] = [];
  sections.push(
    'PROJECTS\n' +
      (projects.map((p) => `- ${p.name} [${p.status}, ${p.progress}%] dept=${p.department} due=${p.due}`).join('\n') || '- (none)'),
  );
  sections.push(
    'TASKS\n' +
      (tasks
        .map((t) => `- ${t.name} (project: ${t.project.name}) owner=${t.owner.name} status=${t.status} priority=${t.priority} ${t.start || '?'}→${t.date || '?'}`)
        .join('\n') || '- (none)'),
  );
  sections.push('TEAM\n' + (users.map((u) => `- ${u.name}${u.title ? `, ${u.title}` : ''} (workload ${u.workload}%)`).join('\n') || '- (none)'));
  sections.push(
    `CLOUD RESOURCES (total $${totalCost}/mo)\n` +
      (resources.map((r) => `- ${r.name} [${r.provider} ${r.type}] ${r.status} $${r.monthlyCost}/mo`).join('\n') || '- (none)'),
  );
  sections.push(
    'KNOWLEDGE\n' +
      (articles.map((a) => `- ${a.name} [${a.category}]: ${preview(a.body)}`).join('\n') || '- (none)'),
  );

  let out = sections.join('\n\n');
  if (out.length > TOTAL_BUDGET) out = out.slice(0, TOTAL_BUDGET) + '\n…(truncated)';
  return out;
}
