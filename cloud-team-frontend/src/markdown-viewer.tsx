import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { slugify } from './lib/toc.mjs';

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const text = String(children ?? '').replace(/\n$/, '');
  const lines = text.split('\n');
  const showLineNumbers = lines.length > 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error in restricted iframes
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <div className="flex items-center gap-2">
          <span className="code-block-lang">{lang || 'code'}</span>
          {showLineNumbers && (
            <span className="text-[10.5px] text-slate-400 font-mono font-normal">
              {lines.length} lines
            </span>
          )}
        </div>
        <button type="button" className="code-block-copy" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="code-block-body">
        {showLineNumbers && (
          <div className="code-line-numbers" aria-hidden="true">
            {lines.map((_, i) => (
              <span key={i} className="code-line-num">{i + 1}</span>
            ))}
          </div>
        )}
        <pre className="code-block-pre">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

function getNodeText(node: React.ReactNode): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    return getNodeText((node as any).props?.children);
  }
  return '';
}

export default function MarkdownViewer({ content }: { content: string }) {
  if (!content) return null;

  let headingCount = 0;

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children, ...props }) {
            const text = getNodeText(children);
            const slug = slugify(text) || 'heading';
            const id = `${slug}-${headingCount++}`;
            return <h1 id={id} className="scroll-mt-6 font-bold text-2xl mt-6 mb-3" {...props}>{children}</h1>;
          },
          h2({ children, ...props }) {
            const text = getNodeText(children);
            const slug = slugify(text) || 'heading';
            const id = `${slug}-${headingCount++}`;
            return <h2 id={id} className="scroll-mt-6 font-semibold text-xl mt-5 mb-2.5 pb-1 border-b border-border/40" {...props}>{children}</h2>;
          },
          h3({ children, ...props }) {
            const text = getNodeText(children);
            const slug = slugify(text) || 'heading';
            const id = `${slug}-${headingCount++}`;
            return <h3 id={id} className="scroll-mt-6 font-medium text-lg mt-4 mb-2" {...props}>{children}</h3>;
          },
          table({ children, ...props }) {
            return (
              <div className="markdown-table-wrapper my-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote className="markdown-blockquote border-l-4 border-purple-400/80 bg-purple-500/5 px-4 py-2 my-3 rounded-r-md italic text-slate-700 dark:text-slate-300" {...props}>
                {children}
              </blockquote>
            );
          },
          code({ className, children, ...props }) {
            const str = String(children ?? '');
            const isMultiline = str.includes('\n');
            const hasLang = Boolean(className);

            if (!isMultiline && !hasLang) {
              return <code className="inline-code px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-purple-600 dark:text-purple-400" {...props}>{children}</code>;
            }

            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
