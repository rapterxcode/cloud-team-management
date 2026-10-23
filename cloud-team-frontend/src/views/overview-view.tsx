import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Cloud,
  FolderKanban,
  Users,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { Project, Task, User } from '@/lib/types';

export interface OverviewViewProps {
  projects: Project[];
  tasks: Task[];
  users: User[];
  members: readonly (readonly [string, string, string, number])[];
  totalMonthly: number;
  onNavigate: (view: string) => void;
  onOpenProject: (project: Project) => void;
  onSelectTask: (task: Task) => void;
  onFinishTask: (id: string) => void;
}

export function OverviewView({
  projects,
  tasks,
  users,
  members,
  totalMonthly,
  onNavigate,
  onOpenProject,
  onSelectTask,
  onFinishTask,
}: OverviewViewProps) {
  const activeProjectCount = projects.filter((p) => p.status !== 'Completed').length;
  const completedProjectCount = projects.filter((p) => p.status === 'Completed').length;
  const openTaskCount = tasks.filter((t) => t.status !== 'Done').length;
  const departmentCount = new Set(projects.map((p) => p.department)).size || 0;

  const stats = [
    [FolderKanban, 'Active projects', String(activeProjectCount), `Across ${departmentCount} teams`],
    [Users, 'Team members', String(users.length), 'On the roster'],
    [Check, 'Open tasks', String(openTaskCount), 'Keep the momentum going'],
    [Cloud, 'Monthly cloud spend', '$' + totalMonthly.toLocaleString(), 'From your inventory'],
  ] as const;

  return (
    <>
      <div className="welcome-strip">
        <span className="welcome-icon">
          <Activity size={20} />
        </span>
        <div>
          <strong>Good things are moving.</strong>
          <span>
            {' '}
            Your team is building across {projects.length} projects ({completedProjectCount} completed).
          </span>
        </div>
        <span className="week-pill">Week 37</span>
      </div>

      <div className="stats">
        {stats.map(([Icon, label, value, foot]) => (
          <section className="stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>
              <span className="green">↗</span> {foot}
            </small>
          </section>
        ))}
      </div>

      <div className="section-heading">
        <h2>
          Active projects <span>{activeProjectCount}</span>
        </h2>
        <button className="text-button" onClick={() => onNavigate('Projects')}>
          All projects <ArrowRight size={15} />
        </button>
      </div>

      <div className="project-grid">
        {projects.slice(0, 3).map((p) => (
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

      <div className="lower-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your priorities</h2>
              <p>A clear focus for the days ahead.</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('Tasks')}>
              View tasks <ArrowRight size={15} />
            </button>
          </div>
          {tasks.slice(0, 4).map((t) => (
            <div className="task-row" key={t.id} onClick={() => onSelectTask(t)}>
              <button
                className={'complete ' + (t.status === 'Done' ? 'done' : '')}
                disabled={t.status === 'Done'}
                aria-label={`Complete ${t.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFinishTask(t.id);
                }}
              >
                {t.status === 'Done' && <Check size={13} />}
              </button>
              <div>
                <strong className={t.status === 'Done' ? 'struck' : ''}>{t.name}</strong>
                <small>
                  {t.ownerName} <span>·</span> {t.due}
                </small>
              </div>
              <span className={'priority ' + (t.priority === 'High' ? 'high' : '')}>
                {t.priority}
              </span>
            </div>
          ))}
          {tasks.length === 0 && <p className="empty">No tasks yet.</p>}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Team workload</h2>
              <p>Room to do great work.</p>
            </div>
            <Users size={18} />
          </div>
          {members.slice(0, 6).map(([name, _role, initial, load], i) => (
            <div className="workload" key={name}>
              <span className={'avatar ' + ['', 'blue', 'pink', 'orange'][i % 4]}>
                {initial}
              </span>
              <div>
                <div>
                  <strong>{name}</strong>
                  <span>{load}%</span>
                </div>
                <Progress
                  value={load}
                  aria-label={`${name} workload`}
                  className={load > 85 ? 'busy' : ''}
                />
              </div>
            </div>
          ))}
          <button className="team-link" onClick={() => onNavigate('Team')}>
            Meet your team <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}
