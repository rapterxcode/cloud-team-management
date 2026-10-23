import { ArrowUpRight, BookOpen, FileText, Layers, Search } from 'lucide-react';
import { highlightMatches, snippetWithMatch } from '@/lib/search.mjs';
import type { Article, KnowledgeCategory } from '@/lib/types';

export interface KnowledgeViewProps {
  totalArticlesCount: number;
  visibleKnowledge: Article[];
  categories: KnowledgeCategory[];
  query: string;
  filter: string;
  readOnly?: boolean;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: string) => void;
  onOpenCategoryManager: () => void;
  onOpenArticle: (article: Article) => void;
}

export function KnowledgeView({
  totalArticlesCount,
  visibleKnowledge,
  categories,
  query,
  filter,
  readOnly = false,
  onQueryChange,
  onFilterChange,
  onOpenCategoryManager,
  onOpenArticle,
}: KnowledgeViewProps) {
  return (
    <>
      <div className="knowledge-banner">
        <span className="project-icon purple">
          <BookOpen size={26} />
        </span>
        <div>
          <h2>A home for what your team knows</h2>
          <p>
            Runbooks, onboarding, guides, and interactive tools, all in one
            place.
          </p>
        </div>
        <div className="flex items-center gap-2.5 ml-auto">
          {!readOnly && (
            <button
              type="button"
              className="text-button flex items-center gap-1.5 bg-white border border-purple-200 px-3 py-1.5 rounded-md text-xs font-semibold text-purple-700 shadow-sm hover:bg-purple-50"
              onClick={onOpenCategoryManager}
            >
              <Layers size={14} /> Manage categories
            </button>
          )}
          <span className="text-sm font-medium text-purple-900/80">
            {totalArticlesCount} articles
          </span>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search knowledge"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search titles and content…"
          />
        </label>
        <div className="filter-buttons">
          {['All', ...categories.map((c) => c.name)].map((c) => (
            <button
              key={c}
              className={filter === c ? 'selected' : ''}
              onClick={() => onFilterChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="knowledge-grid">
        {visibleKnowledge.map((k) => (
          <button
            className="knowledge-card"
            key={k.id}
            onClick={() => onOpenArticle(k)}
          >
            <div>
              <span className="project-icon purple">
                <FileText size={20} />
              </span>
              <div className="flex items-center gap-1.5">
                {k.format === 'html' && (
                  <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                    ⚡ HTML
                  </span>
                )}
                <span className="badge">{k.category}</span>
              </div>
            </div>
            <h2>
              {highlightMatches(k.name, query).map((s, idx) =>
                s.match ? (
                  <mark key={idx} className="search-highlight">
                    {s.text}
                  </mark>
                ) : (
                  <span key={idx}>{s.text}</span>
                )
              )}
            </h2>
            <p>
              {highlightMatches(snippetWithMatch(k.body, query, 145), query).map(
                (s, idx) =>
                  s.match ? (
                    <mark key={idx} className="search-highlight">
                      {s.text}
                    </mark>
                  ) : (
                    <span key={idx}>{s.text}</span>
                  )
              )}
            </p>
            <footer>
              <span>{k.author.name}</span>
              <span className="text-button">
                Read article <ArrowUpRight size={14} />
              </span>
            </footer>
          </button>
        ))}
      </div>
      {visibleKnowledge.length === 0 && (
        <p className="empty">
          No articles found. Try another search or create a new article.
        </p>
      )}
    </>
  );
}
