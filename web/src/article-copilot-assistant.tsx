import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  CheckCheck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  PlusCircle,
  Trash2,
  Bot,
  User,
  HelpCircle,
} from 'lucide-react';
import { post } from '@/lib/api';
import { COPILOT_ARTICLE_PRESETS, buildArticleCopilotPrompt } from './lib/copilot-article.mjs';

export interface ArticleDraftProposal {
  name: string;
  body: string;
  format: 'markdown' | 'html';
  summary: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: ArticleDraftProposal | null;
  status?: 'pending' | 'applied' | 'appended' | 'discarded';
  previewOpen?: boolean;
  timestamp: string;
}

export interface ArticleCopilotAssistantProps {
  currentTitle: string;
  currentCategory: string;
  currentFormat: 'markdown' | 'html';
  currentBody: string;
  currentUser?: { role?: string } | null;
  onApply: (draft: ArticleDraftProposal, mode?: 'replace' | 'append') => void;
  onRevert?: () => void;
  canRevert?: boolean;
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
  className?: string;
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
  isOpen: controlledIsOpen,
  onToggleOpen,
  className = '',
}: ArticleCopilotAssistantProps) {
  // ISO 27001 / BOT Segregation of Duties: Auditors have zero access to generative AI authoring tools
  if (currentUser?.role === 'auditor') {
    return null;
  }

  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const toggleOpen = (next: boolean) => {
    if (onToggleOpen) {
      onToggleOpen(next);
    } else {
      setInternalIsOpen(next);
    }
  };

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message when messages update or during loading
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const activePrompt = (textToSend !== undefined ? textToSend : prompt).trim();
    if (!activePrompt || loading) {
      if (!activePrompt) {
        setError('Please select a quick action or type an instruction for Copilot.');
      }
      return;
    }

    setError(null);
    const userMsgId = 'user_' + Date.now();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessages: ChatMessageItem[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: activePrompt,
        timestamp: nowTime,
      },
    ];

    setMessages(newMessages);
    setPrompt('');
    setLoading(true);

    try {
      // Build conversation history for multi-turn reasoning context
      const historyPayload = newMessages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await post<{
        draftArticle: ArticleDraftProposal;
        answer?: string;
      }>('/copilot/article', {
        prompt: activePrompt,
        name: currentTitle,
        category: currentCategory,
        format: currentFormat,
        currentBody: currentBody,
        history: historyPayload,
      });

      const assistantMsgId = 'asst_' + Date.now();
      const hasDraft = res.draftArticle && Boolean(res.draftArticle.body);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content:
            res.answer ||
            (hasDraft ? res.draftArticle.summary : 'Here is the draft content based on your request.'),
          proposal: hasDraft ? res.draftArticle : null,
          status: 'pending',
          previewOpen: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate draft.';
      let friendlyError = msg;
      if (msg.includes('not configured')) {
        friendlyError = "Copilot isn't configured yet. Ask an admin to set GEMINI_API_KEY.";
      } else if (msg.includes('Auditor')) {
        friendlyError = 'Auditors have read-only access and cannot use Copilot.';
      }

      setError(friendlyError);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ Error: ${friendlyError}`,
          status: 'discarded',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMessageProposal = (messageId: string, mode: 'replace' | 'append') => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.proposal) return;

    onApply(targetMsg.proposal, mode);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: mode === 'append' ? 'appended' : 'applied' } : m,
      ),
    );
  };

  const handleDiscardMessageProposal = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'discarded' } : m)),
    );
  };

  const togglePreview = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, previewOpen: !m.previewOpen } : m)),
    );
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handlePresetClick = (presetId: string) => {
    // Precondition checks
    if (presetId === 'draft' && !currentTitle.trim() && !prompt.trim()) {
      setError('Please enter an Article Title above (or type a topic in the prompt box) so Copilot knows what article to draft.');
      return;
    }
    if (
      ['checklist', 'format-code', 'convert-html', 'executive-summary', 'polish', 'runbook'].includes(presetId) &&
      !currentBody.trim() &&
      !prompt.trim()
    ) {
      setError(`Please enter or draft article content first before applying this action.`);
      return;
    }

    const promptText = buildArticleCopilotPrompt(presetId, {
      name: currentTitle,
      category: currentCategory,
      format: currentFormat,
      currentBody: currentBody,
      customPrompt: prompt,
    });

    handleSendMessage(promptText);
  };

  return (
    <div
      id="article-copilot-assistant"
      className={`mb-4 rounded-xl border border-purple-200/90 bg-gradient-to-b from-purple-50/60 via-white to-white shadow-xs overflow-hidden transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-purple-50/80 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 text-white shadow-xs">
            <Sparkles size={13} />
          </span>
          <span className="text-xs font-bold text-purple-950">AI Copilot Assistant</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200/70">
            Smart Editor Chat
          </span>
          {messages.length > 0 && (
            <span className="hidden sm:inline-flex text-[10px] font-medium bg-purple-200/70 text-purple-800 px-1.5 py-0.5 rounded-full">
              {messages.length} msg{messages.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors"
              title="Clear conversation history"
            >
              <Trash2 size={11} />
              <span>Clear Chat</span>
            </button>
          )}

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
            onClick={() => toggleOpen(!isOpen)}
            className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-100/60 transition-colors"
            aria-label={isOpen ? 'Collapse assistant' : 'Expand assistant'}
            title={isOpen ? 'Minimize AI Chat' : 'Expand AI Chat'}
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="p-3.5 space-y-3">
          {/* Multi-Turn Conversation Thread */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 p-3 rounded-lg bg-slate-50/80 border border-purple-100 text-xs shadow-inner">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-1`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                    {m.role === 'user' ? (
                      <>
                        <span>You</span>
                        <User size={11} className="text-slate-500" />
                      </>
                    ) : (
                      <>
                        <Bot size={11} className="text-purple-600" />
                        <span className="font-semibold text-purple-800">AI Copilot</span>
                      </>
                    )}
                    <span>• {m.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 max-w-[95%] sm:max-w-[85%] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-purple-600 text-white shadow-xs rounded-tr-xs'
                        : 'bg-white border border-purple-200/80 text-slate-800 shadow-2xs rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>

                    {/* Interactive Proposal Card within Assistant Message */}
                    {m.proposal && (
                      <div className="mt-3 pt-2.5 border-t border-purple-100 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-semibold text-purple-950 flex items-center gap-1.5 text-[11px]">
                            <Sparkles size={12} className="text-purple-600" />
                            Proposed Draft Content
                          </span>
                          <div className="flex items-center gap-1">
                            {m.proposal.format !== currentFormat && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                {m.proposal.format === 'html' ? '⚡ HTML' : '📝 MARKDOWN'}
                              </span>
                            )}
                            {m.proposal.name && m.proposal.name !== currentTitle && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Title: {m.proposal.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Proposal Summary */}
                        <p className="text-[11px] text-purple-900 bg-purple-50/70 p-2 rounded border border-purple-100/80">
                          {m.proposal.summary}
                        </p>

                        {/* Collapsible Content Preview */}
                        <div>
                          <button
                            type="button"
                            onClick={() => togglePreview(m.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900"
                          >
                            {m.previewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                            <span>
                              {m.previewOpen ? 'Hide Proposed Content' : 'Preview Proposed Content'}
                            </span>
                          </button>

                          {m.previewOpen && (
                            <div className="mt-1.5 p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-700">
                              {m.proposal.body}
                            </div>
                          )}
                        </div>

                        {/* Status Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {m.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApplyMessageProposal(m.id, 'replace')}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                              >
                                <Check size={12} />
                                Apply to Editor
                              </button>
                              {currentBody.trim() && (
                                <button
                                  type="button"
                                  onClick={() => handleApplyMessageProposal(m.id, 'append')}
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors"
                                  title="Append proposed content to the bottom without overwriting"
                                >
                                  <PlusCircle size={12} />
                                  Append to Bottom
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDiscardMessageProposal(m.id)}
                                className="text-xs font-medium px-2 py-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                Discard
                              </button>
                            </>
                          ) : m.status === 'applied' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCheck size={12} />
                              Applied to Editor
                            </span>
                          ) : m.status === 'appended' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              <PlusCircle size={12} />
                              Appended to Bottom
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Proposal discarded
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Thinking Bubble */}
              {loading && (
                <div className="flex items-center gap-2 p-2.5 text-xs text-purple-700 bg-white rounded-lg border border-purple-200/80 shadow-2xs w-fit">
                  <Loader2 size={14} className="animate-spin text-purple-600" />
                  <span>AI Copilot is analyzing and drafting…</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* Quick Preset Action Chips */}
          <div>
            <div className="text-[11px] font-medium text-slate-600 mb-1.5 flex items-center justify-between">
              <span>Quick Actions:</span>
              {messages.length === 0 && (
                <span className="text-[10px] text-purple-600">
                  Pick a 1-click action or type in the chat box below
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COPILOT_ARTICLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePresetClick(preset.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Persistent AI Chat Input Box (NEVER DISAPPEARS) */}
          <div className="pt-0.5">
            <div className="relative border border-purple-200/90 rounded-xl bg-white shadow-xs focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
              <textarea
                ref={textareaRef}
                id="article-copilot-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={2}
                placeholder="Type instruction for AI Copilot... (e.g. 'Draft full article', 'Add troubleshooting table', 'Convert to HTML') [Enter to send, Shift+Enter for newline]"
                disabled={loading}
                className="w-full text-xs px-3 py-2 rounded-t-xl bg-transparent placeholder:text-slate-400 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/90 rounded-b-xl border-t border-slate-100">
                <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-1.5">
                  <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-mono">
                    Enter
                  </kbd>{' '}
                  to send
                  <span className="text-slate-300">•</span>
                  <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-mono">
                    Shift+Enter
                  </kbd>{' '}
                  newline
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={loading || !prompt.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send message to Copilot"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Thinking…
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-rose-700 text-xs ml-2 font-bold"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Collapsed State Bar: prominent and 1-click expandable so it's never lost */
        <div
          onClick={() => toggleOpen(true)}
          className="px-3.5 py-2.5 bg-purple-50/50 flex items-center justify-between cursor-pointer hover:bg-purple-100/60 transition-colors text-xs text-purple-900 font-medium"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-600 text-white shadow-2xs">
              <Sparkles size={11} />
            </span>
            <span className="font-semibold">AI Copilot Chat is minimized</span>
            {messages.length > 0 && (
              <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-medium">
                {messages.length} message{messages.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-purple-200 shadow-2xs"
          >
            <span>Open AI Chat</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default ArticleCopilotAssistant;
