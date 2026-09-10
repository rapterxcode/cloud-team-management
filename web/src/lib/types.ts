export type Me = { id: string; email: string; name: string; title: string; role: 'admin' | 'member' | 'auditor'; workload: number };
export type User = { id: string; name: string; title: string; role: 'admin' | 'member' | 'auditor'; isActive: boolean; workload: number };
export type Project = { id: string; name: string; description: string; status: string; progress: number; department: string; due: string; color: string };
export type ApiTask = { id: string; projectId: string; name: string; description: string; ownerId: string; owner: { id: string; name: string }; phase: string; status: string; priority: string; start: string; date: string; sopArticleId?: string | null; changeDocumentId?: string | null; changeDocument?: { id: string; originalName: string; category: string; referenceNo: string } | null; sopArticle?: { id: string; name: string; category: string } | null };
export type Task = ApiTask & { due: string; ownerName: string };
export type Attachment = { id: string; originalName: string; sizeBytes: number };
export type Article = { id: string; name: string; category: string; body: string; author: { id: string; name: string }; attachments: Attachment[] };
export type Resource = { id: string; name: string; provider: string; type: string; status: string; monthlyCost: number };

export type TaskDraft = {
  name: string;
  projectId?: string;
  projectName?: string;
  ownerId?: string;
  ownerName?: string;
  phase?: string;
  priority?: string;
  start?: string;
  date?: string;
  description?: string;
};

export const withDue = (t: ApiTask): Task => ({ ...t, due: t.date || 'Not set', ownerName: t.owner.name });

export type AuditCategory = 'CR' | 'CC' | 'CRA' | 'Diagram' | 'RBAC' | 'TestEvidence' | 'General';

export interface ProjectDocument {
  id: string;
  projectId: string;
  storedName?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: AuditCategory;
  referenceNo: string;
  uploadedById: string;
  uploadedBy?: { id: string; name: string };
  createdAt: string;
}
