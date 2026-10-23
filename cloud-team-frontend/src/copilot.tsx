import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Check,
  Copy,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldAlert,
  History,
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  Maximize2,
  Minimize2,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  Mail,
  File,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import { api, post, destroy } from '@/lib/api';
import type {
  ApiTask,
  TaskDraft,
  ProjectDraft,
  ArticleDraft,
  Project,
  Article,
  Me,
  CopilotResponse,
  CopilotConversationSummary,
  CopilotConversationDetail,
  CopilotAttachment,
} from '@/lib/types';
import MarkdownViewer from './markdown-viewer';
import {
  COPILOT_QUICK_ACTIONS,
  normalizeBatchDraftTasks,
  extractReportTitle,
  isSubstantiveReport,
  groupConversationsByDate,
  formatFileSize,
  getFileCategory,
} from '@/lib/copilot-helpers.mjs';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: CopilotAttachment[];
  draftProject?: ProjectDraft;
  draftArticles?: ArticleDraft[];
  draftTasks?: TaskDraft[];
  draftTask?: TaskDraft;
  createdProject?: { id: string; name: string };
  createdArticleMap?: Record<number, string>;
  createdTaskMap?: Record<number, string>;
  dismissed?: boolean;
  projectDismissed?: boolean;
  articlesDismissed?: boolean;
  tasksDismissed?: boolean;
  savedAsArticle?: boolean;
};

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  uploading: boolean;
  error?: string;
  uploaded?: CopilotAttachment;
};

function AttachmentIcon({ category, size = 15 }: { category: string; size?: number }) {
  switch (category) {
    case 'image':
      return <FileImage size={size} className="text-emerald-500 shrink-0" />;
    case 'excel':
      return <FileSpreadsheet size={size} className="text-emerald-600 shrink-0" />;
    case 'word':
      return <FileText size={size} className="text-blue-600 shrink-0" />;
    case 'powerpoint':
      return <FileText size={size} className="text-orange-500 shrink-0" />;
    case 'outlook':
      return <Mail size={size} className="text-purple-600 shrink-0" />;
    case 'code':
      return <FileCode size={size} className="text-amber-500 shrink-0" />;
    case 'pdf':
      return <FileText size={size} className="text-rose-500 shrink-0" />;
    default:
      return <File size={size} className="text-slate-500 shrink-0" />;
  }
}

