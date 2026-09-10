import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Check } from 'lucide-react';
import { api, post } from '@/lib/api';
import type { ApiTask, TaskDraft } from '@/lib/types';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  draftTask?: TaskDraft;
  createdTaskId?: string;
  dismissed?: boolean;
};

function TaskDraftCard({
  draft,
  projects,
  owners,
  onCreated,
  onDismiss,
}: {
  draft: TaskDraft;
  projects: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  onCreated: (createdId: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(draft.name || '');
  const [projectId, setProjectId] = useState(draft.projectId || projects[0]?.id || '');
  const [ownerId, setOwnerId] = useState(draft.ownerId || owners[0]?.id || '');
  const [priority, setPriority] = useState(draft.priority || 'Medium');
  const [phase] = useState(draft.phase || 'Planning');
  const [date, setDate] = useState(draft.date || '');
  const [description] = useState(draft.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setError('Task name is required');
      return;
    }
    if (!projectId) {
      setError('Choose a project');
      return;
    }
    if (!ownerId) {
      setError('Choose an owner');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await post<ApiTask>('/tasks', {
        projectId,
        ownerId,
        name: name.trim(),
        priority,
        phase,
        date,
        description,
      });
      onCreated(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create task');
      setSubmitting(false);
    }
  };

  return (
    <div className="task-draft-card">
      <div className="task-draft-head">
        <Sparkles size={14} />
        <span>Actionable Task Proposal</span>
      </div>
      <div className="task-draft-field">
        <label>Task Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name..." />
      </div>
      <div className="task-draft-meta">
        <div className="task-draft-field">
          <label>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="task-draft-field">
          <label>Owner</label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="task-draft-field">
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['Low', 'Medium', 'High'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="task-draft-field">
          <label>Due Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {description && (
        <div className="task-draft-field">
          <label>Notes / Checklist</label>
          <div className="task-draft-desc">{description}</div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="task-draft-actions">
        <button type="button" className="primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Task'}
        </button>
        <button type="button" className="text-button" onClick={onDismiss} disabled={submitting}>
          Dismiss
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
}: {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  projects?: { id: string; name: string }[];
  owners?: { id: string; name: string }[];
  onTaskCreated?: () => Promise<void> | void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && enabled === null)
      api<{ enabled: boolean }>('/copilot/status').then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, [open, enabled]);

  useEffect(() => {
    if (initialPrompt && open) {
      setInput(initialPrompt);
    }
  }, [initialPrompt, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMessages([...messages, { role: 'user', content: question }]);
    setInput('');
    setBusy(true);
    try {
      const res = await post<{ answer: string; draftTask?: TaskDraft }>('/copilot', { question, history });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.answer,
          draftTask: res.draftTask,
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="copilot-scrim" onClick={onClose}>
      <aside className="copilot-panel" onClick={(e) => e.stopPropagation()} aria-label="AI Copilot">
        <header className="copilot-head">
          <span className="brand-icon"><Sparkles size={18} /></span>
          <strong>Copilot</strong>
          <button aria-label="Close" className="text-button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="copilot-body">
          {enabled === false && <p className="empty">Copilot isn't configured yet. Ask an admin to set a Gemini API key.</p>}
          {enabled !== false && messages.length === 0 && <p className="empty">Ask about your projects, tasks, team, resources or knowledge.</p>}
          {messages.map((m, i) => (
            <div key={i} className={'copilot-msg ' + m.role}>
              <div>{m.content}</div>
              {m.draftTask && !m.dismissed && (
                m.createdTaskId ? (
                  <div className="task-draft-success">
                    <Check size={15} />
                    <span>Task created successfully!</span>
                  </div>
                ) : (
                  <TaskDraftCard
                    draft={m.draftTask}
                    projects={projects}
                    owners={owners}
                    onCreated={async (id) => {
                      setMessages((prev) =>
                        prev.map((msg, idx) => (idx === i ? { ...msg, createdTaskId: id } : msg))
                      );
                      await onTaskCreated?.();
                    }}
                    onDismiss={() => {
                      setMessages((prev) =>
                        prev.map((msg, idx) => (idx === i ? { ...msg, dismissed: true } : msg))
                      );
                    }}
                  />
                )
              )}
            </div>
          ))}
          {busy && <div className="copilot-msg assistant thinking">Thinking…</div>}
          <div ref={endRef} />
        </div>
        <form className="copilot-input" onSubmit={send}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or request a task…"
            rows={2}
            disabled={enabled === false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <button className="primary" type="submit" disabled={busy || enabled === false} aria-label="Send"><Send size={16} /></button>
        </form>
      </aside>
    </div>
  );
}
