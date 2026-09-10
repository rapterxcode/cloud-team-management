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
  onUpdate: (id: string, changes: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function TaskDrawer({
  task,
  open,
  onClose,
  projects,
  owners,
  onUpdate,
  onDelete,
}: TaskDrawerProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError('');
  }, [task, open]);

  if (!open || !task) return null;

  const currentProject = projects.find((p) => p.id === task.projectId);

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
                <NativeSelect name="phase" defaultValue={task.phase}>
                  {['Planning', 'Development', 'Launch'].map((p) => (
                    <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>
                  ))}
                </NativeSelect>
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
                <input type="date" name="start" defaultValue={task.start || ''} />
              </label>

              <label className="drawer-field">
                <span className="field-label">Finish date</span>
                <input type="date" name="date" defaultValue={task.date || ''} />
              </label>
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
