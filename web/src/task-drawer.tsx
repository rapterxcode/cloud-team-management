import { useState, useEffect } from 'react';
import { X, Check, Trash2, FolderKanban } from 'lucide-react';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Task, Project } from '@/lib/types';

interface TaskDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  projects: Project[];
  owners: { id: string; name: string }[];
  articles?: Array<{ id: string; name: string; category: string }>;
  projectDocuments?: Array<{ id: string; originalName: string; category: string; referenceNo: string; projectId: string }>;
  onUpdate: (id: string, changes: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPreviewDocument?: (docId: string) => void;
  onOpenArticle?: (articleId: string) => void;
}

export default function TaskDrawer({
  task,
  open,
  onClose,
  projects,
  owners,
  articles = [],
  projectDocuments = [],
  onUpdate,
  onDelete,
  onPreviewDocument,
  onOpenArticle,
}: TaskDrawerProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError('');
  }, [task, open]);

  if (!open || !task) return null;

  const currentProject = projects.find((p) => p.id === task.projectId);
  const availableChangeDocs = projectDocuments.filter(d => d.projectId === task.projectId && (d.category === 'CR' || d.category === 'CC'));

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = (data.get('name') as string || '').trim();
    if (!name) {
      setError('A name is required');
      return;
    }
    const description = (data.get('description') as string || '').trim();
    const ownerId = data.get('ownerId') as string;
    const phase = data.get('phase') as string;
    const status = data.get('status') as string;
    const priority = data.get('priority') as string;
    const start = data.get('start') as string;
    const date = data.get('date') as string;
    const changeDocumentId = data.get('changeDocumentId') as string;
    const sopArticleId = data.get('sopArticleId') as string;

    setSaving(true);
    setError('');
    try {
      await onUpdate(task.id, {
        name,
        description,
        ownerId,
        phase,
        status,
        priority,
        start,
        date,
        changeDocumentId: changeDocumentId || null,
        sopArticleId: sopArticleId || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save task');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    try {
      await onUpdate(task.id, { status: 'Done' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    setSaving(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-drawer-scrim" onClick={onClose}>
      <aside className="task-drawer-panel" onClick={(e) => e.stopPropagation()} aria-label="Task Details">
        <header className="task-drawer-head">
          <span className={'project-icon ' + (currentProject?.color || 'purple')}><FolderKanban size={18} /></span>
          <div className="task-drawer-title-box">
            <span className="badge">{currentProject?.name || 'Project'}</span>
            <span className={'badge ' + (task.status === 'Done' ? 'green-badge' : task.status === 'In progress' ? 'blue-badge' : '')}>
              {task.status}
            </span>
          </div>
          <button aria-label="Close" className="text-button" onClick={onClose}><X size={18} /></button>
        </header>

        <form className="task-drawer-form" onSubmit={handleSubmit}>
          <div className="task-drawer-body">
            {error && <p className="form-error" role="alert">{error}</p>}

            <label className="drawer-field">
              <span className="field-label">Task Name</span>
              <input name="name" required maxLength={100} defaultValue={task.name} placeholder="e.g. Audit security group rules" />
            </label>

            <div className="drawer-grid">
              <label className="drawer-field">
                <span className="field-label">Owner</span>
                <NativeSelect name="ownerId" defaultValue={task.ownerId} required>
                  {owners.map((o) => (
                    <NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              <label className="drawer-field">
                <span className="field-label">Status</span>
                <NativeSelect name="status" defaultValue={task.status}>
                  {['To do', 'In progress', 'Done'].map((s) => (
                    <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              <label className="drawer-field">
                <span className="field-label">Phase</span>
                <input
                  name="phase"
                  list="task-drawer-phases"
                  defaultValue={task.phase}
                  placeholder="e.g. Planning, Testing, Audit"
                />
                <datalist id="task-drawer-phases">
                  {['Planning', 'Development', 'Testing', 'Launch', 'Audit'].map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>

              <label className="drawer-field">
                <span className="field-label">Priority</span>
                <NativeSelect name="priority" defaultValue={task.priority}>
                  {['Low', 'Medium', 'High'].map((p) => (
                    <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              <label className="drawer-field">
                <span className="field-label">Start date</span>
                <input
                  type="date"
                  name="start"
                  defaultValue={(task.start || '').slice(0, 10)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              </label>

              <label className="drawer-field">
                <span className="field-label">Finish date</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={(task.date || '').slice(0, 10)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
              </label>
            </div>

            <div className="drawer-field">
              <span className="field-label">Change Authorization (ISO 27001 / BOT)</span>
              <NativeSelect name="changeDocumentId" defaultValue={task.changeDocumentId || ''}>
                <NativeSelectOption value="">None (Unlinked)</NativeSelectOption>
                {availableChangeDocs.map(doc => (
                  <NativeSelectOption key={doc.id} value={doc.id}>
                    {doc.referenceNo ? `${doc.referenceNo} - ` : ''}{doc.originalName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {task.changeDocument && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge green-badge">Authorized: {task.changeDocument.referenceNo || task.changeDocument.originalName}</span>
                  <button type="button" className="text-button" onClick={() => onPreviewDocument?.(task.changeDocument!.id)} style={{ padding: '2px 6px', fontSize: '12px' }}>
                    View Document
                  </button>
                </div>
              )}
            </div>

            <div className="drawer-field">
              <span className="field-label">Standard Operating Procedure (SOP / Runbook)</span>
              <NativeSelect name="sopArticleId" defaultValue={task.sopArticleId || ''}>
                <NativeSelectOption value="">None (No SOP)</NativeSelectOption>
                {articles.map(art => (
                  <NativeSelectOption key={art.id} value={art.id}>
                    {art.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {task.sopArticle && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge blue-badge">SOP: {task.sopArticle.name}</span>
                  <button type="button" className="text-button" onClick={() => onOpenArticle?.(task.sopArticle!.id)} style={{ padding: '2px 6px', fontSize: '12px' }}>
                    Read Runbook
                  </button>
                </div>
              )}
            </div>

            <label className="drawer-field">
              <span className="field-label">Notes & Description</span>
              <textarea
                name="description"
                className="task-description-editor"
                maxLength={10000}
                defaultValue={task.description || ''}
                placeholder="Add detailed runbooks, checklists, commands or notes for this task..."
                rows={7}
              />
            </label>
          </div>

          <footer className="task-drawer-footer">
            <button type="button" className="text-button text-destructive" onClick={handleDelete} disabled={saving} aria-label="Delete task">
              <Trash2 size={15} /> Delete
            </button>
            {task.status !== 'Done' && (
              <button type="button" className="text-button" onClick={handleComplete} disabled={saving}>
                <Check size={15} /> Complete
              </button>
            )}
            <button className="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
