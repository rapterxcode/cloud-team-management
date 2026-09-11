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
      setMessages((prev) => [
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
        className={`mb-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50/90 via-white to-purple-50/70 hover:from-purple-100 hover:to-purple-100/80 p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-xs group ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-105 transition-transform">
            <Sparkles size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-purple-950">AI Copilot Assistant (Smart Editor)</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                คลิกเพื่อเปิดใช้งาน
              </span>
              {messages.length > 0 && (
                <span className="text-xs bg-purple-200/90 text-purple-900 px-2 py-0.5 rounded-full font-bold">
                  {messages.length} ข้อความ
                </span>
              )}
            </div>
            <p className="text-xs text-purple-700 mt-0.5">
              ผู้ช่วย AI อัจฉริยะ: ร่างเนื้อหาทั้งบทความ, เพิ่ม Checklist / Runbook, จัด Code และแปลงเป็น HTML สวยงาม
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-white hover:bg-purple-50 px-3.5 py-2 rounded-lg border border-purple-200 shadow-2xs transition-colors"
        >
          <span>เปิดกล่อง AI Chat</span>
          <ChevronDown size={15} />
        </button>
      </div>
    );
  }

  // 2. Full Expanded AI Chat Box (Spacious, Roomy, Comfortable)
  return (
    <div
      id="article-copilot-assistant"
      className={`mb-4 rounded-xl border border-purple-200/90 bg-gradient-to-b from-purple-50/70 via-white to-white shadow-sm overflow-hidden transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-50/90 border-b border-purple-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Sparkles size={15} />
          </span>
          <div>
            <span className="text-sm font-bold text-purple-950">AI Copilot Assistant</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/80">
              Smart Editor Chat
            </span>
            {messages.length > 0 && (
              <span className="ml-2 text-xs font-semibold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full">
                {messages.length} ข้อความ
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-md transition-colors"
              title="ล้างประวัติการสนทนา"
            >
              <Trash2 size={13} />
              <span>ล้างแชท</span>
            </button>
          )}

          {canRevert && onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-md border border-amber-200 transition-colors"
              title="ยกเลิกการแก้ไขล่าสุดของ AI"
            >
              <RotateCcw size={13} />
              ย้อนกลับ (Revert)
            </button>
          )}

          <button
            type="button"
            onClick={() => toggleOpen(false)}
            className="text-purple-700 hover:text-purple-950 p-1.5 rounded-md hover:bg-purple-100/80 transition-colors"
            aria-label="ย่อขนาด AI Chat"
            title="ย่อขนาด AI Chat"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Multi-Turn Conversation Thread */}
        {messages.length > 0 && (
          <div className="space-y-3.5 max-h-96 min-h-[140px] overflow-y-auto pr-1 p-4 rounded-xl bg-slate-50/90 border border-purple-100 text-sm shadow-inner">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                } space-y-1`}
              >
                {/* Sender Header */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 px-1">
                  {m.role === 'user' ? (
                    <>
                      <span className="font-medium">คุณ</span>
                      <User size={13} className="text-slate-600" />
                    </>
                  ) : (
                    <>
                      <Bot size={14} className="text-purple-600" />
                      <span className="font-bold text-purple-900">AI Copilot</span>
                    </>
                  )}
                  <span>• {m.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[95%] sm:max-w-[88%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white shadow-xs rounded-tr-xs text-sm font-medium'
                      : 'bg-white border border-purple-200/90 text-slate-900 shadow-2xs rounded-tl-xs text-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Interactive Proposal Card within Assistant Message */}
                  {m.proposal && (
                    <div className="mt-3.5 pt-3 border-t border-purple-100 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5 text-xs">
                          <Sparkles size={14} className="text-purple-600" />
                          ข้อเสนอแนะเนื้อหาบทความ (Proposed Content)
                        </span>
                        <div className="flex items-center gap-1.5">
                          {m.proposal.format !== currentFormat && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                              {m.proposal.format === 'html' ? '⚡ HTML' : '📝 MARKDOWN'}
                            </span>
                          )}
                          {m.proposal.name && m.proposal.name !== currentTitle && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              ชื่อที่แนะนำ: {m.proposal.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Proposal Summary */}
                      <p className="text-xs text-purple-950 bg-purple-50/80 p-2.5 rounded-lg border border-purple-100/90 leading-relaxed font-medium">
                        {m.proposal.summary}
                      </p>

                      {/* Collapsible Content Preview */}
                      <div>
                        <button
                          type="button"
                          onClick={() => togglePreview(m.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-950"
                        >
                          {m.previewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>
                            {m.previewOpen ? 'ซ่อนตัวอย่างเนื้อหา' : 'ดูตัวอย่างเนื้อหาที่ AI ร่างไว้ (Preview Content)'}
                          </span>
                        </button>

                        {m.previewOpen && (
                          <div className="mt-2 p-3.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs md:text-sm max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-700 shadow-inner">
                            {m.proposal.body}
                          </div>
                        )}
                      </div>

                      {/* Status Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        {m.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApplyMessageProposal(m.id, 'replace')}
                              className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
                            >
                              <Check size={14} />
                              นำไปใช้ใน Editor (แทนที่ทั้งหมด)
                            </button>
                            {currentBody.trim() && (
                              <button
                                type="button"
                                onClick={() => handleApplyMessageProposal(m.id, 'append')}
                                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 transition-colors"
                                title="เพิ่มเนื้อหาต่อท้ายบทความเดิมโดยไม่ลบของเดิม"
                              >
                                <PlusCircle size={14} />
                                เพิ่มต่อท้ายบทความ (Append)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDiscardMessageProposal(m.id)}
                              className="text-xs md:text-sm font-medium px-2.5 py-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </>
                        ) : m.status === 'applied' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                            <CheckCheck size={14} />
                            นำไปใช้ใน Editor แล้ว (Applied)
                          </span>
                        ) : m.status === 'appended' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-md border border-purple-200">
                            <PlusCircle size={14} />
                            เพิ่มต่อท้ายบทความแล้ว (Appended)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            ยกเลิกข้อเสนอแนะนี้แล้ว
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
              <div className="flex items-center gap-2.5 p-3 text-sm font-medium text-purple-800 bg-white rounded-xl border border-purple-200 shadow-2xs w-fit">
                <Loader2 size={16} className="animate-spin text-purple-600" />
                <span>AI Copilot กำลังคิด วิเคราะห์ และร่างเนื้อหาบทความ...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Quick Preset Action Chips */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
            <span>คำสั่งด่วน 1 คลิก (Quick Actions):</span>
            {messages.length === 0 && (
              <span className="text-xs font-normal text-purple-700">
                เลือกคำสั่งด่วนด้านล่าง หรือพิมพ์คำสั่งอิสระในช่องแชท
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {COPILOT_ARTICLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => handlePresetClick(preset.id)}
                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium px-3 py-1.5 rounded-lg border border-purple-200/90 bg-white hover:bg-purple-50 text-purple-950 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Persistent AI Chat Input Box (Spacious & Prominent) */}
        <div className="pt-1">
          <div className="relative border-2 border-purple-300 rounded-xl bg-white shadow-xs focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-200 transition-all">
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
              rows={3}
              placeholder="พิมพ์คำสั่งหรือถาม AI Copilot... (เช่น 'ร่างบทความฉบับเต็ม', 'เพิ่มหัวข้อ Troubleshooting', 'แปลงเป็น HTML Tailwind สวยงาม') [กด Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่]"
              disabled={loading}
              className="w-full text-sm leading-relaxed px-4 py-3 rounded-t-xl bg-transparent placeholder:text-slate-400 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/90 rounded-b-xl border-t border-slate-100">
              <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono shadow-2xs font-semibold">
                  Enter
                </kbd>{' '}
                ส่งข้อความ
                <span className="text-slate-300">•</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono shadow-2xs font-semibold">
                  Shift+Enter
                </kbd>{' '}
                ขึ้นบรรทัดใหม่
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !prompt.trim()}
                  className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="ส่งคำสั่งให้ Copilot"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      กำลังทำงาน...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
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
          <div className="text-xs md:text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 text-xs ml-3 font-bold"
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
