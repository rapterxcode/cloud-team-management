import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Edit3, Check, X, Layers } from 'lucide-react';
import type { KnowledgeCategory, Article } from '@/lib/types';
import { post, patch, destroy } from '@/lib/api';

type CategoryManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: KnowledgeCategory[];
  articles: Article[];
  onCategoriesChanged: () => void;
};

const COLOR_OPTIONS = [
  { label: 'Purple', value: 'purple', bg: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300' },
  { label: 'Blue', value: 'blue', bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300' },
  { label: 'Emerald', value: 'emerald', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' },
  { label: 'Amber', value: 'amber', bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300' },
  { label: 'Rose', value: 'rose', bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300' },
  { label: 'Cyan', value: 'cyan', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300' },
];

export default function CategoryManagerDialog({
  open,
  onOpenChange,
  categories,
  articles,
  onCategoriesChanged,
}: CategoryManagerDialogProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('purple');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('purple');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    try {
      await post('/knowledge/categories', { name: newName.trim(), color: newColor });
      setNewName('');
      onCategoriesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    setError('');
    try {
      await patch(`/knowledge/categories/${id}`, { name: editingName.trim(), color: editingColor });
      setEditingId(null);
      onCategoriesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update category');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const inUse = articles.filter(a => a.category === name).length;
    if (inUse > 0) {
      setError(`Cannot delete "${name}" because it is currently used by ${inUse} article(s). Please edit or reassign those articles first.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    setError('');
    try {
      await destroy(`/knowledge/categories/${id}`);
      onCategoriesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Layers className="text-purple-600" size={20} />
            <DialogTitle>Manage Knowledge Categories</DialogTitle>
          </div>
          <DialogDescription>
            Organize articles with custom categories. Filter tabs and article pickers update automatically.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        {/* Existing Categories List */}
        <div className="space-y-2 my-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Categories</h4>
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
            {categories.map(c => {
              const articleCount = articles.filter(a => a.category === c.name).length;
              const isEditing = editingId === c.id;

              return (
                <div key={c.id} className="flex items-center justify-between p-3 gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        className="h-8 text-xs border rounded px-2 flex-1 bg-background"
                        autoFocus
                      />
                      <select
                        value={editingColor}
                        onChange={e => setEditingColor(e.target.value)}
                        className="h-8 text-xs border rounded px-1.5 bg-background"
                      >
                        {COLOR_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleUpdate(c.id)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-muted-foreground hover:bg-muted rounded"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_OPTIONS.find(o => o.value === c.color)?.bg || 'bg-purple-100 text-purple-800'}`}>
                          {c.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({articleCount} {articleCount === 1 ? 'article' : 'articles'})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditingName(c.name);
                            setEditingColor(c.color || 'purple');
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          title="Edit category"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded"
                          title="Delete category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleCreate} className="pt-3 border-t border-border space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Create New Category</h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Security SOPs, Architecture"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 h-9 text-xs border rounded-md px-2.5 bg-background"
              required
            />
            <select
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="h-9 text-xs border rounded-md px-2 bg-background"
            >
              {COLOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="submit" className="primary text-xs px-3 h-9">
              <Plus size={14} /> Add
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
