export type Me = { id: string; email: string; name: string; title: string; role: 'admin' | 'member'; workload: number };
export type User = { id: string; name: string; title: string; role: string; isActive: boolean; workload: number };
export type Project = { id: string; name: string; description: string; status: string; progress: number; department: string; due: string; color: string };
export type ApiTask = { id: string; projectId: string; name: string; ownerId: string; owner: { id: string; name: string }; phase: string; status: string; priority: string; start: string; date: string };
export type Task = ApiTask & { due: string; ownerName: string };
export type Attachment = { id: string; originalName: string; sizeBytes: number };
export type Article = { id: string; name: string; category: string; body: string; author: { id: string; name: string }; attachments: Attachment[] };
export type Resource = { id: string; name: string; provider: string; type: string; status: string; monthlyCost: number };

export const withDue = (t: ApiTask): Task => ({ ...t, due: t.date || 'Not set', ownerName: t.owner.name });
