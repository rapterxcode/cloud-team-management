import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/passwords.js';

const DEMO_USERS = [
  { email: 'alex.morgan@demo.local', name: 'Alex Morgan', title: 'Platform Lead' },
  { email: 'sarah.chen@demo.local', name: 'Sarah Chen', title: 'Cloud Engineer' },
  { email: 'james.wilson@demo.local', name: 'James Wilson', title: 'DevOps Engineer' },
  { email: 'priya.patel@demo.local', name: 'Priya Patel', title: 'SRE' },
  { email: 'auditor@cloudteam.internal', name: 'Internal Auditor', title: 'Compliance Auditor' },
];

export async function seed(prisma: PrismaClient) {
  const users: Record<string, string> = {};
  for (const d of DEMO_USERS) {
    const role = d.email.startsWith('auditor') ? 'auditor' : 'member';
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: { ...d, isActive: false, role, passwordHash: await hashPassword(randomUUID()) },
    });
    users[d.name] = u.id;
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';
  const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true } });
  if (activeAdmins === 0 && adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'admin', isActive: true },
      create: { email: adminEmail, name: 'Administrator', role: 'admin', passwordHash: await hashPassword(adminPassword) },
    });
  }

  if ((await prisma.project.count()) === 0) {
    const projects = [
      { name: 'Data Center Consolidation & Hybrid Cloud Setup 2025', description: 'Migrated 40+ legacy on-prem workloads to AWS & GCP hybrid network.', status: 'Completed', progress: 100, department: 'Infrastructure', due: 'Dec 2025', color: 'purple', year: 2025 },
      { name: 'Cloud infrastructure migration', description: 'A stronger foundation for what’s next.', status: 'On track', progress: 72, department: 'Platform', due: 'Sep 18', color: 'purple', year: 2026 },
      { name: 'Developer experience', description: 'Making every deployment feel effortless.', status: 'On track', progress: 48, department: 'Engineering', due: 'Sep 24', color: 'blue', year: 2026 },
      { name: 'Observability rollout', description: 'Clarity across every service and signal.', status: 'At risk', progress: 35, department: 'DevOps', due: 'Sep 12', color: 'orange', year: 2026 },
      { name: 'AI-Powered Fraud Detection & Multi-Region Resiliency 2027', description: 'Next-gen real-time fraud scoring and cross-region active-active failover.', status: 'New', progress: 0, department: 'Security & AI', due: 'Q2 2027', color: 'blue', year: 2027 },
    ];
    const ids: string[] = [];
    for (const p of projects) ids.push((await prisma.project.create({ data: p })).id);

    // Create Documents for Project 1 (Cloud infrastructure migration)
    const crDocument = await prisma.projectDocument.create({
      data: {
        projectId: ids[0],
        storedName: randomUUID(),
        originalName: 'CR-2026-001_Approved.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1048576,
        category: 'CR',
        referenceNo: 'CR-2026-001',
        uploadedById: users['Alex Morgan'],
      }
    });
    await prisma.projectDocument.create({
      data: {
        projectId: ids[0],
        storedName: randomUUID(),
        originalName: 'Architecture_Diagram_v2.png',
        mimeType: 'image/png',
        sizeBytes: 204800,
        category: 'Diagram',
        uploadedById: users['Sarah Chen'],
      }
    });
    await prisma.projectDocument.create({
      data: {
        projectId: ids[0],
        storedName: randomUUID(),
        originalName: 'CRA_Assessment.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512000,
        category: 'CRA',
        uploadedById: users['Alex Morgan'],
      }
    });

    const runbook = await prisma.knowledgeArticle.create({
      data: { name: 'Production deployment checklist', category: 'Runbooks', authorId: users['Alex Morgan'], projectId: ids[0], body: 'Before you deploy\n\n1. Confirm the change has passed review and automated checks.\n2. Check the service dashboard and active incidents.\n3. Record the previous release and rollback procedure.\n4. Deploy to staging and verify the critical user journeys.\n5. Schedule the production change with the on-call engineer.\n\nAfter deployment\n\nWatch error rates and latency. Record the result and hand over any follow-up work.' }
    });

    await prisma.task.createMany({
      data: [
        { projectId: ids[0], start: '2026-09-01', phase: 'Planning', date: '2026-09-07', name: 'Review production deployment pipeline', description: 'Verify GitHub Actions workflows, staging deployment steps, and rollback flags before cutting the production release.', status: 'In progress', priority: 'High', ownerId: users['Alex Morgan'] },
        { projectId: ids[0], start: '2026-09-08', phase: 'Development', date: '2026-09-12', name: 'Configure staging environment', description: 'Provision compute and database instances in the staging VPC matching production network topology.', status: 'To do', priority: 'Medium', ownerId: users['Sarah Chen'], changeDocumentId: crDocument.id, sopArticleId: runbook.id },
        { projectId: ids[1], start: '2026-09-03', phase: 'Development', date: '2026-09-10', name: 'Update infrastructure documentation', description: 'Document cluster topology, ingress setup, and deployment runbooks in the Knowledge Hub.', status: 'In progress', priority: 'Medium', ownerId: users['James Wilson'] },
        { projectId: ids[2], start: '2026-09-05', phase: 'Planning', date: '2026-09-12', name: 'Audit unused cloud resources', description: 'Scan idle instances, unattached disks, and unreferenced buckets across AWS and GCP accounts.', status: 'To do', priority: 'High', ownerId: users['Priya Patel'] },
      ],
    });

    await prisma.knowledgeArticle.createMany({
      data: [
        { name: 'Welcome to the cloud team', category: 'Onboarding', authorId: users['Sarah Chen'], body: 'Your first week\n\nMeet your buddy and review the team directory. Get familiar with our active projects, weekly priorities and service ownership.\n\nStart with a small task, review the relevant runbook and ask your buddy to walk you through the deployment workflow.\n\nKeep useful discoveries here so the next person can find them.' },
        { name: 'Cloud resource naming convention', category: 'Guides', authorId: users['James Wilson'], body: 'Use a consistent name for each resource:\n\nteam-service-environment-region\n\nExample: platform-api-staging-us-east\n\nInclude an owner, environment and project tag. Keep descriptions clear and avoid storing credentials in names or tags.' },
        { name: 'Weekly platform review · September 7', category: 'Meeting notes', authorId: users['Priya Patel'], body: 'Focus this week\n\n• Complete the staging environment setup.\n• Review the migration readiness checklist.\n• Identify unused resources for the next cost review.\n\nDecisions\n\nThe team will document deployment checks in the shared knowledge base. Each project owner will keep task dates up to date.' },
      ],
    });
  }

  if ((await prisma.cloudResource.count()) === 0) {
    await prisma.cloudResource.createMany({
      data: [
        { name: 'production-api', provider: 'AWS', type: 'Compute', status: 'Healthy', monthlyCost: 842 },
        { name: 'analytics-cluster', provider: 'Google Cloud', type: 'Database', status: 'Healthy', monthlyCost: 628 },
        { name: 'staging-services', provider: 'AWS', type: 'Compute', status: 'Healthy', monthlyCost: 316 },
        { name: 'asset-storage', provider: 'Azure', type: 'Storage', status: 'Review needed', monthlyCost: 214 },
      ],
    });
  }
}

const isDirectRun = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
