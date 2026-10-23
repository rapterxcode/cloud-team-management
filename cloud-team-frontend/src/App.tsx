import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  BookOpen,
  ChartNoAxesCombined,
  Cloud,
  FolderKanban,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  computeWorkload,
  filterItems,
  projectTasks,
} from '@/lib/workspace.mjs';
import { api, destroy, patch, post } from '@/lib/api';
import {
  withDue,
  type ApiTask,
  type Article,
  type KnowledgeCategory,
  type Me,
  type Project,
  type Resource,
  type Task,
  type User,
  type Workspace,
} from '@/lib/types';
import { filterArticles } from '@/lib/search.mjs';
import Login from './login';
import WorkspaceSwitcher from './workspace-switcher';
import { OverviewView } from './views/overview-view';
import { ProjectsView, ProjectWorkspaceView } from './views/projects-view';
import { TasksKanbanView } from './views/tasks-kanban-view';
import { TeamView } from './views/team-view';
import { CloudResourcesView } from './views/cloud-resources-view';
import { ReportsView } from './views/reports-view';
import { KnowledgeView } from './views/knowledge-view';
import { EntityFormDialog } from './views/entity-form-dialog';

const AdminPanel = lazy(() => import('./admin'));
const CopilotPanel = lazy(() => import('./copilot'));
const TaskDrawer = lazy(() => import('./task-drawer'));
const ComplianceMatrix = lazy(() =>
  import('./compliance-matrix').then((m) => ({ default: m.ComplianceMatrix }))
);
const ArticleReaderDialog = lazy(() => import('./article-reader-dialog'));
const CategoryManagerDialog = lazy(() => import('./category-manager-dialog'));
const ArticleEditorDialog = lazy(() => import('./article-editor-dialog'));
const UserProfileDialog = lazy(() => import('./user-profile-dialog'));
const LogsViewer = lazy(() => import('./logs-viewer'));

const nav = [
  ['Overview', LayoutDashboard],
  ['Projects', FolderKanban],
  ['Tasks', ListTodo],
  ['Knowledge', BookOpen],
  ['Compliance and Governance', ShieldCheck],
  ['Team', Users],
  ['Cloud resources', Server],
  ['Reports', ChartNoAxesCombined],
] as const;

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const VIEW_DESCRIPTIONS: Record<string, string> = {
  Overview: 'A little clarity for everything your team is building.',
  Projects: 'Keep every initiative moving in the right direction.',
  Tasks: 'Turn today’s priorities into progress.',
  Team: 'The people behind your cloud.',
  Knowledge: 'Shared knowledge. Fewer repeat questions.',
  'Project workspace':
    'Tasks, owners and the timeline — together in one place.',
  'Compliance and Governance':
    'Central oversight of ISO 27001 & Bank of Thailand (BOT) audit readiness and IT governance.',
  Reports: 'A closer look at your team and infrastructure.',
  'Cloud resources':
    'Multi-cloud infrastructure asset inventory and FinOps governance.',
  Admin: 'Manage who can access this workspace.',
  'Logs & Audit':
    'Inspect immutable transaction audit trail, authentication attempts, and regulatory compliance logs.',
};

