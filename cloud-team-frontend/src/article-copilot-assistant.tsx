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
  Plus,
  PlusCircle,
  Trash2,
  Bot,
  User,
  Maximize2,
  Minimize2,
  ExternalLink,
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
  isFullWorkspace?: boolean;
  onToggleFullWorkspace?: (full: boolean) => void;
  initialMessages?: ChatMessageItem[];
  onMessagesChange?: (messages: ChatMessageItem[]) => void;
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
  isFullWorkspace = false,
  onToggleFullWorkspace,
  initialMessages,
  onMessagesChange,
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
  const [messages, setMessages] = useState<ChatMessageItem[]>(initialMessages ?? []);

  // Sync when initialMessages changes (e.g. user opens an article with saved chat history)
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const updateMessages = (updater: ChatMessageItem[] | ((prev: ChatMessageItem[]) => ChatMessageItem[])) => {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (onMessagesChange) {
        onMessagesChange(next);
      }
      return next;
    });
  };

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
        setError('กรุณาพิมพ์คำสั่งหรือเลือก Quick Action เพื่อให้ AI Copilot เริ่มทำงาน');
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

    updateMessages(newMessages);
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

      updateMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content:
            res.answer ||
            (hasDraft ? res.draftArticle.summary : 'จัดเตรียมเนื้อหาร่างบทความเรียบร้อยแล้ว'),
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
      updateMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ เกิดข้อผิดพลาด: ${friendlyError}`,
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
    updateMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: mode === 'append' ? 'appended' : 'applied' } : m,
      ),
    );
  };

  const handleDiscardMessageProposal = (messageId: string) => {
    updateMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'discarded' } : m)),
    );
  };

  const togglePreview = (messageId: string) => {
    updateMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, previewOpen: !m.previewOpen } : m)),
    );
  };

  const handleClearChat = () => {
    updateMessages([]);
    setError(null);
  };

  const handlePresetClick = (presetId: string) => {
    // Precondition checks
    if (presetId === 'draft' && !currentTitle.trim() && !prompt.trim()) {
      setError('กรุณาระบุชื่อบทความ (Article Title) หรือพิมพ์หัวข้อที่ต้องการในช่องแชท เพื่อให้ AI Copilot ทราบเรื่องที่ต้องการร่าง');
      return;
    }
    if (
      ['checklist', 'format-code', 'convert-html', 'executive-summary', 'polish', 'runbook'].includes(presetId) &&
      !currentBody.trim() &&
      !prompt.trim()
    ) {
      setError('กรุณาป้อนหรือสร้างเนื้อหาบทความก่อนเรียกใช้งาน Quick Action นี้');
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

  // 1. Minimized / Collapsed Single Banner (Spacious, Clear, Non-redundant)
  if (!isOpen) {
    return (
      <div
        id="article-copilot-assistant"
        onClick={() => toggleOpen(true)}
        className={`mb-4 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/90 via-white to-purple-50/70 hover:from-purple-100 hover:to-purple-100/80 p-4 flex items-center justify-between cursor-pointer transition-all shadow-xs group ${className}`}
      >
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-105 transition-transform">
            <Sparkles size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-purple-950">AI Copilot Assistant (Smart Editor)</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                คลิกเพื่อเปิดกล่องแชท
              </span>
              {messages.length > 0 && (
                <span className="text-xs bg-purple-200/90 text-purple-900 px-2.5 py-0.5 rounded-full font-bold">
                  {messages.length} ข้อความในการสนทนา
                </span>
              )}
            </div>
            <p className="text-xs text-purple-700 mt-1">
              ผู้ช่วย AI อัจฉริยะ: ร่างเนื้อหาทั้งบทความ, เพิ่ม Checklist / Runbook, จัด Code และแปลงเป็น HTML สวยงาม
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-bold text-purple-800 bg-white hover:bg-purple-50 px-4 py-2.5 rounded-xl border border-purple-200 shadow-2xs transition-colors"
        >
          <span>เปิดกล่อง AI Chat</span>
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  // 2. Full Expanded AI Chat Box (Spacious, Roomy, Height-Enriched & Comfortable)
  return (
    <div
      id="article-copilot-assistant"
      className={`rounded-2xl border-2 border-purple-300/90 bg-gradient-to-b from-purple-50/70 via-white to-white shadow-sm overflow-hidden transition-all ${
        isFullWorkspace ? 'h-full flex-1 flex flex-col min-h-0 mb-0' : 'mb-4'
      } ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-50/90 border-b border-purple-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
            <Sparkles size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm md:text-base font-bold text-purple-950">AI Copilot Workspace</span>
              {messages.length > 0 && (
                <span className="text-xs font-semibold bg-purple-200/90 text-purple-900 px-2 py-0.5 rounded-full">
                  {messages.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-purple-700 hidden sm:block">
              สนทนา ร่าง และแก้ไขบทความไปพร้อมกับ Editor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleFullWorkspace && (
            <button
              type="button"
              onClick={() => onToggleFullWorkspace(!isFullWorkspace)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-800 hover:text-purple-950 bg-purple-100/70 hover:bg-purple-200/80 px-2.5 py-1.5 rounded-lg transition-colors border border-purple-200"
              title={isFullWorkspace ? 'สลับเป็นโหมดเคียงข้าง Editor' : 'ขยายเต็มพื้นที่หน้าจอ (Full Workspace)'}
            >
              {isFullWorkspace ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{isFullWorkspace ? 'ย่อกลับ' : 'เต็มจอ'}</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('ต้องการเริ่มบทสนทนาใหม่สำหรับบทความนี้หรือไม่?')) {
                  handleClearChat();
                }
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-purple-700 hover:bg-purple-100/70 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
              title="เริ่มบทสนทนาใหม่ (New Chat)"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">New Thread</span>
            </button>
          )}

          {canRevert && onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 transition-colors"
              title="ยกเลิกการแก้ไขล่าสุดของ AI"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">ย้อนกลับ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => toggleOpen(false)}
            className="text-purple-700 hover:text-purple-950 p-1.5 rounded-lg hover:bg-purple-100/80 transition-colors"
            aria-label="ซ่อนแผง AI Chat"
            title="ซ่อนแผง AI Chat เพื่อโฟกัสที่ Editor เต็มจอ"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>

      <div className={`p-4 md:p-5 space-y-3.5 ${isFullWorkspace ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : ''}`}>
        {/* Quick Preset Action Chips */}
        <div className="flex-shrink-0">
          <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
            <span>คำสั่งด่วน 1 คลิก (Quick Actions):</span>
            <span className="text-[11px] font-normal text-purple-700 hidden sm:inline">
              คลิกคำสั่งด่วน หรือพิมพ์ในช่องแชท
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COPILOT_ARTICLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => handlePresetClick(preset.id)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-purple-200/90 bg-white hover:bg-purple-50 text-purple-950 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Thread / Viewport Canvas */}
        <div
          className={`space-y-3.5 overflow-y-auto pr-1.5 p-4 rounded-2xl bg-slate-50/95 border border-purple-100 text-sm shadow-inner ${
            isFullWorkspace ? 'flex-1 min-h-0' : 'min-h-[260px] md:min-h-[340px] max-h-[620px]'
          }`}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4 space-y-4 min-h-[220px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
                <Sparkles size={28} />
              </div>
              <div className="max-w-lg space-y-2">
                <h4 className="text-lg font-bold text-purple-950">AI Copilot Smart Editor Chat</h4>
                <p className="text-sm text-purple-800 leading-relaxed">
                  ยินดีต้อนรับสู่ผู้ช่วย AI อัจฉริยะ! คุณสามารถเลือก <strong>Quick Actions</strong> ด้านบน หรือพิมพ์คำสั่ง/เนื้อหาที่ต้องการในกล่องพิมพ์ด้านล่างได้เลยครับ
                </p>
                <div className="pt-3 flex flex-wrap justify-center gap-2 text-xs text-slate-600">
                  <span className="bg-white px-3 py-1 rounded-lg border border-purple-200/80 shadow-2xs">💡 ร่างบทความฉบับเต็ม</span>
                  <span className="bg-white px-3 py-1 rounded-lg border border-purple-200/80 shadow-2xs">💡 ทำ Checklist Rollback</span>
                  <span className="bg-white px-3 py-1 rounded-lg border border-purple-200/80 shadow-2xs">💡 แปลง Markdown เป็น HTML สวยงาม</span>
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                } space-y-1.5`}
              >
                {/* Sender Header */}
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  {m.role === 'user' ? (
                    <>
                      <span className="font-semibold text-slate-700">คุณ</span>
                      <User size={14} className="text-slate-600" />
                    </>
                  ) : (
                    <>
                      <Bot size={16} className="text-purple-600" />
                      <span className="font-bold text-purple-900">AI Copilot</span>
                    </>
                  )}
                  <span>• {m.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-5 py-4 max-w-[95%] sm:max-w-[90%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white shadow-xs rounded-tr-xs text-sm md:text-base font-medium'
                      : 'bg-white border border-purple-200/90 text-slate-900 shadow-2xs rounded-tl-xs text-sm md:text-base'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Interactive Proposal Card within Assistant Message */}
                  {m.proposal && (
                    <div className="mt-4 pt-4 border-t border-purple-100 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5 text-sm">
                          <Sparkles size={16} className="text-purple-600" />
                          ข้อเสนอแนะเนื้อหาบทความ (Proposed Content)
                        </span>
                        <div className="flex items-center gap-1.5">
                          {m.proposal.format !== currentFormat && (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800">
                              {m.proposal.format === 'html' ? '⚡ HTML' : '📝 MARKDOWN'}
                            </span>
                          )}
                          {m.proposal.name && m.proposal.name !== currentTitle && (
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              ชื่อที่แนะนำ: {m.proposal.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Proposal Summary */}
                      <p className="text-sm text-purple-950 bg-purple-50/90 p-3.5 rounded-xl border border-purple-100/90 leading-relaxed font-medium">
                        {m.proposal.summary}
                      </p>

                      {/* Collapsible Content Preview */}
                      <div>
                        <button
                          type="button"
                          onClick={() => togglePreview(m.id)}
                          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-purple-700 hover:text-purple-950"
                        >
                          {m.previewOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                          <span>
                            {m.previewOpen ? 'ซ่อนตัวอย่างเนื้อหา' : 'ดูตัวอย่างเนื้อหาที่ AI ร่างไว้ (Preview Content)'}
                          </span>
                        </button>

                        {m.previewOpen && (
                          <div className="mt-3 p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs md:text-sm max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-700 shadow-inner">
                            {m.proposal.body}
                          </div>
                        )}
                      </div>

                      {/* Status Actions */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        {m.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApplyMessageProposal(m.id, 'replace')}
                              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                            >
                              <Check size={16} />
                              นำไปใช้ใน Editor (แทนที่ทั้งหมด)
                            </button>
                            {currentBody.trim() && (
                              <button
                                type="button"
                                onClick={() => handleApplyMessageProposal(m.id, 'append')}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 transition-colors"
                                title="เพิ่มเนื้อหาต่อท้ายบทความเดิมโดยไม่ลบของเดิม"
                              >
                                <PlusCircle size={16} />
                                เพิ่มต่อท้ายบทความ (Append)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDiscardMessageProposal(m.id)}
                              className="text-sm font-medium px-3.5 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </>
                        ) : m.status === 'applied' ? (
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                            <CheckCheck size={17} />
                            นำไปใช้ใน Editor แล้ว (Applied)
                          </span>
                        ) : m.status === 'appended' ? (
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-purple-700 bg-purple-50 px-4 py-2 rounded-xl border border-purple-200">
                            <PlusCircle size={17} />
                            เพิ่มต่อท้ายบทความแล้ว (Appended)
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400 italic">
                            ยกเลิกข้อเสนอแนะนี้แล้ว
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Thinking Bubble */}
          {loading && (
            <div className="flex items-center gap-3 p-4 text-sm font-medium text-purple-800 bg-white rounded-2xl border border-purple-200 shadow-2xs w-fit">
              <Loader2 size={18} className="animate-spin text-purple-600" />
              <span>AI Copilot กำลังคิด วิเคราะห์ และร่างเนื้อหาบทความ...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Persistent AI Chat Input Box (Spacious & Resizable) */}
        <div className="pt-1 flex-shrink-0">
          <div className="relative border-2 border-purple-300/90 rounded-2xl bg-white shadow-xs focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-200 transition-all">
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
              rows={isFullWorkspace ? 4 : 5}
              placeholder="พิมพ์คำสั่งหรือถามคำถามกับ AI Copilot ที่นี่... (เช่น 'ร่างบทความเรื่อง GKE Cluster Hardening ให้ละเอียด', 'จัดตารางและ Code block', 'แปลงเป็น HTML สวยงาม') [Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่]"
              disabled={loading}
              className="w-full text-sm md:text-base leading-relaxed p-3.5 md:p-4 rounded-t-2xl bg-transparent placeholder:text-slate-400 focus:outline-none resize-y min-h-[100px] md:min-h-[120px] max-h-[320px]"
            />
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/90 rounded-b-2xl border-t border-slate-100 flex-wrap gap-2">
              <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono shadow-2xs font-semibold">
                  Enter
                </kbd>{' '}
                ส่ง
                <span className="text-slate-300">•</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono shadow-2xs font-semibold">
                  Shift+Enter
                </kbd>{' '}
                ขึ้นบรรทัดใหม่
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !prompt.trim()}
                  className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="ส่งคำสั่งให้ Copilot"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      กำลังสร้างเนื้อหา...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      ส่งคำสั่ง (Send)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between flex-shrink-0">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 text-sm ml-3 font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleCopilotAssistant;
