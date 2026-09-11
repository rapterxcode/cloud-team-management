import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Maximize2,
  Minimize2,
  PenLine,
  Columns,
  Eye,
  BookOpen,
  Save,
  Plus,
  Loader2,
} from 'lucide-react';
import type { Article, KnowledgeCategory, Project, Me } from '@/lib/types';
import MarkdownViewer from './markdown-viewer';
import EditorToolbar from './editor-toolbar';
import ArticleCopilotAssistant from './article-copilot-assistant';
import { estimateReadingTime } from './lib/toc.mjs';

export type ArticleEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Article | null;
  categories: KnowledgeCategory[];
  projects?: Project[];
  currentUser?: Me | null;
  onSave: (data: {
    name: string;
    category: string;
    body: string;
    format: 'markdown' | 'html';
    projectId?: string;
  }) => Promise<void>;
};

export default function ArticleEditorDialog({
  open,
  onOpenChange,
  editing,
  categories,
  projects = [],
  currentUser,
  onSave,
}: ArticleEditorDialogProps) {
  const [maximized, setMaximized] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [projectId, setProjectId] = useState('');
  const [format, setFormat] = useState<'markdown' | 'html'>('markdown');
  const [body, setBody] = useState('');
  const [viewMode, setViewMode] = useState<'write' | 'split' | 'preview'>('split');
  const [previousState, setPreviousState] = useState<{
    name: string;
    body: string;
    format: 'markdown' | 'html';
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize initial state when opened
  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name || '');
        setCategory(editing.category || categories[0]?.name || 'Guides');
        setProjectId(editing.projectId || '');
        setFormat(editing.format === 'html' ? 'html' : 'markdown');
        setBody(editing.body || '');
      } else {
        setName('');
        setCategory(categories[0]?.name || 'Guides');
        setProjectId('');
        setFormat('markdown');
        setBody('');
      }
      setPreviousState(null);
      setError(null);
      // Auto-select split view on wide desktop, write on smaller screens
      if (typeof window !== 'undefined' && window.innerWidth < 960) {
        setViewMode('write');
      } else {
        setViewMode('split');
      }
    }
  }, [open, editing, categories]);

  const handleInsert = (prefix: string, suffix = '', defaultPlaceholder = '') => {
    const ta = textareaRef.current;
    if (!ta) {
      setBody((prev) => prev + prefix + defaultPlaceholder + suffix);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = body.substring(start, end) || defaultPlaceholder;
    const next = body.substring(0, start) + prefix + sel + suffix + body.substring(end);
    setBody(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + sel.length);
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (e.shiftKey) {
        const val = ta.value;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        if (val.startsWith('  ', lineStart)) {
          const next = val.substring(0, lineStart) + val.substring(lineStart + 2);
          setBody(next);
          setTimeout(() => {
            ta.selectionStart = Math.max(lineStart, start - 2);
            ta.selectionEnd = Math.max(lineStart, end - 2);
          }, 0);
        }
      } else {
        const val = ta.value;
        const next = val.substring(0, start) + '  ' + val.substring(end);
        setBody(next);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  const handleImportDoc = (parsed: { name: string; body: string; format: 'markdown' | 'html' }) => {
    if (parsed.name) setName(parsed.name);
    setBody(parsed.body);
    setFormat(parsed.format);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanBody = body.trim();
    const cleanCategory = category.trim() || categories[0]?.name || 'Guides';

    if (!cleanName) {
      setError('Article title is required.');
      return;
    }
    if (!cleanBody) {
      setError('Article content is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: cleanName,
        category: cleanCategory,
        body: cleanBody,
        format,
        projectId: projectId ? projectId : undefined,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save article.');
    } finally {
      setSubmitting(false);
    }
  };

  const words = body.trim() ? body.trim().replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
  const readTime = estimateReadingTime(body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`article-editor-dialog ${maximized ? 'is-maximized' : ''}`}>
        <form onSubmit={handleSubmit} className="article-editor-container">
          {/* Header Bar */}
          <DialogHeader className="article-editor-header">
            <div className="flex items-center justify-between gap-4 w-full pr-8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  <BookOpen size={16} />
                </span>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>{editing ? 'Edit Knowledge Article' : 'Create Knowledge Article'}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        format === 'html'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                      }`}
                    >
                      {format === 'html' ? '⚡ HTML' : '📝 Markdown'}
                    </span>
                  </DialogTitle>
                </div>
              </div>

              {/* View mode toggle & Fullscreen toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('write')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === 'write'
                        ? 'bg-background text-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Focus on Writing"
                  >
                    <PenLine size={13} />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === 'split'
                        ? 'bg-background text-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Side-by-Side Split View"
                  >
                    <Columns size={13} />
                    <span>Split View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-background text-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Full Preview"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMaximized(!maximized)}
                  className="article-tool-btn"
                  title={maximized ? 'Restore normal window' : 'Expand full screen'}
                  aria-label={maximized ? 'Restore' : 'Maximize'}
                >
                  {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Main Scrollable Canvas */}
          <div className="article-editor-content">
            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
                  ✕
                </button>
              </div>
            )}

            {/* Top Metadata Row: Title, Category, Project */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-6">
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Article Title (e.g. Incident Response Runbook, GKE Cluster Setup)..."
                  className="w-full text-sm md:text-base font-semibold px-3.5 py-2 rounded-lg border border-border bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="md:col-span-3">
                <NativeSelect
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full"
                >
                  {categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.name}>
                      📁 {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="md:col-span-3">
                <NativeSelect
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">(No specific project)</NativeSelectOption>
                  {projects.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      🚀 {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {/* In-Editor AI Copilot Assistant */}
            <ArticleCopilotAssistant
              currentTitle={name}
              currentCategory={category}
              currentFormat={format}
              currentBody={body}
              currentUser={currentUser}
              canRevert={!!previousState}
              onRevert={() => {
                if (previousState) {
                  setName(previousState.name);
                  setBody(previousState.body);
                  setFormat(previousState.format);
                  setPreviousState(null);
                }
              }}
              onApply={(draft) => {
                setPreviousState({ name, body, format });
                if (draft.name) setName(draft.name);
                setBody(draft.body);
                if (draft.format) setFormat(draft.format);
              }}
            />

            {/* Formatting Toolbar */}
            <EditorToolbar
              format={format}
              onFormatChange={setFormat}
              onInsert={handleInsert}
              onImportDoc={handleImportDoc}
            />

            {/* Editor & Preview Workspace */}
            {viewMode === 'split' && (
              <div className="editor-workspace-split">
                {/* Left: Textarea Editor */}
                <div className="flex flex-col h-full min-h-[460px]">
                  <textarea
                    ref={textareaRef}
                    onKeyDown={handleEditorKeyDown}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    maxLength={100000}
                    placeholder={
                      format === 'html'
                        ? 'Write interactive HTML/CSS/JS with CDN CSS (Tailwind, Bootstrap, Pico, etc.)...'
                        : 'Write technical documentation, procedures, or notes with Markdown (# header, ``` code, - list)...'
                    }
                    className="w-full h-full min-h-[460px] font-mono text-xs md:text-sm p-4 rounded-lg border border-border bg-background leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                  />
                </div>

                {/* Right: Live Preview */}
                <div className="flex flex-col h-full min-h-[460px] border border-border rounded-lg bg-background p-4 md:p-6 overflow-y-auto shadow-2xs">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border/60">
                    Live Preview ({format === 'html' ? 'Interactive HTML' : 'Markdown'})
                  </div>
                  {body ? (
                    format === 'html' ? (
                      <iframe
                        sandbox="allow-scripts allow-downloads allow-forms allow-popups allow-modals"
                        srcDoc={body}
                        className="w-full h-full min-h-[420px] rounded border border-border bg-white"
                        title="HTML Live Preview"
                      />
                    ) : (
                      <div className="markdown-content">
                        <MarkdownViewer content={body} />
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground text-xs">
                      <Eye size={24} className="opacity-30 mb-2" />
                      <p>Start typing or use AI Copilot to see the live preview here.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'write' && (
              <div className="flex flex-col flex-1 min-h-[500px]">
                <textarea
                  ref={textareaRef}
                  onKeyDown={handleEditorKeyDown}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  maxLength={100000}
                  placeholder={
                    format === 'html'
                      ? 'Write interactive HTML/CSS/JS with CDN CSS (Tailwind, Bootstrap, Pico, etc.)...'
                      : 'Write technical documentation, procedures, or notes with Markdown (# header, ``` code, - list)...'
                  }
                  className="w-full flex-1 min-h-[500px] font-mono text-xs md:text-sm p-4 rounded-lg border border-border bg-background leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
                />
              </div>
            )}

            {viewMode === 'preview' && (
              <div className="flex flex-col flex-1 min-h-[500px] border border-border rounded-lg bg-background p-6 overflow-y-auto shadow-2xs">
                {body ? (
                  format === 'html' ? (
                    <iframe
                      sandbox="allow-scripts allow-downloads allow-forms allow-popups allow-modals"
                      srcDoc={body}
                      className="w-full min-h-[500px] rounded border border-border bg-white"
                      title="HTML Preview"
                    />
                  ) : (
                    <div className="markdown-content">
                      <MarkdownViewer content={body} />
                    </div>
                  )
                ) : (
                  <p className="empty">Nothing to preview yet. Write some content first.</p>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="article-editor-footer">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{words} words</span>
              <span>•</span>
              <span>{readTime}</span>
              <span>•</span>
              <span>{body.length.toLocaleString()} characters</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-button px-3 py-1.5 text-xs"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : editing ? (
                  <>
                    <Save size={14} />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Create Article
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
