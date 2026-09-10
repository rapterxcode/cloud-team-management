import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { api, post } from '@/lib/api';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && enabled === null)
      api<{ enabled: boolean }>('/copilot/status').then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false));
  }, [open, enabled]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history = messages.slice(-10);
    setMessages([...messages, { role: 'user', content: question }]);
    setInput('');
    setBusy(true);
    try {
      const { answer } = await post<{ answer: string }>('/copilot', { question, history });
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="copilot-scrim" onClick={onClose}>
      <aside className="copilot-panel" onClick={(e) => e.stopPropagation()} aria-label="AI Copilot">
        <header className="copilot-head">
          <span className="brand-icon"><Sparkles size={18} /></span>
          <strong>Copilot</strong>
          <button aria-label="Close" className="text-button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="copilot-body">
          {enabled === false && <p className="empty">Copilot isn't configured yet. Ask an admin to set a Gemini API key.</p>}
          {enabled !== false && messages.length === 0 && <p className="empty">Ask about your projects, tasks, team, resources or knowledge.</p>}
          {messages.map((m, i) => <div key={i} className={'copilot-msg ' + m.role}>{m.content}</div>)}
          {busy && <div className="copilot-msg assistant thinking">Thinking…</div>}
          <div ref={endRef} />
        </div>
        <form className="copilot-input" onSubmit={send}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            rows={2}
            disabled={enabled === false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
          <button className="primary" type="submit" disabled={busy || enabled === false} aria-label="Send"><Send size={16} /></button>
        </form>
      </aside>
    </div>
  );
}
