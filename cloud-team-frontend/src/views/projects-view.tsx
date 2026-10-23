import { Suspense, lazy } from 'react';
import { Clock, FolderKanban, Pencil, Plus, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Me, Project, Task, User } from '@/lib/types';

const ProjectGantt = lazy(() => import('../project-gantt'));
const ProjectDocuments = lazy(() => import('../project-documents'));

export interface ProjectsViewProps {
  visibleProjects: Project[];
  query: string;
  filter: string;
  yearFilter: string;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: string) => void;
  onYearFilterChange: (y: string) => void;
  onOpenProject: (project: Project) => void;
}

export function ProjectsView({
  visibleProjects,
  query,
  filter,
  yearFilter,
  onQueryChange,
  onFilterChange,
  onYearFilterChange,
  onOpenProject,
}: ProjectsViewProps) {
  return (
    <>
      <div className="toolbar flex flex-col md:flex-row gap-3">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search projects"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search projects…"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="filter-buttons">
            {['All Years', '2025', '2026', '2027'].map((y) => {
              const val = y === 'All Years' ? 'All' : y;
              return (
                <button
                  className={yearFilter === val ? 'selected' : ''}
                  onClick={() => onYearFilterChange(val)}
                  key={y}
                >
                  {y}
                </button>
              );
            })}
          </div>
          <div className="filter-buttons">
            {['All', 'Active', 'New', 'On track', 'At risk', 'Completed'].map((s) => (
              <button
                className={filter === s ? 'selected' : ''}
                onClick={() => onFilterChange(s)}
                key={s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="project-grid">
        {visibleProjects.map((p) => (
          <button
            className="project-card"
            key={p.id}
            onClick={() => onOpenProject(p)}
          >
            <div className="card-top">
              <span className={'project-icon ' + p.color}>
                <FolderKanban size={21} />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="badge year-badge">FY{p.year || 2026}</span>
                <span
                  className={
                    'badge ' +
                    (p.status === 'Completed'
                      ? 'completed-badge'
                      : p.status === 'New'
                        ? 'blue-badge'
                        : p.status === 'At risk'
                          ? 'amber'
                          : 'green-badge')
                  }
                >
                  {p.status === 'Completed' ? '✓ Completed' : '• ' + p.status}
                </span>
              </div>
            </div>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <div className="progress-label">
              <span>Progress</span>
              <strong>{p.progress}%</strong>
            </div>
            <Progress value={p.progress} aria-label={`${p.name} progress`} />
            <div className="project-footer">
              <span className="badge">{p.department}</span>
              <span>
                <Clock size={13} /> {p.due}
              </span>
            </div>
          </button>
        ))}
      </div>
      {visibleProjects.length === 0 && (
        <p className="empty">No projects match your search.</p>
      )}
    </>
  );
}

export interface ProjectWorkspaceViewProps {
  detail: Project;
  selectedTasks: Task[];
  allTasks: Task[];
  activeUsers: User[];
  currentUser: Me;
  projectTab: 'tasks' | 'documents';
  onTabChange: (tab: 'tasks' | 'documents') => void;
  onBack: () => void;
  onAddTask: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTask: (id: string, changes: Record<string, unknown>) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onErrorNotice: (msg: string) => void;
}

export function ProjectWorkspaceView({
  detail,
  selectedTasks,
  allTasks,
  activeUsers,
  currentUser,
  projectTab,
  onTabChange,
  onBack,
  onAddTask,
  onEditProject,
  onDeleteProject,
  onSelectTask,
  onUpdateTask,
  onDeleteTask,
  onErrorNotice,
}: ProjectWorkspaceViewProps) {
  return (
    <>
      <button className="text-button back-link" onClick={onBack}>
        ← All projects
      </button>
      <div className="project-summary">
        <span className={'project-icon ' + detail.color}>
          <FolderKanban size={23} />
        </span>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2>{detail.name}</h2>
            <span className="badge year-badge">FY{detail.year || 2026}</span>
            <span className="badge">{detail.department}</span>
          </div>
          <p>{detail.description}</p>
        </div>
        <span
          className={
            'badge ' +
            (detail.status === 'Completed'
              ? 'completed-badge'
              : detail.status === 'New'
                ? 'blue-badge'
                : detail.status === 'At risk'
                  ? 'amber'
                  : 'green-badge')
          }
        >
          {detail.status === 'Completed' ? '✓ Completed' : detail.status}
        </span>
        <div className="project-completion">
          <strong>
            {selectedTasks.filter((t) => t.status === 'Done').length} /{' '}
            {selectedTasks.length}
          </strong>
          <span>tasks complete</span>
        </div>
      </div>

      <div className="task-controls">
        {currentUser.role !== 'auditor' && (
          <>
            <button className="primary" onClick={onAddTask}>
              <Plus size={15} /> Add task
            </button>
            <button
              className="text-button"
              onClick={() => onEditProject(detail)}
            >
              <Pencil size={14} /> Edit project
            </button>
            <button
              className="text-button"
              onClick={() => onDeleteProject(detail.id)}
            >
              Delete project
            </button>
          </>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 mb-4 pb-1">
        <button
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            projectTab === 'tasks'
              ? 'bg-slate-200 dark:bg-slate-700 font-semibold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
          onClick={() => onTabChange('tasks')}
        >
          Tasks & Timeline
        </button>
        <button
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            projectTab === 'documents'
              ? 'bg-slate-200 dark:bg-slate-700 font-semibold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
          }`}
          onClick={() => onTabChange('documents')}
        >
          Audit Documents (ISO/BOT)
        </button>
      </div>

      <Suspense fallback={<div className="panel">Loading workspace view…</div>}>
        {projectTab === 'tasks' ? (
          <ProjectGantt
            readOnly={currentUser.role === 'auditor'}
            tasks={selectedTasks.map((t) => ({ ...t, owner: t.ownerName }))}
            owners={activeUsers.map((u) => ({ id: u.id, name: u.name }))}
            onSelect={(t) => {
              const found = allTasks.find((x) => x.id === t.id);
              if (found) onSelectTask(found);
            }}
            onAdd={() => {
              if (currentUser.role === 'auditor') return;
              onAddTask();
            }}
            onUpdate={(id, changes) => {
              if (currentUser.role === 'auditor') return;
              onUpdateTask(id, changes).catch((e) =>
                onErrorNotice(
                  e instanceof Error ? e.message : 'Could not update task.'
                )
              );
            }}
            onDelete={(id) => {
              if (currentUser.role === 'auditor') return;
              onDeleteTask(id);
            }}
          />
        ) : (
          <ProjectDocuments projectId={detail.id} currentUser={currentUser} />
        )}
      </Suspense>
    </>
  );
}
