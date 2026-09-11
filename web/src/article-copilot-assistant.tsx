import { useState } from 'react';
import { Sparkles, Loader2, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { post } from '@/lib/api';
import { COPILOT_ARTICLE_PRESETS, buildArticleCopilotPrompt } from './lib/copilot-article.mjs';

export interface ArticleDraftProposal {
  name: string;
  body: string;
  format: 'markdown' | 'html';
  summary: string;
}

export interface ArticleCopilotAssistantProps {
  currentTitle: string;
  currentCategory: string;
  currentFormat: 'markdown' | 'html';
  currentBody: string;
  currentUser?: { role?: string } | null;
  onApply: (draft: ArticleDraftProposal) => void;
  onRevert?: () => void;
  canRevert?: boolean;
}

export function ArticleCopilotAssistant({
  currentTitle,
  currentCategory,
  currentFormat,
  currentBody,
  currentUser,
  onApply,
  onRevert,
  canRevert = false,
}: ArticleCopilotAssistantProps) {
  // ISO 27001 / BOT Segregation of Duties: Auditors have zero access to generative AI authoring tools
  if (currentUser?.role === 'auditor') {
    return null;
  }

  const [isOpen, setIsOpen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ArticleDraftProposal | null>(null);
  const [lastAppliedSummary, setLastAppliedSummary] = useState<string | null>(null);

  const handleRunCopilot = async (selectedPrompt: string) => {
    const activePrompt = (selectedPrompt || prompt).trim();
    if (!activePrompt) {
      setError('Please select a preset or type an instruction.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await post<{
        draftArticle: ArticleDraftProposal;
        answer?: string;
      }>('/copilot/article', {
        prompt: activePrompt,
        name: currentTitle,
        category: currentCategory,
        format: currentFormat,
        currentBody: currentBody,
      });

      if (res.draftArticle) {
        setProposal(res.draftArticle);
      } else {
        setError('No draft generated. Please try a different prompt.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate draft.';
      if (msg.includes('not configured')) {
        setError("Copilot isn't configured yet. Ask an admin to set GEMINI_API_KEY.");
      } else if (msg.includes('Auditor')) {
        setError('Auditors have read-only access and cannot use Copilot.');
      } else {
        setError(msg || 'Copilot is unavailable, please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!proposal) return;
    onApply(proposal);
    setLastAppliedSummary(proposal.summary);
    setProposal(null);
    setPrompt('');
  };

  const handleDiscard = () => {
    setProposal(null);
  };

  return (
    <div className="mb-4 rounded-xl border border-purple-200/80 bg-gradient-to-b from-purple-50/50 via-white to-white shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-purple-50/60 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 text-white shadow-xs">
            <Sparkles size={13} />
          </span>
          <span className="text-xs font-semibold text-purple-950">AI Copilot Assistant</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
            Smart Editor
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canRevert && onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
              title="Undo last Copilot change"
            >
              <RotateCcw size={11} />
              Revert AI Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-purple-600 hover:text-purple-800 p-0.5 rounded transition-colors"
            aria-label={isOpen ? 'Collapse assistant' : 'Expand assistant'}
          >
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-3.5 space-y-3">
          {/* Quick Preset Chips */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">Quick Actions:</div>
            <div className="flex flex-wrap gap-1.5">
              {COPILOT_ARTICLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const promptText = buildArticleCopilotPrompt(preset.id, {
                      name: currentTitle,
                      category: currentCategory,
                      format: currentFormat,
                      currentBody: currentBody,
                    });
                    setPrompt(promptText);
                    handleRunCopilot(promptText);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input & Action */}
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRunCopilot(prompt);
                }
              }}
              placeholder="Or ask Copilot to polish, format tables, add architecture runbooks..."
              disabled={loading}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => handleRunCopilot(prompt)}
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Run
                </>
              )}
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-700 text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Proposal Review Card */}
          {proposal && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-950 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-600" />
                  Proposed Changes
                </span>
                <div className="flex items-center gap-1.5">
                  {proposal.format !== currentFormat && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Format: {proposal.format.toUpperCase()}
                    </span>
                  )}
                  {proposal.name && proposal.name !== currentTitle && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      New Title Suggested
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-purple-900 leading-relaxed bg-white/80 p-2.5 rounded border border-purple-100">
                {proposal.summary}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                >
                  <Check size={13} />
                  Apply to Editor
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="text-xs font-medium px-2.5 py-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Last Applied Feedback */}
          {!proposal && lastAppliedSummary && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 flex items-center justify-between">
              <span>Applied: {lastAppliedSummary}</span>
              <button
                type="button"
                onClick={() => setLastAppliedSummary(null)}
                className="text-emerald-500 hover:text-emerald-800 text-[10px] ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ArticleCopilotAssistant;