function ProjectDraftCard({
  draft,
  currentUser,
  createdProject,
  onCreated,
  onDismiss,
}: {
  draft: ProjectDraft;
  currentUser?: Me | null;
  createdProject?: { id: string; name: string };
  onCreated: (proj: { id: string; name: string }) => Promise<void> | void;
  onDismiss?: () => void;
}) {
  const isAuditor = currentUser?.role === 'auditor';
  const [projectState, setProjectState] = useState<ProjectDraft>(draft);
  const [isExpanded, setIsExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(createdProject || null);
  const [error, setError] = useState('');

  const submitProject = async () => {
    const name = String(projectState.name || '').trim();
    if (!name) {
      setError('Project name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await post<Project>('/projects', {
        name,
        description: projectState.description || 'Project initiated via AI Copilot.',
        year: Number(projectState.year) || 2026,
        status: projectState.status || 'New',
        due: projectState.due || undefined,
      });
      const createdObj = { id: res.id, name: res.name };
      setCreated(createdObj);
      await onCreated(createdObj);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="task-draft-card border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-md">
      <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-xs">
            <Sparkles size={13} />
          </span>
          <span className="font-semibold text-xs text-blue-900 dark:text-blue-300">
            Project Proposal
          </span>
        </div>
        {created && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={12} /> Project Created
          </span>
        )}
      </div>

      {isAuditor && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
          <ShieldAlert size={14} className="shrink-0" />
          <span>Auditor Mode (Read-Only) — Project creation restricted under ISO 27001 / BOT SoD.</span>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 mt-1">
        <div
          className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/80 rounded-t-lg select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold shrink-0 ${
              created ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}>
              {created ? <Check size={11} /> : 'P'}
            </span>
            <strong className={`truncate font-medium text-slate-800 dark:text-slate-200 ${created ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
              {projectState.name || 'Untitled Project'}
            </strong>
            {projectState.status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                {projectState.status}
              </span>
            )}
            {projectState.year && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                {projectState.year}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {created ? (
              <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-0.5">
                <Check size={13} /> Active
              </span>
            ) : (
              !isAuditor && (
                <button
                  type="button"
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
                  disabled={submitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    submitProject();
                  }}
                >
                  {submitting ? 'Creating…' : 'Create Project'}
                </button>
              )
            )}
            <span className="text-slate-400 p-0.5">
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 rounded-b-lg flex flex-col gap-2.5">
            <div className="task-draft-field">
              <label>Project Name</label>
              <input
                value={projectState.name || ''}
                disabled={Boolean(created) || isAuditor}
                onChange={(e) => setProjectState({ ...projectState, name: e.target.value })}
                placeholder="e.g. Platform Modernization"
              />
            </div>
            <div className="task-draft-field">
              <label>Description</label>
              <textarea
                value={projectState.description || ''}
                disabled={Boolean(created) || isAuditor}
                onChange={(e) => setProjectState({ ...projectState, description: e.target.value })}
                placeholder="Project overview and objectives..."
                rows={2}
              />
            </div>
            <div className="task-draft-meta">
              <div className="task-draft-field">
                <label>Year</label>
                <select
                  value={String(projectState.year || 2026)}
                  disabled={Boolean(created) || isAuditor}
                  onChange={(e) => setProjectState({ ...projectState, year: Number(e.target.value) })}
                >
                  {['2024', '2025', '2026', '2027', '2028'].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="task-draft-field">
                <label>Status</label>
                <select
                  value={projectState.status || 'New'}
                  disabled={Boolean(created) || isAuditor}
                  onChange={(e) => setProjectState({ ...projectState, status: e.target.value })}
                >
                  {['New', 'On track', 'At risk', 'Completed'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="task-draft-field">
                <label>Due Date</label>
                <input
                  type="date"
                  value={projectState.due ? projectState.due.slice(0, 10) : ''}
                  disabled={Boolean(created) || isAuditor}
                  onChange={(e) => setProjectState({ ...projectState, due: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-md border border-rose-200 dark:border-rose-900">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-blue-100 dark:border-blue-900/40 text-xs">
        <span className="text-[11px] text-slate-500">
          {created ? 'Project registered in workspace.' : 'Review details before initializing project.'}
        </span>
        <div className="flex items-center gap-2">
          {onDismiss && !created && (
            <button
              type="button"
              className="px-2.5 py-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
          {!created && !isAuditor && (
            <button
              type="button"
              disabled={submitting}
              className="px-3 py-1 font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
              onClick={submitProject}
            >
              {submitting ? 'Creating Project…' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchArticleDraftCard({
  drafts,
  projects,
  targetProjectId,
  currentUser,
  onCreated,
  onDismiss,
}: {
  drafts: ArticleDraft[];
  projects: { id: string; name: string }[];
  targetProjectId?: string;
  currentUser?: Me | null;
  onCreated: (createdIndex: number, createdId: string) => Promise<void> | void;
  onDismiss?: () => void;
}) {
  const isAuditor = currentUser?.role === 'auditor';
  const [articlesState, setArticlesState] = useState<ArticleDraft[]>(drafts);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(drafts.length === 1 ? 0 : null);
  const [createdMap, setCreatedMap] = useState<Record<number, string>>({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [individualSubmitting, setIndividualSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');

  const updateArticleField = (index: number, field: keyof ArticleDraft, value: string) => {
    setArticlesState((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const submitSingle = async (index: number) => {
    const a = articlesState[index];
    if (!a) return;
    const articleName = String(a.name || '').trim();
    const articleBody = String(a.body || '').trim();
    if (!articleName) {
      setError(`Article #${index + 1} requires a title`);
      return;
    }
    if (!articleBody) {
      setError(`Article #${index + 1} has no content`);
      return;
    }

    setIndividualSubmitting(index);
    setError('');
    try {
      const res = await post<Article>('/knowledge', {
        name: articleName,
        body: articleBody,
        category: a.category || 'Architecture',
        format: a.format || 'markdown',
        projectId: targetProjectId || undefined,
      });
      setCreatedMap((prev) => ({ ...prev, [index]: res.id }));
      await onCreated(index, res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save article');
    } finally {
      setIndividualSubmitting(null);
    }
  };

  const submitAll = async () => {
    setBatchSubmitting(true);
    setError('');
    try {
      for (let i = 0; i < articlesState.length; i++) {
        if (createdMap[i]) continue;
        const a = articlesState[i];
        const articleName = String(a.name || '').trim();
        const articleBody = String(a.body || '').trim();
        if (!articleName || !articleBody) continue;

        const res = await post<Article>('/knowledge', {
          name: articleName,
          body: articleBody,
          category: a.category || 'Architecture',
          format: a.format || 'markdown',
          projectId: targetProjectId || undefined,
        });
        setCreatedMap((prev) => ({ ...prev, [i]: res.id }));
        await onCreated(i, res.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error occurred during batch creation');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const createdCount = Object.keys(createdMap).length;
  const allCreated = createdCount === articlesState.length && articlesState.length > 0;

  return (
    <div className="task-draft-card border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 shadow-md">
      <div className="flex items-center justify-between pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white shadow-xs">
            <BookOpen size={13} />
          </span>
          <span className="font-semibold text-xs text-emerald-900 dark:text-emerald-300">
            {articlesState.length > 1
              ? `Knowledge & Runbook Proposals (${articlesState.length} items)`
              : 'Knowledge Article Proposal'}
          </span>
        </div>
        {createdCount > 0 && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={12} /> {createdCount} / {articlesState.length} saved
          </span>
        )}
      </div>

      {isAuditor && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
          <ShieldAlert size={14} className="shrink-0" />
          <span>Auditor Mode (Read-Only) — Knowledge authoring restricted under ISO 27001 / BOT SoD.</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 mt-1">
        {articlesState.map((art, idx) => {
          const isCreated = Boolean(createdMap[idx]);
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={idx}
              className={`rounded-lg border transition-all text-xs ${
                isCreated
                  ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'
              }`}
            >
              <div
                className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/80 rounded-t-lg select-none"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold shrink-0 ${
                    isCreated ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {isCreated ? <Check size={11} /> : idx + 1}
                  </span>
                  <strong className={`truncate font-medium text-slate-800 dark:text-slate-200 ${isCreated ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {art.name || 'Untitled document'}
                  </strong>
                  {art.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                      {art.category}
                    </span>
                  )}
                  {art.format && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 shrink-0 uppercase">
                      {art.format}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCreated ? (
                    <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-0.5">
                      <Check size={13} /> Saved
                    </span>
                  ) : (
                    !isAuditor && (
                      <button
                        type="button"
                        className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                        disabled={individualSubmitting === idx || batchSubmitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          submitSingle(idx);
                        }}
                      >
                        {individualSubmitting === idx ? '…' : 'Save'}
                      </button>
                    )
                  )}
                  <span className="text-slate-400 p-0.5">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 rounded-b-lg flex flex-col gap-2.5">
                  <div className="task-draft-field">
                    <label>Article Title</label>
                    <input
                      value={art.name || ''}
                      disabled={isCreated || isAuditor}
                      onChange={(e) => updateArticleField(idx, 'name', e.target.value)}
                      placeholder="Title..."
                    />
                  </div>
                  <div className="task-draft-meta">
                    <div className="task-draft-field">
                      <label>Category</label>
                      <input
                        value={art.category || 'Architecture'}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateArticleField(idx, 'category', e.target.value)}
                        placeholder="e.g. Architecture, SRE, DevSecOps"
                      />
                    </div>
                    <div className="task-draft-field">
                      <label>Format</label>
                      <select
                        value={art.format || 'markdown'}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateArticleField(idx, 'format', e.target.value as 'markdown' | 'html')}
                      >
                        <option value="markdown">Markdown</option>
                        <option value="html">Interactive HTML</option>
                      </select>
                    </div>
                  </div>
                  <div className="task-draft-field">
                    <label>Content Preview / Editor</label>
                    <textarea
                      value={art.body || ''}
                      disabled={isCreated || isAuditor}
                      onChange={(e) => updateArticleField(idx, 'body', e.target.value)}
                      rows={4}
                      className="font-mono text-[11px]"
                      placeholder="Content..."
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-md border border-rose-200 dark:border-rose-900">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-900/40 text-xs">
        <span className="text-[11px] text-slate-500">
          {allCreated ? 'All knowledge articles saved to hub.' : 'Review articles before publishing to Knowledge Hub.'}
        </span>
        <div className="flex items-center gap-2">
          {onDismiss && !allCreated && (
            <button
              type="button"
              className="px-2.5 py-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
          {!allCreated && !isAuditor && articlesState.length > 1 && (
            <button
              type="button"
              disabled={batchSubmitting || individualSubmitting !== null}
              className="flex items-center gap-1 px-3 py-1 font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50"
              onClick={submitAll}
            >
              <CheckCheck size={13} />
              <span>{batchSubmitting ? 'Saving All…' : `Save All (${articlesState.length - createdCount}) Articles`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchTaskDraftCard({
  drafts,
  projects,
  owners,
  currentUser,
  targetProject,
  onCreated,
  onDismiss,
}: {
  drafts: TaskDraft[];
  projects: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  currentUser?: Me | null;
  targetProject?: { id: string; name: string };
  onCreated: (createdIndex: number, createdId: string) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const isAuditor = currentUser?.role === 'auditor';
  const [tasksState, setTasksState] = useState<TaskDraft[]>(drafts);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(drafts.length === 1 ? 0 : null);
  const [createdMap, setCreatedMap] = useState<Record<number, string>>({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [individualSubmitting, setIndividualSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');

  const allProjects = targetProject && !projects.some((p) => p.id === targetProject.id)
    ? [targetProject, ...projects]
    : projects;

  useEffect(() => {
    if (targetProject) {
      setTasksState((prev) =>
        prev.map((t) => {
          if (!t.projectId || t.projectName === targetProject.name) {
            return { ...t, projectId: targetProject.id, projectName: targetProject.name };
          }
          return t;
        })
      );
    }
  }, [targetProject]);

  const updateTaskField = (index: number, field: keyof TaskDraft, value: string) => {
    setTasksState((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const submitSingle = async (index: number) => {
    const t = tasksState[index];
    if (!t) return;
    const taskName = String(t.name || '').trim();
    if (!taskName) {
      setError(`Task #${index + 1} requires a name`);
      return;
    }
    const projectId = t.projectId || targetProject?.id || allProjects[0]?.id || '';
    const ownerId = t.ownerId || owners[0]?.id || '';
    if (!projectId) {
      setError(`Choose a project for "${taskName}"`);
      return;
    }
    if (!ownerId) {
      setError(`Choose an owner for "${taskName}"`);
      return;
    }

    setIndividualSubmitting(index);
    setError('');
    try {
      const res = await post<ApiTask>('/tasks', {
        projectId,
        ownerId,
        name: taskName,
        priority: t.priority || 'Medium',
        phase: t.phase || 'Planning',
        start: t.start || '',
        date: t.date || '',
        description: t.description || '',
      });
      setCreatedMap((prev) => ({ ...prev, [index]: res.id }));
      await onCreated(index, res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create task');
    } finally {
      setIndividualSubmitting(null);
    }
  };

  const submitAll = async () => {
    setBatchSubmitting(true);
    setError('');
    try {
      for (let i = 0; i < tasksState.length; i++) {
        if (createdMap[i]) continue;
        const t = tasksState[i];
        const taskName = String(t.name || '').trim();
        if (!taskName) continue;
        const projectId = t.projectId || targetProject?.id || allProjects[0]?.id || '';
        const ownerId = t.ownerId || owners[0]?.id || '';
        if (!projectId || !ownerId) continue;

        const res = await post<ApiTask>('/tasks', {
          projectId,
          ownerId,
          name: taskName,
          priority: t.priority || 'Medium',
          phase: t.phase || 'Planning',
          start: t.start || '',
          date: t.date || '',
          description: t.description || '',
        });
        setCreatedMap((prev) => ({ ...prev, [i]: res.id }));
        await onCreated(i, res.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error occurred during batch creation');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const createdCount = Object.keys(createdMap).length;
  const allCreated = createdCount === tasksState.length && tasksState.length > 0;

  return (
    <div className="task-draft-card border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 shadow-md">
      <div className="flex items-center justify-between pb-2 border-b border-purple-100 dark:border-purple-900/50">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 text-white shadow-xs">
            <Sparkles size={13} />
          </span>
          <span className="font-semibold text-xs text-purple-900 dark:text-purple-300">
            {tasksState.length > 1
              ? `Actionable Task Proposals (${tasksState.length} items)`
              : 'Actionable Task Proposal'}
          </span>
        </div>
        {createdCount > 0 && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={12} /> {createdCount} / {tasksState.length} created
          </span>
        )}
      </div>

      {isAuditor && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
          <ShieldAlert size={14} className="shrink-0" />
          <span>Auditor Mode (Read-Only) — Task creation restricted under ISO 27001 / BOT SoD.</span>
        </div>
      )}

      <div className="flex flex-col gap-2.5 mt-1">
        {tasksState.map((task, idx) => {
          const isCreated = Boolean(createdMap[idx]);
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={idx}
              className={`rounded-lg border transition-all text-xs ${
                isCreated
                  ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'
              }`}
            >
              <div
                className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/80 rounded-t-lg select-none"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold shrink-0 ${
                    isCreated ? 'bg-emerald-600 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  }`}>
                    {isCreated ? <Check size={11} /> : idx + 1}
                  </span>
                  <strong className={`truncate font-medium text-slate-800 dark:text-slate-200 ${isCreated ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {task.name || 'Untitled task'}
                  </strong>
                  {task.priority && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      task.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {task.priority}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCreated ? (
                    <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-0.5">
                      <Check size={13} /> Done
                    </span>
                  ) : (
                    !isAuditor && (
                      <button
                        type="button"
                        className="px-2 py-0.5 text-[11px] font-semibold rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        disabled={individualSubmitting === idx || batchSubmitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          submitSingle(idx);
                        }}
                      >
                        {individualSubmitting === idx ? '…' : 'Create'}
                      </button>
                    )
                  )}
                  <span className="text-slate-400 p-0.5">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 rounded-b-lg flex flex-col gap-2.5">
                  <div className="task-draft-field">
                    <label>Task Name</label>
                    <input
                      value={task.name || ''}
                      disabled={isCreated || isAuditor}
                      onChange={(e) => updateTaskField(idx, 'name', e.target.value)}
                      placeholder="Task name..."
                    />
                  </div>
                  <div className="task-draft-meta">
                    <div className="task-draft-field">
                      <label>Project</label>
                      <select
                        value={task.projectId || targetProject?.id || allProjects[0]?.id || ''}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'projectId', e.target.value)}
                      >
                        {allProjects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="task-draft-field">
                      <label>Owner</label>
                      <select
                        value={task.ownerId || owners[0]?.id || ''}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'ownerId', e.target.value)}
                      >
                        {owners.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="task-draft-field">
                      <label>Priority</label>
                      <select
                        value={task.priority || 'Medium'}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'priority', e.target.value)}
                      >
                        {['Low', 'Medium', 'High'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="task-draft-field">
                      <label>Phase</label>
                      <select
                        value={task.phase || 'Planning'}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'phase', e.target.value)}
                      >
                        {['Planning', 'Development', 'Testing', 'Launch', 'Audit'].map((ph) => (
                          <option key={ph} value={ph}>{ph}</option>
                        ))}
                      </select>
                    </div>
                    <div className="task-draft-field">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={task.date || ''}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'date', e.target.value)}
                      />
                    </div>
                  </div>
                  {task.description && (
                    <div className="task-draft-field">
                      <label>Notes / Checklist</label>
                      <div className="task-draft-desc text-[11px] leading-relaxed max-h-24">
                        {task.description}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="form-error text-xs flex items-center gap-1 mt-1" role="alert">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      <div className="task-draft-actions justify-between pt-1">
        {!isAuditor && !allCreated && (
          <button
            type="button"
            className="primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            onClick={submitAll}
            disabled={batchSubmitting || !!individualSubmitting}
          >
            <CheckCheck size={14} />
            <span>
              {batchSubmitting
                ? 'Creating Tasks…'
                : tasksState.length > 1
                ? `Create All (${tasksState.length - createdCount}) Tasks`
                : 'Create Task'}
            </span>
          </button>
        )}
        {allCreated && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check size={14} /> All tasks created on the board!
          </span>
        )}
        <button
          type="button"
          className="text-button text-xs ml-auto text-slate-500 hover:text-slate-800"
          onClick={onDismiss}
          disabled={batchSubmitting}
        >
          {allCreated ? 'Close' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
}

export default function CopilotPanel({
  open,
  onClose,
  initialPrompt,
  projects = [],
  owners = [],
  onTaskCreated,
  onProjectCreated,
  currentUser,
  onSaveArticle,
}: {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  projects?: { id: string; name: string }[];
  owners?: { id: string; name: string }[];
  onTaskCreated?: () => Promise<void> | void;
  onProjectCreated?: () => Promise<void> | void;
  currentUser?: Me | null;
  onSaveArticle?: (article: { name: string; body: string; category: string; format?: 'markdown' | 'html' }) => Promise<void> | void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savingArticleIndex, setSavingArticleIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Conversations History State
  const [conversations, setConversations] = useState<CopilotConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Resizing and full-screen state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ctm_copilot_panel_width');
      return saved ? Math.max(380, Math.min(window.innerWidth, parseInt(saved, 10))) : 480;
    } catch {
      return 480;
    }
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate panel width from viewport right edge
      const newWidth = Math.max(380, Math.min(window.innerWidth, window.innerWidth - e.clientX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    try {
      localStorage.setItem('ctm_copilot_panel_width', panelWidth.toString());
    } catch {
      // ignore
    }
  }, [panelWidth]);

  // Attachments State
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    for (const file of fileArray) {
      if (file.size > 15 * 1024 * 1024) {
        alert(`ไฟล์ "${file.name}" มีขนาดเกิน 15 MB ไม่สามารถอัปโหลดได้`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const isImg = file.type.startsWith('image/');
      const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

      const item: PendingAttachment = {
        id,
        file,
        previewUrl,
        uploading: true,
      };

      setPendingAttachments((prev) => [...prev, item]);

      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/copilot/upload', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Upload failed');
        }
        const uploaded: CopilotAttachment = await res.json();
        setPendingAttachments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, uploading: false, uploaded } : p))
        );
      } catch (err: any) {
        setPendingAttachments((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, uploading: false, error: err.message || 'Failed' } : p
          )
        );
      }
    }
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleUploadFiles(files);
    }
  };

  const fetchConversations = async () => {
    try {
      const list = await api<CopilotConversationSummary[]>('/copilot/conversations');
      setConversations(list);
      return list;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (open && enabled === null) {
      api<{ enabled: boolean }>('/copilot/status')
        .then((s) => setEnabled(s.enabled))
        .catch(() => setEnabled(false));
    }
    if (open) {
      fetchConversations().then((list) => {
        // If not actively on a conversation, load the latest one if available
        if (!activeConvId && list.length > 0 && messages.length === 0) {
          selectConversation(list[0].id);
        }
      });
    }
  }, [open, enabled]);

  useEffect(() => {
    if (initialPrompt && open) {
      setInput(initialPrompt);
    }
  }, [initialPrompt, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const selectConversation = async (convId: string) => {
    setLoadingHistory(true);
    try {
      const detail = await api<CopilotConversationDetail>(`/copilot/conversations/${convId}`);
      setActiveConvId(detail.id);
      const rawMsgs = Array.isArray(detail.messages) ? detail.messages : [];
      setMessages(rawMsgs);
      setPendingAttachments([]);
      setHistoryOpen(false);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
    setPendingAttachments([]);
    setHistoryOpen(false);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('ต้องการลบประวัติการสนทนานี้หรือไม่?')) return;
    try {
      await destroy(`/copilot/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const executeSend = async (questionText: string) => {
    const validAttachments = pendingAttachments
      .filter((p) => p.uploaded)
      .map((p) => p.uploaded!);

    const question =
      questionText.trim() ||
      (validAttachments.length > 0 ? 'ช่วยวิเคราะห์ไฟล์และรูปภาพที่แนบมานี้ให้หน่อยครับ' : '');
    if (!question || busy) return;

    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const newMsg: Msg = {
      role: 'user',
      content: question,
      attachments: validAttachments.length > 0 ? validAttachments : undefined,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setPendingAttachments([]);
    setBusy(true);

    try {
      const res = await post<CopilotResponse>('/copilot', {
        question,
        history,
        conversationId: activeConvId || undefined,
        attachments: validAttachments.length > 0 ? validAttachments : undefined,
      });

      const normalizedTasks = normalizeBatchDraftTasks(res.draftTasks, res.draftTask);
      const assistantMsg: Msg = {
        role: 'assistant',
        content: res.answer,
        draftProject: res.draftProject,
        draftArticles: res.draftArticles && res.draftArticles.length > 0 ? res.draftArticles : undefined,
        draftTasks: normalizedTasks.length > 0 ? normalizedTasks : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.conversationId && res.conversationId !== activeConvId) {
        setActiveConvId(res.conversationId);
      }
      fetchConversations();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const send = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeSend(input);
  };

  const copyReport = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore clipboard error in restricted iframe
    }
  };

  const handleSaveAsArticle = async (index: number, content: string) => {
    if (!onSaveArticle || currentUser?.role === 'auditor') return;
    setSavingArticleIndex(index);
    try {
      const title = extractReportTitle(content);
      await onSaveArticle({
        name: title,
        body: content,
        category: 'Guides',
      });
      setMessages((prev) =>
        prev.map((msg, idx) => (idx === index ? { ...msg, savedAsArticle: true } : msg))
      );
    } catch (e) {
      console.error('Failed to save article:', e);
    } finally {
      setSavingArticleIndex(null);
    }
  };

  if (!open) return null;

  const groupedHistory = groupConversationsByDate(conversations);

  return (
    <div className="copilot-scrim" onClick={onClose}>
      <aside
        className={`copilot-panel relative ${isDragging ? 'is-resizing' : ''} ${isMaximized ? 'is-maximized' : ''}`}
        style={{
          width: isMaximized ? '100vw' : `${panelWidth}px`,
          maxWidth: '100vw',
        }}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
          }
        }}
        aria-label="AI Copilot"
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-purple-600/15 backdrop-blur-xs border-2 border-dashed border-purple-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/80 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-3 shadow-md animate-bounce">
              <Upload size={28} />
            </div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">วางไฟล์ที่นี่เพื่อแนบไปกับข้อความ</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
              รองรับรูปภาพ, PDF, Excel (.xlsx), Word (.docx), PowerPoint (.pptx), Outlook (.msg/.eml), โค้ด และไฟล์ข้อความ (สูงสุด 15MB)
            </p>
          </div>
        )}
        {/* Left Drag-to-Resize Handle */}
        {!isMaximized && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            className={`absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-30 group flex items-center justify-center -translate-x-1 hover:bg-purple-500/30 transition-colors select-none ${
              isDragging ? 'bg-purple-600/60' : ''
            }`}
            title="คลิกลากเพื่อยืดหรือหดหน้าต่าง Copilot (Drag to resize)"
          >
            <div className="w-1 h-8 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-purple-500 group-active:bg-purple-600 transition-colors" />
          </div>
        )}

        <header className="copilot-head flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="brand-icon"><Sparkles size={18} /></span>
            <strong>Copilot</strong>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold">
              Agentic
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Chat Button */}
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-100/70 hover:bg-purple-200/80 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors"
              title="เริ่มการสนทนาใหม่"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* History Toggle Button */}
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                historyOpen
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
              title="ประวัติการสนทนาทั้งหมด"
            >
              <History size={13} />
              <span className="hidden sm:inline">History</span>
              {conversations.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  historyOpen ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 text-purple-800'
                }`}>
                  {conversations.length}
                </span>
              )}
            </button>

            {/* Maximize / Restore Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isMaximized ? 'ย่อกลับขนาดเดิม (Restore)' : 'ขยายเต็มจอ (Maximize)'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button aria-label="Close" className="text-button p-1" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Slide-out Conversations History Panel */}
        {historyOpen && (
          <div className="absolute inset-x-0 top-[53px] bottom-0 z-20 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-purple-600" />
                <strong className="text-sm text-slate-900 dark:text-slate-100">
                  Conversations History ({conversations.length})
                </strong>
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 shadow-2xs"
              >
                <Plus size={13} />
                <span>+ New Conversation</span>
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                <MessageSquare size={28} className="mx-auto text-slate-300 mb-2" />
                ยังไม่มีประวัติการสนทนา เริ่มคุยกับ AI เพื่อสร้างบันทึกแรกได้เลย
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {[
                  { label: 'วันนี้ (Today)', items: groupedHistory.today },
                  { label: 'เมื่อวาน (Yesterday)', items: groupedHistory.yesterday },
                  { label: 'ก่อนหน้านี้ (Earlier)', items: groupedHistory.earlier },
                ].map(
                  (group) =>
                    group.items.length > 0 && (
                      <div key={group.label} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
                          {group.label}
                        </span>
                        {group.items.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => selectConversation(c.id)}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all group ${
                              c.id === activeConvId
                                ? 'border-purple-300 bg-purple-50/80 dark:border-purple-800 dark:bg-purple-950/40 font-medium'
                                : 'border-slate-100 dark:border-slate-800 hover:border-purple-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <MessageSquare size={14} className="text-purple-600 shrink-0" />
                              <span className="truncate text-slate-800 dark:text-slate-200">
                                {c.title || 'Untitled conversation'}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({c.messageCount} ข้อความ)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteConversation(c.id, e)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-opacity"
                              title="ลบการสนทนานี้"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                )}
              </div>
            )}
          </div>
        )}

        <div className="copilot-body">
          {enabled === false && (
            <p className="empty">Copilot isn't configured yet. Ask an admin to set a Gemini API key.</p>
          )}

          {enabled !== false && messages.length === 0 && (
            <div className="p-3 my-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 mb-2">
                <Sparkles size={20} />
              </div>
              <h3 className="font-semibold text-sm text-purple-950 dark:text-purple-200 mb-1">
                Workspace AI Assistant
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                ถามข้อมูลโครงการ วิเคราะห์ความเสี่ยง สกัด Tasks จาก Runbook หรือสร้างรายงานผู้บริหารแบบอัตโนมัติ (บันทึกประวัติการคุยทุกเซสชัน)
              </p>
              <div className="flex flex-col gap-1.5 text-left">
                <span className="text-[10px] font-semibold tracking-wider text-purple-800 dark:text-purple-300 uppercase px-1">
                  คำสั่งยอดนิยม 1-Click:
                </span>
                {COPILOT_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={busy}
                    onClick={() => executeSend(action.prompt)}
                    className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-purple-200/80 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 text-slate-800 dark:text-slate-200 hover:bg-purple-50/50 transition-all text-left shadow-xs"
                  >
                    <span>{action.label}</span>
                    <span className="text-purple-500">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={'copilot-msg ' + m.role}>
              {m.role === 'assistant' ? (
                <div className="markdown-assistant-container">
                  <MarkdownViewer content={m.content} />

                  {isSubstantiveReport(m.content) && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-xs">
                      <button
                        type="button"
                        onClick={() => copyReport(i, m.content)}
                        className="flex items-center gap-1 text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 py-1 px-2 rounded hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                      >
                        {copiedIndex === i ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedIndex === i ? 'Copied!' : 'Copy Report'}</span>
                      </button>

                      {onSaveArticle && currentUser?.role !== 'auditor' && (
                        <button
                          type="button"
                          disabled={savingArticleIndex === i || m.savedAsArticle}
                          onClick={() => handleSaveAsArticle(i, m.content)}
                          className="flex items-center gap-1 text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 py-1 px-2 rounded hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors disabled:opacity-50"
                        >
                          {m.savedAsArticle ? (
                            <Check size={13} className="text-emerald-600" />
                          ) : (
                            <BookOpen size={13} />
                          )}
                          <span>
                            {savingArticleIndex === i
                              ? 'Saving…'
                              : m.savedAsArticle
                              ? 'Saved to Knowledge Hub'
                              : 'Save as Knowledge Article'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1">
                      {m.attachments.map((att, attIdx) => {
                        const cat = getFileCategory(att.originalName, att.mimeType);
                        const isImg = cat === 'image';
                        return (
                          <div
                            key={attIdx}
                            className="flex items-center gap-2 p-1.5 rounded-lg bg-white/95 dark:bg-slate-800/95 border border-purple-200 dark:border-purple-800 text-xs shadow-2xs max-w-full"
                          >
                            {isImg ? (
                              <a
                                href={`/api/copilot/attachments/${att.storedName}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700 hover:opacity-85"
                              >
                                <img
                                  src={`/api/copilot/attachments/${att.storedName}`}
                                  alt={att.originalName}
                                  className="w-12 h-12 object-cover"
                                />
                              </a>
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0">
                                <AttachmentIcon category={cat} size={18} />
                              </div>
                            )}
                            <div className="min-w-0 pr-1">
                              <a
                                href={`/api/copilot/attachments/${att.storedName}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[11.5px] truncate block text-slate-800 dark:text-slate-200 hover:underline max-w-[150px]"
                                title={att.originalName}
                              >
                                {att.originalName}
                              </a>
                              <span className="text-[10px] text-slate-400 block">
                                {formatFileSize(att.sizeBytes)}
                              </span>
                            </div>
                            <a
                              href={`/api/copilot/attachments/${att.storedName}`}
                              download={att.originalName}
                              className="p-1 text-slate-400 hover:text-purple-600 transition-colors shrink-0"
                              title="ดาวน์โหลดไฟล์"
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {m.content && <div>{m.content}</div>}
                </div>
              )}

              {/* Project Proposal Card */}
              {m.draftProject && !m.projectDismissed && (
                <ProjectDraftCard
                  draft={m.draftProject}
                  currentUser={currentUser}
                  createdProject={m.createdProject}
                  onCreated={async (newProj) => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) => {
                        if (mIdx !== i) return msg;
                        const updatedTasks = msg.draftTasks?.map((t) => {
                          if (!t.projectId || t.projectName === newProj.name) {
                            return { ...t, projectId: newProj.id, projectName: newProj.name };
                          }
                          return t;
                        });
                        return {
                          ...msg,
                          createdProject: newProj,
                          draftTasks: updatedTasks,
                        };
                      })
                    );
                    await onProjectCreated?.();
                  }}
                  onDismiss={() => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) => (mIdx === i ? { ...msg, projectDismissed: true } : msg))
                    );
                  }}
                />
              )}

              {/* Knowledge & Runbook Proposals Card */}
              {m.draftArticles && m.draftArticles.length > 0 && !m.articlesDismissed && (
                <BatchArticleDraftCard
                  drafts={m.draftArticles}
                  projects={projects}
                  targetProjectId={m.createdProject?.id}
                  currentUser={currentUser}
                  onCreated={async (idx, id) => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) =>
                        mIdx === i
                          ? { ...msg, createdArticleMap: { ...(msg.createdArticleMap || {}), [idx]: id } }
                          : msg
                      )
                    );
                    await onProjectCreated?.();
                  }}
                  onDismiss={() => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) => (mIdx === i ? { ...msg, articlesDismissed: true } : msg))
                    );
                  }}
                />
              )}

              {/* Task Proposals Card */}
              {m.draftTasks && m.draftTasks.length > 0 && !m.tasksDismissed && !m.dismissed && (
                <BatchTaskDraftCard
                  drafts={m.draftTasks}
                  projects={projects}
                  owners={owners}
                  currentUser={currentUser}
                  targetProject={m.createdProject}
                  onCreated={async (idx, id) => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) =>
                        mIdx === i
                          ? { ...msg, createdTaskMap: { ...(msg.createdTaskMap || {}), [idx]: id } }
                          : msg
                      )
                    );
                    await onTaskCreated?.();
                  }}
                  onDismiss={() => {
                    setMessages((prev) =>
                      prev.map((msg, mIdx) => (mIdx === i ? { ...msg, tasksDismissed: true, dismissed: true } : msg))
                    );
                  }}
                />
              )}
            </div>
          ))}

          {busy && <div className="copilot-msg assistant thinking">Thinking…</div>}
          <div ref={endRef} />
        </div>

        {enabled !== false && messages.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto border-t border-purple-100 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 text-[11px] no-scrollbar">
            {COPILOT_QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => executeSend(action.prompt)}
                className="shrink-0 px-2 py-1 rounded-full bg-white dark:bg-slate-800 border border-purple-200 hover:border-purple-400 text-slate-700 dark:text-slate-300 font-medium hover:bg-purple-50 transition-colors shadow-2xs"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Pending Attachments Strip */}
        {pendingAttachments.length > 0 && (
          <div className="px-4 py-2 border-t border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-slate-850 flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {pendingAttachments.map((p) => {
              const cat = getFileCategory(p.file.name, p.file.type);
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs shadow-2xs ${
                    p.error
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900'
                      : p.uploading
                      ? 'border-purple-200 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 animate-pulse'
                      : 'border-purple-200 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {p.previewUrl ? (
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      className="w-6 h-6 rounded object-cover shrink-0"
                    />
                  ) : (
                    <AttachmentIcon category={cat} size={15} />
                  )}
                  <div className="max-w-[140px] truncate min-w-0 font-medium text-[11.5px]" title={p.file.name}>
                    {p.file.name}
                  </div>
                  <span className="text-[10px] text-slate-400">({formatFileSize(p.file.size)})</span>
                  {p.uploading ? (
                    <Loader2 size={13} className="animate-spin text-purple-600 shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeAttachment(p.id)}
                      className="text-slate-400 hover:text-rose-600 ml-1 p-0.5 rounded transition-colors shrink-0"
                      title="ลบไฟล์แนบ"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form className="copilot-input items-end" onSubmit={send}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.msg,.eml,.txt,.json,.yaml,.yml,.csv,.log,.md,.ts,.js,.py,.sh,.sql"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            disabled={busy || enabled === false}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 shrink-0 mb-[1px]"
            title="แนบรูปภาพหรือเอกสาร (ภาพ, PDF, Excel, Word, PPT, Outlook MSG/EML, ข้อความ ฯลฯ)"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              pendingAttachments.length > 0
                ? 'พิมพ์คำสั่งพร้อมไฟล์แนบ (หรือกด Enter เพื่อส่งทันที)...'
                : 'ถามคำถาม, แนบไฟล์/ลากวาง/วางรูปภาพหน้าจอ (Ctrl+V)...'
            }
            rows={2}
            disabled={enabled === false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <button
            className="primary"
            type="submit"
            disabled={busy || enabled === false || pendingAttachments.some((p) => p.uploading)}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}
