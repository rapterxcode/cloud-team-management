import { Check, Search } from 'lucide-react';
import type { Task } from '@/lib/types';

export interface TasksKanbanViewProps {
  visibleTasks: Task[];
  query: string;
  filter: string;
  readOnly?: boolean;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: string) => void;
  onSelectTask: (task: Task) => void;
  onFinishTask: (taskId: string) => void;
}

export function TasksKanbanView({
  visibleTasks,
  query,
  filter,
  readOnly = false,
  onQueryChange,
  onFilterChange,
  onSelectTask,
  onFinishTask,
}: TasksKanbanViewProps) {
  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Search tasks…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>
        <div className="filter-buttons">
          {['All', 'To do', 'In progress', 'Done'].map((s) => (
            <button
              key={s}
              className={filter === s ? 'selected' : ''}
              onClick={() => onFilterChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="kanban">
        {(['To do', 'In progress', 'Done'] as const).map((status) => {
          const columnTasks = visibleTasks.filter((t) => t.status === status);
          return (
            <section className="kanban-column" key={status}>
              <h2>
                {status}
                <span>{columnTasks.length}</span>
              </h2>
              {columnTasks.map((t) => (
                <article
                  className="task-card"
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                >
                  <span
                    className={'priority ' + (t.priority === 'High' ? 'high' : '')}
                  >
                    {t.priority}
                  </span>
                  <h3>{t.name}</h3>
                  <p>{t.ownerName}</p>
                  <div>
                    <span>{t.due}</span>
                    {status !== 'Done' && !readOnly && (
                      <button
                        className="text-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFinishTask(t.id);
                        }}
                      >
                        <Check size={14} /> Complete
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {columnTasks.length === 0 && <p className="empty">No tasks here.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
