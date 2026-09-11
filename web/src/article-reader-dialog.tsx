import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Maximize2, Minimize2, Sparkles, BookOpen, Clock, FileText, User as UserIcon, Code2, Copy, Check, ExternalLink } from 'lucide-react';
import type { Article, Me } from '@/lib/types';
import MarkdownViewer from './markdown-viewer';
import ArticleAttachments from './attachments';
import { extractTableOfContents, estimateReadingTime } from './lib/toc.mjs';

type ArticleReaderDialogProps = {
  article: Article | null;
  currentUser: Me;
  onClose: () => void;
  onEdit: (article: Article) => void;
  onConvertToTasks: (article: Article) => void;
  onDelete: (id: string) => void;
  onChange: (article: Article) => void;
};

export default function ArticleReaderDialog({
  article,
  currentUser,
  onClose,
  onEdit,
  onConvertToTasks,
  onDelete,
  onChange,
}: ArticleReaderDialogProps) {
  const [maximized, setMaximized] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isHtml = article?.format === 'html';
  const toc = article?.body && !isHtml ? extractTableOfContents(article.body) : [];
  const readTime = article?.body ? estimateReadingTime(article.body) : '1 min read';

  // Scrollspy to detect currently visible heading
  useEffect(() => {
    if (isHtml || toc.length === 0 || !article) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
      const containerTop = container.getBoundingClientRect().top;

      let currentId = toc[0]?.id || '';
      for (const h of headings) {
        const rect = h.getBoundingClientRect();
        if (rect.top - containerTop <= 80) {
          currentId = h.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(currentId);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [article?.id, article?.body, isHtml, toc.length]);

  if (!article) return null;

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(id);
    }
  };

  const copyMarkdown = async () => {
    if (!article) return;
    try {
      await navigator.clipboard.writeText(article.body);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const openInNewTab = () => {
    if (!article?.body) return;
    const blob = new Blob([article.body], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={!!article} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={`article-reader-dialog ${maximized ? 'is-maximized' : ''}`}>
        <div className="article-reader-container">
          {/* Header Bar */}
          <DialogHeader className="article-reader-header">
            <div className="flex items-center justify-between gap-4 w-full pr-8">
              <div className="flex items-center gap-2">
                <span className="badge font-medium">{article.category}</span>
                <span className={`badge ${isHtml ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                  {isHtml ? '⚡ Interactive HTML Page' : '📝 Markdown Document'}
                </span>
                {article.project && (
                  <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Project: {article.project.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="article-tool-btn"
                  onClick={copyMarkdown}
                  title="Copy content"
                  aria-label="Copy content"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
                {isHtml && (
                  <button
                    type="button"
                    className="article-tool-btn"
                    onClick={openInNewTab}
                    title="Open interactive page in new tab"
                    aria-label="Open in new tab"
                  >
                    <ExternalLink size={14} />
                    <span>Open in new tab</span>
                  </button>
                )}
                <button
                  type="button"
                  className="article-tool-btn"
                  onClick={() => setMaximized(!maximized)}
                  title={maximized ? 'Restore normal view' : 'Maximize to full screen'}
                  aria-label={maximized ? 'Restore' : 'Maximize'}
                >
                  {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>
            <DialogTitle className="article-reader-title mt-1.5">{article.name}</DialogTitle>
            <DialogDescription className="article-reader-desc flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>By {article.author.name}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {readTime}</span>
              {article.updatedAt && (
                <>
                  <span>·</span>
                  <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Dual-column reading layout */}
          <div className="article-reader-grid">
            {/* Left / Center Article Body */}
            <div className="article-reader-main" ref={scrollContainerRef}>
              {isHtml ? (
                <div className="article-html-wrapper h-full">
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded text-xs font-medium mb-3 flex items-center gap-2">
                    <Code2 size={14} />
                    <span>Sandboxed Interactive Page — JavaScript execution isolated for ISO 27001 safety.</span>
                  </div>
                  <iframe
                    sandbox="allow-scripts allow-downloads allow-forms allow-popups allow-modals"
                    srcDoc={article.body}
                    title={article.name}
                    className="article-html-frame w-full h-[620px] rounded-lg border border-border bg-white"
                  />
                </div>
              ) : (
                <div className="article-markdown-body">
                  <MarkdownViewer content={article.body || ''} />
                </div>
              )}
            </div>

            {/* Right Sidebar: TOC, Metadata, Attachments, Actions */}
            <aside className="article-reader-sidebar">
              {/* Dynamic Table of Contents (for Markdown) */}
              {!isHtml && toc.length > 0 && (
                <div className="sidebar-section">
                  <h4 className="sidebar-title flex items-center gap-1.5">
                    <BookOpen size={14} className="text-purple-600" />
                    <span>Table of Contents</span>
                  </h4>
                  <nav className="article-toc-nav" aria-label="Table of contents">
                    {toc.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`toc-item level-${item.level} ${activeHeadingId === item.id ? 'active' : ''}`}
                        onClick={() => scrollToHeading(item.id)}
                      >
                        <span className="toc-dot" />
                        <span className="toc-text">{item.text}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {/* Metadata Panel */}
              <div className="sidebar-section metadata-box">
                <h4 className="sidebar-title">Article Information</h4>
                <div className="metadata-rows text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><UserIcon size={12} /> Author</span>
                    <strong className="font-medium text-foreground">{article.author.name}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock size={12} /> Reading Time</span>
                    <span className="text-foreground">{readTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><FileText size={12} /> Format</span>
                    <span className="capitalize text-foreground font-mono text-[11px]">{article.format || 'markdown'}</span>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="sidebar-section">
                <ArticleAttachments article={article} onChange={onChange} />
              </div>

              {/* Actions Section */}
              <div className="sidebar-section sidebar-actions space-y-2 pt-2 border-t border-border">
                {currentUser.role !== 'auditor' && (
                  <button
                    type="button"
                    className="primary w-full justify-center"
                    onClick={() => {
                      onClose();
                      onEdit(article);
                    }}
                  >
                    Edit article
                  </button>
                )}
                <button
                  type="button"
                  className="runbook-convert-btn w-full justify-center"
                  onClick={() => {
                    onClose();
                    onConvertToTasks(article);
                  }}
                >
                  <Sparkles size={14} /> Turn into tasks with Copilot
                </button>
                {currentUser.role !== 'auditor' && (
                  <button
                    type="button"
                    className="text-button w-full justify-center text-red-600 hover:text-red-700"
                    onClick={() => onDelete(article.id)}
                  >
                    Delete article
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
