import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, ShieldCheck, Terminal, Server, Layers, Cloud } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { post } from '@/lib/api';
import type { Workspace, Me } from '@/lib/types';

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelect: (workspace: Workspace) => void;
  onWorkspaceCreated: (workspace: Workspace) => void;
  currentUser: Me;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelect,
  onWorkspaceCreated,
  currentUser,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('engineering');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('purple');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const created = await post<Workspace>('/workspaces', {
        name: name.trim(),
        type,
        description: description.trim(),
        color,
        icon: type === 'audit' ? 'ShieldCheck' : type === 'operations' ? 'Server' : 'Cloud',
      });
      onWorkspaceCreated(created);
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWorkspaceTypeLabel = (wsType?: string) => {
    switch (wsType) {
      case 'audit':
        return 'Internal Audit & Compliance';
      case 'operations':
        return 'Cloud Operations & SRE';
      case 'general':
        return 'General Project Team';
      case 'engineering':
      default:
        return 'Engineering team';
    }
  };

  const activeName = activeWorkspace?.name || 'Cloud workspace';
  const activeInitial = activeName.charAt(0).toUpperCase() || 'C';
  const activeTypeLabel = getWorkspaceTypeLabel(activeWorkspace?.type);

  return (
    <div className="relative" ref={menuRef}>
      <div
        className="workspace cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="workspace-icon">{activeInitial}</span>
        <div className="flex-1 min-w-0 pr-1">
          <strong className="truncate block">{activeName}</strong>
          <small className="truncate block">{activeTypeLabel}</small>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 text-slate-400 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%-12px)] z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 px-2 uppercase">Workspaces</span>
            {currentUser.role !== 'auditor' && (
              <button
                type="button"
                className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-purple-50 transition-colors"
                onClick={() => {
                  setOpen(false);
                  setCreateModalOpen(true);
                }}
              >
                <Plus size={13} />
                New
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = activeWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    onSelect(ws);
                    setOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg flex items-center gap-2.5 transition-colors text-xs ${
                    isSelected ? 'bg-purple-50 text-purple-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      ws.type === 'audit'
                        ? 'bg-amber-100 text-amber-800'
                        : ws.type === 'operations'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{ws.name}</span>
                      {ws.type === 'audit' && (
                        <span className="text-[9px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-medium">
                          Audit
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate">{getWorkspaceTypeLabel(ws.type)}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-purple-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* New Workspace Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create an isolated workspace for a team, department, or compliance audit group.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="create-form">
            <label>
              Workspace Name
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Cloud Security & DevSecOps"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="form-columns">
              <label>
                Team & Context Type
                <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
                  <NativeSelectOption value="engineering">Engineering team</NativeSelectOption>
                  <NativeSelectOption value="audit">Internal Audit & Compliance</NativeSelectOption>
                  <NativeSelectOption value="operations">Cloud Operations & SRE</NativeSelectOption>
                  <NativeSelectOption value="general">General Squad</NativeSelectOption>
                </NativeSelect>
              </label>

              <label>
                Theme Color
                <NativeSelect value={color} onChange={(e) => setColor(e.target.value)}>
                  <NativeSelectOption value="purple">Purple</NativeSelectOption>
                  <NativeSelectOption value="blue">Blue</NativeSelectOption>
                  <NativeSelectOption value="emerald">Emerald</NativeSelectOption>
                  <NativeSelectOption value="amber">Amber</NativeSelectOption>
                </NativeSelect>
              </label>
            </div>

            <label>
              Description (optional)
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Objectives, scope, or regulatory audit charter..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button className="primary" type="submit" disabled={isSubmitting}>
              <Plus size={16} />
              {isSubmitting ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
