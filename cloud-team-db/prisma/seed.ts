import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

// Load .env if present
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

if (!process.env.DATABASE_URL) {
  const user = process.env.POSTGRES_USER || 'postgres';
  const pass = process.env.POSTGRES_PASSWORD || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'ctm';
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`;
}

const hashPassword = (plain: string) =>
  hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

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

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  let adminUserId = '';
  const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true } });
  if (activeAdmins === 0 && adminEmail && adminPassword) {
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'admin', isActive: true },
      create: { email: adminEmail, name: 'Administrator', role: 'admin', passwordHash: await hashPassword(adminPassword) },
    });
    adminUserId = adminUser.id;
  }

  const defaultWsId = 'default-workspace-engineering';
  await prisma.workspace.upsert({
    where: { id: defaultWsId },
    update: {},
    create: {
      id: defaultWsId,
      name: 'Cloud workspace',
      type: 'engineering',
      description: 'Core engineering & platform delivery workspace',
      color: 'purple',
      icon: 'Cloud',
    },
  });

  for (const [name, uid] of Object.entries(users)) {
    const role = name.includes('Auditor') ? 'auditor' : name.includes('Lead') ? 'lead' : 'member';
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: defaultWsId, userId: uid } },
      update: {},
      create: { workspaceId: defaultWsId, userId: uid, role },
    });
  }
  if (adminUserId) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: defaultWsId, userId: adminUserId } },
      update: {},
      create: { workspaceId: defaultWsId, userId: adminUserId, role: 'admin' },
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

const prisma = new PrismaClient();
seed(prisma)
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
