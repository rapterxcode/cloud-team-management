import React from 'react';
import { Bold, Italic, Code, List, ListOrdered, CheckSquare, Heading1, Heading2, Heading3, Table, AlertCircle, Quote, Upload, FileCode2, Palette, Sparkles } from 'lucide-react';
import { parseImportedFile, CDN_CSS_PRESETS, getHtmlTemplateWithCdn } from './lib/toc.mjs';

type EditorToolbarProps = {
  format: 'markdown' | 'html';
  onFormatChange: (format: 'markdown' | 'html') => void;
  onInsert: (prefix: string, suffix?: string, defaultPlaceholder?: string) => void;
  onImportDoc: (parsed: { name: string; body: string; format: 'markdown' | 'html' }) => void;
};

export default function EditorToolbar({
  format,
  onFormatChange,
  onInsert,
  onImportDoc,
}: EditorToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedFile(file.name, text);
      onImportDoc({
        name: parsed.name,
        body: parsed.body,
        format: parsed.format as 'markdown' | 'html',
      });
    } catch {
      alert('Could not read file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="editor-toolbar-container">
      {/* Top row: Format selection & Import button */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`editor-format-btn ${format === 'markdown' ? 'active' : ''}`}
            onClick={() => onFormatChange('markdown')}
          >
            📝 Markdown
          </button>
          <button
            type="button"
            className={`editor-format-btn ${format === 'html' ? 'active' : ''}`}
            onClick={() => onFormatChange('html')}
          >
            ⚡ Interactive HTML Page
          </button>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".md,.markdown,.html,.htm,.txt"
            className="hidden"
            id="editor-import-file-input"
          />
          <button
            type="button"
            className="editor-tool-action-btn flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 px-2 py-1 rounded"
            onClick={() => fileInputRef.current?.click()}
            title="Import .md, .html, or .txt file"
          >
            <Upload size={13} />
            <span>Import Document</span>
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      {format === 'markdown' ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('# ', '', 'Heading 1')}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('## ', '', 'Heading 2')}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('### ', '', 'Heading 3')}
            title="Heading 3"
          >
            <Heading3 size={14} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('**', '**', 'bold text')}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('*', '*', 'italic text')}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('`', '`', 'code')}
            title="Inline Code"
          >
            <Code size={14} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('- ', '', 'List item')}
            title="Bullet List"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('1. ', '', 'First item')}
            title="Numbered List"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('- [ ] ', '', 'Task checklist item')}
            title="Task Checklist"
          >
            <CheckSquare size={14} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('```bash\n', '\n```', '# Command here')}
            title="Code Block"
          >
            <FileCode2 size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('> ', '', 'Quote note')}
            title="Blockquote"
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('> [!NOTE]\n> ', '', 'Important procedure context')}
            title="Callout Note"
          >
            <AlertCircle size={14} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => onInsert('| Parameter | Type | Description |\n|---|---|---|\n| id | string | Resource identifier |\n', '', '')}
            title="Insert Table"
          >
            <Table size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Palette size={13} className="text-purple-600 dark:text-purple-400" />
            <span>CDN CSS:</span>
          </span>
          {CDN_CSS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="tool-btn text-xs px-2 py-0.5 font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 rounded transition-colors"
              onClick={() => onInsert(preset.snippet, '', '')}
              title={`Insert ${preset.name}: ${preset.description}`}
            >
              + {preset.badge || preset.name}
            </button>
          ))}

          <span className="toolbar-divider" />

          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Sparkles size={13} className="text-amber-500" />
            <span>Templates:</span>
          </span>
          <button
            type="button"
            className="tool-btn text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-medium transition-colors"
            onClick={() => onInsert(getHtmlTemplateWithCdn('tailwind'), '', '')}
            title="Insert Tailwind CSS Starter Template"
          >
            Tailwind Starter
          </button>
          <button
            type="button"
            className="tool-btn text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-medium transition-colors"
            onClick={() => onInsert(getHtmlTemplateWithCdn('bootstrap'), '', '')}
            title="Insert Bootstrap 5 Starter Template"
          >
            Bootstrap Starter
          </button>
          <button
            type="button"
            className="tool-btn text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-medium transition-colors"
            onClick={() => onInsert(getHtmlTemplateWithCdn('pico'), '', '')}
            title="Insert Pico.css Semantic Starter Template"
          >
            Pico Starter
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            className="tool-btn text-xs px-2"
            onClick={() => onInsert('<style>\n  ', '\n</style>', '/* Custom CSS */')}
            title="Insert <style> block"
          >
            &lt;style&gt;
          </button>
          <button
            type="button"
            className="tool-btn text-xs px-2"
            onClick={() => onInsert('<script>\n  ', '\n</script>', '// JavaScript code')}
            title="Insert <script> block"
          >
            &lt;script&gt;
          </button>
          <button
            type="button"
            className="tool-btn text-xs px-2"
            onClick={() => onInsert('<button onclick="', '">Click Me</button>', 'alert("Executed!")')}
            title="Insert interactive <button>"
          >
            &lt;button&gt;
          </button>
        </div>
      )}
    </div>
  );
}
