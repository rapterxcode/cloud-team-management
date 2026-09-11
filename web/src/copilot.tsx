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
} from 'lucide-react';
import { api, post, destroy } from '@/lib/api';
import type {
  ApiTask,
  TaskDraft,
  Me,
  CopilotResponse,
  CopilotConversationSummary,
  CopilotConversationDetail,
} from '@/lib/types';
import MarkdownViewer from './markdown-viewer';
import {
  COPILOT_QUICK_ACTIONS,
  normalizeBatchDraftTasks,
  extractReportTitle,
  isSubstantiveReport,
  groupConversationsByDate,
} from '@/lib/copilot-helpers.mjs';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  draftTasks?: TaskDraft[];
  draftTask?: TaskDraft;
  createdTaskMap?: Record<number, string>;
  dismissed?: boolean;
  savedAsArticle?: boolean;
};

function BatchTaskDraftCard({
  drafts,
  projects,
  owners,
  currentUser,
  onCreated,
  onDismiss,
}: {
  drafts: TaskDraft[];
  projects: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  currentUser?: Me | null;
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
    const projectId = t.projectId || projects[0]?.id || '';
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
        const projectId = t.projectId || projects[0]?.id || '';
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
                        value={task.projectId || projects[0]?.id || ''}
                        disabled={isCreated || isAuditor}
                        onChange={(e) => updateTaskField(idx, 'projectId', e.target.value)}
                      >
                        {projects.map((p) => (
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
  currentUser,
  onSaveArticle,
}: {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  projects?: { id: string; name: string }[];
  owners?: { id: string; name: string }[];
  onTaskCreated?: () => Promise<void> | void;
  currentUser?: Me | null;
  onSaveArticle?: (article: { name: string; body: string; category: string }) => Promise<void> | void;
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
    const question = questionText.trim();
    if (!question || busy) return;
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const newMsg: Msg = { role: 'user', content: question };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setBusy(true);

    try {
      const res = await post<CopilotResponse>('/copilot', {
        question,
        history,
        conversationId: activeConvId || undefined,
      });

      const normalizedTasks = normalizeBatchDraftTasks(res.draftTasks, res.draftTask);
      const assistantMsg: Msg = {
        role: 'assistant',
        content: res.answer,
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
      <aside className="copilot-panel relative" onClick={(e) => e.stopPropagation()} aria-label="AI Copilot">
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
                <div>{m.content}</div>
              )}

              {m.draftTasks && m.draftTasks.length > 0 && !m.dismissed && (
                <BatchTaskDraftCard
                  drafts={m.draftTasks}
                  projects={projects}
                  owners={owners}
                  currentUser={currentUser}
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
                      prev.map((msg, mIdx) => (mIdx === i ? { ...msg, dismissed: true } : msg))
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

        <form className="copilot-input" onSubmit={send}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask questions, request reports, or extract tasks…"
            rows={2}
            disabled={enabled === false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <button className="primary" type="submit" disabled={busy || enabled === false} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}
