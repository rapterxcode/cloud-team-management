import React from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { Project, Resource, User } from '@/lib/types';

export interface EntityFormDialogProps {
  modal: string;
  view: string;
  detail: Project | null;
  projects: Project[];
  activeUsers: User[];
  editingProject: Project | null;
  editingResource: Resource | null;
  formError: string;
  onClose: () => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
}

export function EntityFormDialog({
  modal,
  view,
  detail,
  projects,
  activeUsers,
  editingProject,
  editingResource,
  formError,
  onClose,
  onSubmit,
}: EntityFormDialogProps) {
  const isEditing = Boolean(editingProject || editingResource);

  return (
    <Dialog
      open={Boolean(modal)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit' : 'Create'} {modal}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update this' : 'Add a new'} {modal}.
          </DialogDescription>
        </DialogHeader>
        <form className="create-form" onSubmit={onSubmit}>
          <label>
            Name
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={
                editingProject?.name || editingResource?.name || ''
              }
              placeholder={
                modal === 'project'
                  ? 'e.g. Platform modernization'
                  : modal === 'resource'
                    ? 'e.g. production-api'
                    : 'e.g. Review deployment checklist'
              }
            />
          </label>

          {modal === 'project' && (
            <>
              <label>
                Description
                <textarea
                  name="description"
                  maxLength={2000}
                  rows={3}
                  defaultValue={editingProject?.description || ''}
                  placeholder="Project scope, objectives, architecture overview..."
                />
              </label>
              <div className="form-columns">
                <label>
                  Year
                  <NativeSelect
                    name="year"
                    defaultValue={String(editingProject?.year || 2026)}
                  >
                    {['2024', '2025', '2026', '2027', '2028'].map((y) => (
                      <NativeSelectOption key={y} value={y}>
                        {y}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  Status
                  <NativeSelect
                    name="status"
                    defaultValue={editingProject?.status || 'New'}
                  >
                    {['New', 'On track', 'At risk', 'Completed'].map((s) => (
                      <NativeSelectOption key={s} value={s}>
                        {s}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    name="due"
                    defaultValue={(editingProject?.due || '').slice(0, 10)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </label>
              </div>
              {editingProject && (
                <div className="form-columns">
                  <label>
                    Progress %
                    <input
                      name="progress"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={editingProject.progress}
                    />
                  </label>
                  <label>
                    Team
                    <input
                      name="department"
                      defaultValue={editingProject.department}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {modal === 'task' && (
            <>
              <label>
                Project
                <NativeSelect
                  name="projectId"
                  defaultValue={
                    view === 'Project workspace' ? detail?.id : projects[0]?.id
                  }
                  required
                >
                  {projects.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <div className="form-columns">
                <label>
                  Owner
                  <NativeSelect name="ownerId" required>
                    {activeUsers.map((u) => (
                      <NativeSelectOption key={u.id} value={u.id}>
                        {u.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    name="start"
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </label>
                <label>
                  Finish date
                  <input
                    type="date"
                    name="date"
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </label>
                <label>
                  Phase
                  <input
                    name="phase"
                    list="task-modal-phases"
                    defaultValue="Planning"
                    placeholder="e.g. Planning, Testing, Audit"
                  />
                  <datalist id="task-modal-phases">
                    {['Planning', 'Development', 'Testing', 'Launch', 'Audit'].map(
                      (p) => (
                        <option key={p} value={p} />
                      )
                    )}
                  </datalist>
                </label>
              </div>
              <label>
                Description (optional)
                <textarea
                  name="description"
                  maxLength={10000}
                  placeholder="Add detailed runbooks, checklists, commands or notes for this task..."
                  rows={3}
                />
              </label>
            </>
          )}

          {modal === 'resource' && (
            <div className="form-columns">
              <label>
                Provider
                <input
                  name="provider"
                  required
                  defaultValue={editingResource?.provider || ''}
                  placeholder="e.g. AWS, GCP, Azure"
                />
              </label>
              <label>
                Type
                <input
                  name="type"
                  required
                  defaultValue={editingResource?.type || ''}
                  placeholder="e.g. EKS Cluster, Cloud SQL"
                />
              </label>
              <label>
                Status
                <NativeSelect
                  name="status"
                  defaultValue={editingResource?.status || 'Healthy'}
                >
                  {['Healthy', 'Review needed'].map((s) => (
                    <NativeSelectOption key={s}>{s}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label>
                Monthly cost $
                <input
                  name="monthlyCost"
                  type="number"
                  min={0}
                  defaultValue={editingResource?.monthlyCost ?? 0}
                />
              </label>
            </div>
          )}

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button className="primary" type="submit">
            <Plus size={16} />
            {isEditing ? 'Save changes' : `Create ${modal}`}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
