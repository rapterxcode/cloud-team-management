export type WorkspaceRole = 'admin' | 'lead' | 'member' | 'auditor' | 'viewer';

export type Workspace = {
  id: string;
  name: string;
  type: string;
  description: string;
  color: string;
  icon: string;
  myRole?: WorkspaceRole;
  createdAt?: string;
  updatedAt?: string;
  _count?: { projects: number; members: number };
};

export type AccessLogItem = {
  id: string;
  userId?: string | null;
  email: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  failureReason?: string | null;
  createdAt: string;
};

export type AuditLogItem = {
  id: string;
  workspaceId?: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  createdAt: string;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  title: string;
  role: 'admin' | 'member' | 'auditor';
  workload: number;
  workspaces?: Workspace[];
};

export type User = { id: string; name: string; title: string; role: 'admin' | 'member' | 'auditor'; isActive: boolean; workload: number };
export type Project = { id: string; workspaceId?: string | null; name: string; description: string; status: string; progress: number; department: string; due: string; color: string; year: number; createdAt?: string };
export type ApiTask = { id: string; projectId: string; name: string; description: string; ownerId: string; owner: { id: string; name: string }; phase: string; status: string; priority: string; start: string; date: string; sopArticleId?: string | null; changeDocumentId?: string | null; changeDocument?: { id: string; originalName: string; category: string; referenceNo: string } | null; sopArticle?: { id: string; name: string; category: string } | null };
export type Task = ApiTask & { due: string; ownerName: string };
export type Attachment = { id: string; originalName: string; sizeBytes: number };
export type Article = {
  id: string;
  workspaceId?: string | null;
  isGlobal?: boolean;
  name: string;
  category: string;
  body: string;
  format?: 'markdown' | 'html';
  chatHistory?: any[] | null;
  author: { id: string; name: string };
  attachments: Attachment[];
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};
export type KnowledgeCategory = { id: string; name: string; color: string; icon: string; createdAt?: string };
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

export type ProjectDraft = {
  name: string;
  description?: string;
  year?: number;
  status?: string;
  due?: string;
};

export type ArticleDraft = {
  name?: string;
  category?: string;
  body: string;
  format?: 'markdown' | 'html';
  summary?: string;
};

export type CopilotAttachment = {
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type CopilotResponse = {
  answer: string;
  draftProject?: ProjectDraft;
  draftArticles?: ArticleDraft[];
  draftTask?: TaskDraft;
  draftTasks?: TaskDraft[];
  conversationId?: string;
};

export type CopilotConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type CopilotConversationDetail = {
  id: string;
  title: string;
  userId: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
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
