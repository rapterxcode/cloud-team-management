import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { destroy, uploadFile } from '@/lib/api';
import type { Article, Attachment } from '@/lib/types';

const fmt = (bytes: number) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

export default function ArticleAttachments({ article, onChange }: { article: Article; onChange: (a: Article) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const att = await uploadFile<Attachment>(`/knowledge/${article.id}/attachments`, file);
      onChange({ ...article, attachments: [...article.attachments, att] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const remove = async (id: string) => {
    await destroy(`/attachments/${id}`);
    onChange({ ...article, attachments: article.attachments.filter((a) => a.id !== id) });
  };

  return (
    <div className="attachments">
      <h3><Paperclip size={14} /> Attachments</h3>
      {article.attachments.length === 0 && <p className="empty">No files attached.</p>}
      <ul>
        {article.attachments.map((a) => (
          <li key={a.id}>
            <a href={`/api/attachments/${a.id}/download`}>{a.originalName}</a>
            <small> {fmt(a.sizeBytes)}</small>
            <button className="text-button" onClick={() => remove(a.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