export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const [view, setView] = useState('Overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [modal, setModal] = useState('');
  const [detail, setDetail] = useState<Project | null>(null);
  const [notice, setNotice] = useState('');

  const [projectTab, setProjectTab] = useState<'tasks' | 'documents'>('tasks');
  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [formError, setFormError] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [knowledge, setKnowledge] = useState<Article[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [articleEditorOpen, setArticleEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  const [resourceRows, setResourceRows] = useState<Resource[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const loadAll = async (wsId?: string) => {
    const targetWsId = wsId !== undefined ? wsId : activeWorkspace?.id || '';
    const wsParam = targetWsId
      ? `?workspaceId=${encodeURIComponent(targetWsId)}`
      : '';
    const [p, t, k, r, u, docs, cats, wsList] = await Promise.all([
      api<Project[]>(`/projects${wsParam}`),
      api<ApiTask[]>(`/tasks${wsParam}`),
      api<Article[]>(`/knowledge${wsParam}`),
      api<Resource[]>('/resources'),
      api<User[]>('/users'),
      api<any[]>('/project-documents').catch(() => []),
      api<KnowledgeCategory[]>('/knowledge/categories').catch(() => []),
      api<Workspace[]>('/workspaces').catch(() => []),
    ]);
    setProjects(p);
    setTasks(t.map(withDue));
    setKnowledge(k);
    setResourceRows(r);
    setUsers(u);
    setProjectDocuments(docs);
    setCategories(cats);
    if (wsList.length > 0) {
      setWorkspaces(wsList);
      if (!activeWorkspace && !wsId) {
        setActiveWorkspace(wsList[0]);
      }
    }
  };

  useEffect(() => {
    api<Me>('/auth/me')
      .then((m) => {
        setMe(m);
        return loadAll();
      })
      .catch(() => setMe(null));
  }, []);

  const navigate = (name: string) => {
    setView(name);
    setQuery('');
    setFilter('All');
    setYearFilter('All');
  };

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal }
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'navigate_workspace',
            description:
              'Open a Cloud Team workspace view. Does not create or change records.',
            inputSchema: {
              type: 'object',
              properties: {
                view: { type: 'string', enum: nav.map(([name]) => name) },
              },
              required: ['view'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                !('view' in input) ||
                !nav.some(
                  ([name]) => name === (input as { view: unknown }).view
                )
              ) {
                throw new Error('Choose a supported workspace view');
              }
              const target = (input as { view: string }).view;
              setView(target);
              setQuery('');
              setFilter('All');
              return { requestedView: target };
            },
          },
          { signal: lifecycle.signal }
        )
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  const create = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = ((data.get('name') as string) || '').trim();
    if (!name) return;

    try {
      if (modal === 'project') {
        const year = Number(data.get('year')) || 2026;
        const status =
          (data.get('status') as string) ||
          (editingProject ? editingProject.status : 'New');
        if (editingProject) {
          const body = {
            name,
            description: data.get('description') as string,
            status,
            year,
            progress: Number(data.get('progress')),
            department: data.get('department') as string,
            due: data.get('due') as string,
          };
          const p = await patch<Project>(`/projects/${editingProject.id}`, body);
          setProjects(projects.map((x) => (x.id === p.id ? p : x)));
          if (detail?.id === p.id) setDetail(p);
          setEditingProject(null);
        } else {
          const p = await post<Project>('/projects', {
            name,
            description:
              (data.get('description') as string) || 'Ready to get started.',
            year,
            status,
            due: (data.get('due') as string) || undefined,
            workspaceId: activeWorkspace?.id,
          });
          setProjects([...projects, p]);
        }
      } else if (modal === 'resource') {
        const body = {
          name,
          provider: data.get('provider') as string,
          type: data.get('type') as string,
          status: data.get('status') as string,
          monthlyCost: Number(data.get('monthlyCost')),
        };
        if (editingResource) {
          const r = await patch<Resource>(
            `/resources/${editingResource.id}`,
            body
          );
          setResourceRows(resourceRows.map((x) => (x.id === r.id ? r : x)));
        } else {
          const r = await post<Resource>('/resources', body);
          setResourceRows([...resourceRows, r]);
        }
        setEditingResource(null);
      } else {
        const t = await post<ApiTask>('/tasks', {
          name,
          description: (data.get('description') as string) || '',
          projectId: data.get('projectId') as string,
          ownerId: data.get('ownerId') as string,
          phase: data.get('phase') as string,
          start: data.get('start') as string,
          date: data.get('date') as string,
        });
        setTasks([...tasks, withDue(t)]);
      }
      setNotice('Saved.');
      setModal('');
      setFormError('');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const finishTask = async (id: string) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'Done' } : t))
      );
      if (selectedTask?.id === id) {
        setSelectedTask((prev) => (prev ? { ...prev, status: 'Done' } : null));
      }
      const t = await patch<ApiTask>(`/tasks/${id}`, { status: 'Done' });
      setTasks((prev) => prev.map((x) => (x.id === id ? withDue(t) : x)));
      if (selectedTask?.id === id) setSelectedTask(withDue(t));
    } catch (e) {
      await loadAll();
      setNotice(e instanceof Error ? e.message : 'Could not update task.');
    }
  };

  const editTask = async (id: string, changes: Record<string, unknown>) => {
    const updatedOwner = changes.ownerId
      ? users.find((u) => u.id === changes.ownerId)
      : undefined;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...changes,
          start:
            changes.start !== undefined ? (changes.start as string) : t.start,
          date: changes.date !== undefined ? (changes.date as string) : t.date,
          due:
            changes.date !== undefined
              ? (changes.date as string) || 'Not set'
              : t.due,
          ownerName: updatedOwner ? updatedOwner.name : t.ownerName,
        };
      })
    );
    if (selectedTask?.id === id) {
      setSelectedTask((prev) =>
        prev
          ? {
              ...prev,
              ...changes,
              start:
                changes.start !== undefined
                  ? (changes.start as string)
                  : prev.start,
              date:
                changes.date !== undefined
                  ? (changes.date as string)
                  : prev.date,
              due:
                changes.date !== undefined
                  ? (changes.date as string) || 'Not set'
                  : prev.due,
              ownerName: updatedOwner ? updatedOwner.name : prev.ownerName,
            }
          : null
      );
    }
    try {
      const t = await patch<ApiTask>(`/tasks/${id}`, changes);
      setTasks((prev) => prev.map((x) => (x.id === id ? withDue(t) : x)));
      if (selectedTask?.id === id) {
        setSelectedTask(withDue(t));
      }
    } catch (e) {
      await loadAll();
      throw e;
    }
  };

  const removeTask = async (id: string) => {
    try {
      await destroy(`/tasks/${id}`);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete task.');
    }
  };

  const removeProject = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await destroy(`/projects/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
      setTasks(tasks.filter((t) => t.projectId !== id));
      navigate('Projects');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete project.');
    }
  };

  const removeResource = async (id: string) => {
    if (!confirm('Delete this resource?')) return;
    try {
      await destroy(`/resources/${id}`);
      setResourceRows(resourceRows.filter((r) => r.id !== id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete resource.');
    }
  };

  const removeArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    try {
      await destroy(`/knowledge/${id}`);
      setKnowledge(knowledge.filter((k) => k.id !== id));
      setArticle(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete article.');
    }
  };

  const logout = async () => {
    await post('/auth/logout', {});
    setMe(null);
  };

  if (me === undefined) return <div className="app-loading">Loading…</div>;
  if (me === null) {
    return (
      <Login
        onLogin={(m) => {
          setMe(m);
          loadAll();
        }}
      />
    );
  }

  const members = users.map(
    (u) =>
      [u.name, u.title, initials(u.name), computeWorkload(tasks, u.id)] as const
  );
  const activeUsers = users.filter((u) => u.isActive);
  const navItems =
    me.role === 'admin'
      ? [...nav, ['Admin', Shield] as const, ['Logs & Audit', History] as const]
      : me.role === 'auditor'
        ? [...nav, ['Logs & Audit', History] as const]
        : nav;
  const selectedTasks = detail
    ? (projectTasks(tasks, detail.id) as Task[])
    : [];
  const visibleKnowledge = filterArticles(knowledge, query, filter) as Article[];
  const visibleProjects = filterItems(
    projects,
    query,
    filter,
    yearFilter
  ) as Project[];
  const visibleTasks = filterItems(tasks, query, filter) as Task[];
  const totalMonthly = resourceRows.reduce((sum, r) => sum + r.monthlyCost, 0);
  const spendByProvider = Object.entries(
    resourceRows.reduce<Record<string, number>>((acc, r) => {
      acc[r.provider] = (acc[r.provider] || 0) + r.monthlyCost;
      return acc;
    }, {})
  );

  const openCreate = () => {
    if (view === 'Knowledge') {
      setEditingArticle(null);
      setArticleEditorOpen(true);
      return;
    }
    setEditingProject(null);
    setEditingResource(null);
    setFormError('');
    if (view === 'Cloud resources') {
      setModal('resource');
    } else if (view === 'Tasks' || view === 'Project workspace') {
      setModal('task');
    } else {
      setModal('project');
    }
  };

  const pageTitle =
    view === 'Overview'
      ? 'Team overview'
      : view === 'Project workspace'
        ? detail?.name
        : view === 'Knowledge'
          ? 'Knowledge hub'
          : view === 'Compliance and Governance'
            ? 'Compliance and Governance'
            : view === 'Logs & Audit'
              ? 'Audit & Access Logs'
              : view;

  const createButtonLabel =
    view === 'Knowledge'
      ? 'New article'
      : view === 'Cloud resources'
        ? 'Add resource'
        : view === 'Tasks' || view === 'Project workspace'
          ? 'Create task'
          : 'Create project';

  return (
    <SidebarProvider>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <div className="brand">
            <span className="brand-icon">
              <Cloud size={25} />
            </span>{' '}
            cloudteam<span className="brand-dot">.</span>
          </div>
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelect={(ws) => {
              setActiveWorkspace(ws);
              loadAll(ws.id);
            }}
            onWorkspaceCreated={(ws) => {
              setWorkspaces((prev) => [...prev, ws]);
              setActiveWorkspace(ws);
              loadAll(ws.id);
            }}
            currentUser={me}
          />
        </SidebarHeader>

        <SidebarContent>
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {navItems.map(([name, Icon]) => (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton
                  isActive={
                    view === name ||
                    (name === 'Projects' && view === 'Project workspace')
                  }
                  onClick={() => navigate(name)}
                  className="nav-button"
                >
                  <Icon />
                  <span>{name}</span>
                  {name === 'Tasks' && (
                    <span className="nav-count">
                      {tasks.filter((t) => t.status !== 'Done').length}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <span className="status-dot" /> All systems operational
            <small>Sample infrastructure status</small>
          </div>
        </SidebarContent>

        <SidebarFooter>
          <div
            className="profile cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setProfileDialogOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to manage account & security"
          >
            <span className="avatar">{initials(me.name)}</span>
            <div className="flex-1 min-w-0">
              <strong className="truncate block">{me.name}</strong>
              <small className="truncate block">
                {me.role === 'admin'
                  ? 'Workspace admin'
                  : me.role === 'auditor'
                    ? 'Compliance auditor'
                    : 'Team member'}
              </small>
            </div>
            <button
              className="text-button"
              aria-label="Log out"
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span>Workspace</span>
            <span>/</span>
            <strong>{view}</strong>
          </div>
          <button
            className="copilot-open"
            onClick={() => setCopilotOpen(true)}
          >
            <Sparkles size={16} /> Ask Copilot
          </button>
        </header>

        <div className="content">
          {me.role === 'auditor' && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-4 py-2.5 rounded-lg flex items-center gap-2 mb-4 text-xs font-medium">
              <ShieldAlert size={16} />
              <span>
                🛡️ Compliance Inspector Mode (Read-Only) — ISO 27001 & Bank of
                Thailand (BOT) Segregation of Duties active. Editing and
                deletion controls are restricted.
              </span>
            </div>
          )}

          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR WORKSPACE, CONNECTED</div>
              <h1>{pageTitle}</h1>
              <p>{VIEW_DESCRIPTIONS[view]}</p>
            </div>
            {view !== 'Admin' &&
              view !== 'Logs & Audit' &&
              view !== 'Compliance and Governance' &&
              me.role !== 'auditor' && (
                <button className="primary" onClick={openCreate}>
                  <Plus size={17} />
                  {createButtonLabel}
                </button>
              )}
          </div>

          {notice && (
            <output className="notice">
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </output>
          )}

          {view === 'Overview' && (
            <OverviewView
              projects={projects}
              tasks={tasks}
              users={users}
              members={members}
              totalMonthly={totalMonthly}
              onNavigate={navigate}
              onOpenProject={(p) => {
                setDetail(p);
                navigate('Project workspace');
              }}
              onSelectTask={setSelectedTask}
              onFinishTask={finishTask}
            />
          )}

          {view === 'Projects' && (
            <ProjectsView
              visibleProjects={visibleProjects}
              query={query}
              filter={filter}
              yearFilter={yearFilter}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onYearFilterChange={setYearFilter}
              onOpenProject={(p) => {
                setDetail(p);
                navigate('Project workspace');
              }}
            />
          )}

          {view === 'Tasks' && (
            <TasksKanbanView
              visibleTasks={visibleTasks}
              query={query}
              filter={filter}
              readOnly={me.role === 'auditor'}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onSelectTask={setSelectedTask}
              onFinishTask={finishTask}
            />
          )}

          {view === 'Team' && <TeamView members={members} />}

          {view === 'Cloud resources' && (
            <CloudResourcesView
              resources={resourceRows}
              readOnly={me.role === 'auditor'}
              onAddResource={() => {
                setEditingResource(null);
                setFormError('');
                setModal('resource');
              }}
              onEditResource={(r) => {
                setEditingResource(r);
                setFormError('');
                setModal('resource');
              }}
              onDeleteResource={removeResource}
            />
          )}

          {view === 'Reports' && (
            <ReportsView
              totalMonthly={totalMonthly}
              spendByProvider={spendByProvider}
            />
          )}

          {view === 'Project workspace' && detail && (
            <ProjectWorkspaceView
              detail={detail}
              selectedTasks={selectedTasks}
              allTasks={tasks}
              activeUsers={activeUsers}
              currentUser={me}
              projectTab={projectTab}
              onTabChange={setProjectTab}
              onBack={() => navigate('Projects')}
              onAddTask={() => {
                setFormError('');
                setModal('task');
              }}
              onEditProject={(p) => {
                setEditingProject(p);
                setFormError('');
                setModal('project');
              }}
              onDeleteProject={removeProject}
              onSelectTask={setSelectedTask}
              onUpdateTask={editTask}
              onDeleteTask={removeTask}
              onErrorNotice={setNotice}
            />
          )}

          {view === 'Compliance and Governance' && (
            <Suspense
              fallback={<div className="panel">Loading compliance matrix…</div>}
            >
              <ComplianceMatrix
                projects={projects}
                currentUser={me}
                activeWorkspaceId={activeWorkspace?.id}
                onSelectProject={(projectId, tab) => {
                  const p = projects.find((x) => x.id === projectId);
                  if (p) {
                    setDetail(p);
                    setView('Project workspace');
                    setProjectTab(tab === 'documents' ? 'documents' : 'tasks');
                  }
                }}
              />
            </Suspense>
          )}

          {view === 'Knowledge' && (
            <KnowledgeView
              totalArticlesCount={knowledge.length}
              visibleKnowledge={visibleKnowledge}
              categories={categories}
              query={query}
              filter={filter}
              readOnly={me.role === 'auditor'}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onOpenCategoryManager={() => setCategoryManagerOpen(true)}
              onOpenArticle={setArticle}
            />
          )}

          {view === 'Admin' && me.role === 'admin' && (
            <Suspense
              fallback={<div className="panel">Loading admin settings…</div>}
            >
              <AdminPanel users={users} onChange={setUsers} />
            </Suspense>
          )}

          {view === 'Logs & Audit' &&
            (me.role === 'admin' || me.role === 'auditor') && (
              <Suspense
                fallback={<div className="panel">Loading audit trail…</div>}
              >
                <LogsViewer
                  currentUser={me}
                  activeWorkspaceId={activeWorkspace?.id}
                />
              </Suspense>
            )}

          <footer className="page-footer">
            <span>
              <span className="status-dot" /> Cloud Team Management
            </span>
            <span>Self-hosted workspace</span>
          </footer>
        </div>
      </main>

      <EntityFormDialog
        modal={modal}
        view={view}
        detail={detail}
        projects={projects}
        activeUsers={activeUsers}
        editingProject={editingProject}
        editingResource={editingResource}
        formError={formError}
        onClose={() => {
          setModal('');
          setFormError('');
          setEditingProject(null);
          setEditingResource(null);
        }}
        onSubmit={create}
      />

      <Suspense fallback={null}>
        {articleEditorOpen && (
          <ArticleEditorDialog
            open={articleEditorOpen}
            onOpenChange={setArticleEditorOpen}
            editing={editingArticle}
            categories={categories}
            projects={projects}
            currentUser={me}
            onSave={async (articleData) => {
              if (editingArticle) {
                const a = await patch<Article>(
                  `/knowledge/${editingArticle.id}`,
                  articleData
                );
                setKnowledge(knowledge.map((k) => (k.id === a.id ? a : k)));
                setNotice('Article updated.');
              } else {
                const a = await post<Article>('/knowledge', {
                  ...articleData,
                  workspaceId: activeWorkspace?.id,
                });
                setKnowledge([...knowledge, a]);
                setNotice('Article created.');
              }
            }}
          />
        )}

        {article && (
          <ArticleReaderDialog
            article={article}
            currentUser={me}
            onClose={() => setArticle(null)}
            onEdit={(a) => {
              setArticle(null);
              setEditingArticle(a);
              setArticleEditorOpen(true);
            }}
            onConvertToTasks={(a) => {
              setCopilotInitialPrompt(
                `Please extract all actionable checklist steps from the runbook "${a.name}" and draft them into tasks:\n\n${a.body.slice(0, 3000)}`
              );
              setArticle(null);
              setCopilotOpen(true);
            }}
            onDelete={(aId) => removeArticle(aId)}
            onChange={(a) => {
              setArticle(a);
              setKnowledge(knowledge.map((k) => (k.id === a.id ? a : k)));
            }}
          />
        )}

        {categoryManagerOpen && (
          <CategoryManagerDialog
            open={categoryManagerOpen}
            onOpenChange={setCategoryManagerOpen}
            categories={categories}
            articles={knowledge}
            onCategoriesChanged={loadAll}
          />
        )}

        {copilotOpen && (
          <CopilotPanel
            open={copilotOpen}
            onClose={() => {
              setCopilotOpen(false);
              setCopilotInitialPrompt('');
            }}
            initialPrompt={copilotInitialPrompt}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            owners={activeUsers.map((u) => ({ id: u.id, name: u.name }))}
            currentUser={me}
            onSaveArticle={async (art) => {
              const a = await post<Article>('/knowledge', {
                ...art,
                workspaceId: activeWorkspace?.id,
              });
              setKnowledge((prev) => [...prev, a]);
              setNotice('Report saved as Knowledge Article.');
            }}
            onTaskCreated={loadAll}
            onProjectCreated={loadAll}
          />
        )}

        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            open={Boolean(selectedTask)}
            onClose={() => setSelectedTask(null)}
            projects={projects}
            owners={activeUsers.map((u) => ({ id: u.id, name: u.name }))}
            articles={knowledge}
            projectDocuments={projectDocuments}
            onOpenArticle={(aId) => {
              const a = knowledge.find((k) => k.id === aId);
              if (a) setArticle(a);
            }}
            onUpdate={async (id, changes) => {
              if (me.role === 'auditor') return;
              await editTask(id, changes);
              setNotice('Task updated.');
            }}
            onDelete={async (id) => {
              if (me.role === 'auditor') return;
              await removeTask(id);
              setSelectedTask(null);
              setNotice('Task deleted.');
            }}
          />
        )}

        {profileDialogOpen && (
          <UserProfileDialog
            open={profileDialogOpen}
            onOpenChange={setProfileDialogOpen}
            currentUser={me}
            onUserUpdated={(u) => setMe(u)}
          />
        )}
      </Suspense>
    </SidebarProvider>
  );
}
