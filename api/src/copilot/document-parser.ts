import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { OfficeParser } from 'officeparser';
import MsgReaderPkg from '@kenjiuno/msgreader';

const MsgReader = (MsgReaderPkg as any).default || MsgReaderPkg;

export type ParsedAttachment =
  | { type: 'image'; mimeType: string; base64: string; originalName: string }
  | { type: 'pdf'; mimeType: 'application/pdf'; base64: string; originalName: string }
  | { type: 'text'; originalName: string; content: string };

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const OFFICE_EXTS = new Set(['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp', '.rtf']);

export async function parseAttachmentFile(
  filePath: string,
  originalName: string,
  mimeType: string
): Promise<ParsedAttachment> {
  const ext = extname(originalName).toLowerCase();

  // 1. Images -> base64
  if (IMAGE_EXTS.has(ext) || (mimeType && mimeType.startsWith('image/'))) {
    const buf = await readFile(filePath);
    const resolvedMime =
      mimeType && mimeType.startsWith('image/')
        ? mimeType
        : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
        ? 'image/gif'
        : ext === '.svg'
        ? 'image/svg+xml'
        : 'image/jpeg';
    return {
      type: 'image',
      mimeType: resolvedMime,
      base64: buf.toString('base64'),
      originalName,
    };
  }

  // 2. PDF -> base64
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const buf = await readFile(filePath);
    return {
      type: 'pdf',
      mimeType: 'application/pdf',
      base64: buf.toString('base64'),
      originalName,
    };
  }

  // 3. Outlook .msg
  if (ext === '.msg') {
    try {
      const buf = await readFile(filePath);
      const reader = new MsgReader(buf);
      const msg = reader.getFileData();
      const subject = msg.subject || '(No Subject)';
      const from = msg.senderName
        ? `${msg.senderName} <${msg.senderEmail || ''}>`
        : msg.senderEmail || 'Unknown';
      const to = Array.isArray(msg.recipients)
        ? msg.recipients.map((r: any) => r.name || r.email).filter(Boolean).join(', ')
        : '(None)';
      const body = msg.body || '(Empty body)';
      const formatted = `=== OUTLOOK EMAIL: ${originalName} ===\nSubject: ${subject}\nFrom: ${from}\nTo: ${to}\n\n${body}\n=== END EMAIL ===`;
      return {
        type: 'text',
        originalName,
        content: formatted,
      };
    } catch (e) {
      return {
        type: 'text',
        originalName,
        content: `[Could not parse Outlook .msg file ${originalName}: ${e instanceof Error ? e.message : 'Invalid MSG format'}]`,
      };
    }
  }

  // 4. Standard .eml (Email)
  if (ext === '.eml') {
    try {
      const text = await readFile(filePath, 'utf-8');
      return {
        type: 'text',
        originalName,
        content: `=== EMAIL MESSAGE (.eml): ${originalName} ===\n${text.slice(0, 50000)}\n=== END EMAIL ===`,
      };
    } catch (e) {
      return {
        type: 'text',
        originalName,
        content: `[Could not read .eml file ${originalName}: ${e instanceof Error ? e.message : 'Read error'}]`,
      };
    }
  }

  // 5. Office Documents (.docx, .xlsx, .pptx, etc.)
  if (OFFICE_EXTS.has(ext)) {
    try {
      const ast = await OfficeParser.parseOffice(filePath);
      let parsedText = '';
      try {
        const mdRes = await ast.to('md');
        parsedText = typeof mdRes.value === 'string' ? mdRes.value : '';
      } catch {
        const textRes = await ast.to('text');
        parsedText = typeof textRes.value === 'string' ? textRes.value : '';
      }
      if (!parsedText.trim() && typeof (ast as any).toText === 'function') {
        parsedText = (ast as any).toText();
      }
      const label = ext.includes('xls')
        ? 'EXCEL SPREADSHEET'
        : ext.includes('ppt')
        ? 'POWERPOINT PRESENTATION'
        : 'WORD DOCUMENT';
      return {
        type: 'text',
        originalName,
        content: `=== ${label}: ${originalName} ===\n${parsedText.slice(0, 100000)}\n=== END DOCUMENT ===`,
      };
    } catch (e) {
      return {
        type: 'text',
        originalName,
        content: `[Could not parse Office document ${originalName}: ${e instanceof Error ? e.message : 'Unknown error'}]`,
      };
    }
  }

  // 6. Text, Code, Log, JSON, YAML, SQL, Shell, CSV
  try {
    const text = await readFile(filePath, 'utf-8');
    return {
      type: 'text',
      originalName,
      content: `=== ATTACHED FILE (${ext || 'text'}): ${originalName} ===\n${text.slice(0, 60000)}\n=== END ATTACHED FILE ===`,
    };
  } catch (e) {
    return {
      type: 'text',
      originalName,
      content: `[Could not read file ${originalName} as text: ${e instanceof Error ? e.message : 'Read error'}]`,
    };
  }
}
