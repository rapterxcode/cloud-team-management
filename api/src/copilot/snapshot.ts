import type { PrismaClient } from '@prisma/client';

const TOTAL_BUDGET = 1_000_000; // 1M characters (~250k tokens), well within Gemini's 1M-token window

function cleanHtmlForContext(html: string): string {
  // Strip heavy script and style tags to reduce token noise while preserving all semantic content, headings, and commands
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function buildSnapshot(prisma: PrismaClient): Promise<string> {
  const [projects, tasks, users, resources, articles, projectDocuments] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany({
      include: {
        owner: { select: { name: true } },
        project: { select: { name: true } },
        sopArticle: { select: { name: true } },
        changeDocument: { select: { referenceNo: true, category: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        name: true,
        title: true,
        role: true,
        _count: { select: { tasks: { where: { status: { not: 'Done' } } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.cloudResource.findMany({ orderBy: { name: 'asc' } }),
    prisma.knowledgeArticle.findMany({
      include: {
        author: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectDocument.findMany({
      include: {
        project: { select: { name: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const totalCost = resources.reduce((s, r) => s + r.monthlyCost, 0);
  const sections: string[] = [];

  sections.push(
    'PROJECTS\n' +
      (projects
        .map(
          (p) =>
            `- [${p.id}] ${p.name} [Status: ${p.status}, Progress: ${p.progress}%] Team/Dept: ${p.department}, FY: ${p.year}, Due: ${p.due}${p.description ? `\n  Description: ${p.description}` : ''}`
        )
        .join('\n') || '- (none)'),
  );

  sections.push(
    'TASKS\n' +
      (tasks
        .map(
          (t) =>
            `- [${t.id}] ${t.name} (Project: ${t.project.name}) Owner: ${t.owner.name}, Status: ${t.status}, Priority: ${t.priority}, Phase: ${t.phase}, Timeline: ${t.start || '?'} → ${t.date || '?'}${t.sopArticle ? ` (SOP: ${t.sopArticle.name})` : ''}${t.changeDocument ? ` (CR/CC Ref: ${t.changeDocument.referenceNo} [${t.changeDocument.category}])` : ''}${t.description ? `\n  Notes/Checklist:\n  ${t.description.replace(/\n/g, '\n  ')}` : ''}`
        )
        .join('\n') || '- (none)'),
  );

  sections.push(
    'TEAM DIRECTORY & WORKLOAD\n' +
      (users
        .map((u) => {
          const load = Math.min(100, (u._count?.tasks ?? 0) * 20);
          return `- ${u.name} (${u.role}${u.title ? `, ${u.title}` : ''}) [Workload: ${load}%, Active Tasks: ${u._count?.tasks ?? 0}]`;
        })
        .join('\n') || '- (none)'),
  );

  sections.push(
    `CLOUD RESOURCES & INVENTORY (Total Monthly Spend: $${totalCost.toLocaleString()})\n` +
      (resources
        .map((r) => `- ${r.name} [Provider: ${r.provider}, Type: ${r.type}] Status: ${r.status}, Monthly Cost: $${r.monthlyCost.toLocaleString()}`)
        .join('\n') || '- (none)'),
  );

  sections.push(
    'COMPLIANCE & PROJECT DOCUMENTS (ISO 27001 / BOT)\n' +
      (projectDocuments
        .map(
          (d) =>
            `- [${d.category}] ${d.referenceNo ? `(${d.referenceNo}) ` : ''}${d.originalName} (Project: ${d.project.name}, Uploaded by: ${d.uploadedBy.name})`
        )
        .join('\n') || '- (none)'),
  );

  sections.push(
    'KNOWLEDGE BASE & RUNBOOKS (FULL CONTENT)\n' +
      (articles
        .map((a) => {
          const content = a.format === 'html' ? cleanHtmlForContext(a.body) : a.body;
          return `=== ARTICLE: ${a.name} [Category: ${a.category}, Format: ${a.format}, Author: ${a.author.name}${a.project ? `, Project: ${a.project.name}` : ''}] ===\n${content}\n=== END ARTICLE ===`;
        })
        .join('\n\n') || '- (none)'),
  );

  let out = sections.join('\n\n');
  if (out.length > TOTAL_BUDGET) out = out.slice(0, TOTAL_BUDGET) + '\n…(truncated)';
  return out;
}
