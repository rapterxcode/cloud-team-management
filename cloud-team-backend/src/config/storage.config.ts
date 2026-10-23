import { envInt, envList, envString } from './env-loader.js';

const DEFAULT_ATTACHMENT_EXTS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.txt',
];

const DEFAULT_COPILOT_EXTS = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
  '.pdf',
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp', '.rtf',
  '.msg', '.eml',
  '.txt', '.csv', '.json', '.md', '.log', '.yaml', '.yml', '.sql', '.sh', '.ts', '.js', '.py', '.html', '.xml',
];

export const storageConfig = {
  get attachmentsDir() {
    return envString('ATTACHMENTS_DIR', './attachments-dev');
  },
  get maxAttachmentBytes() {
    return envInt('MAX_ATTACHMENT_BYTES', 25 * 1024 * 1024);
  },
  get maxCopilotFileBytes() {
    return envInt('MAX_COPILOT_FILE_BYTES', 15 * 1024 * 1024);
  },
  get allowedAttachmentExts() {
    return new Set(envList('ALLOWED_ATTACHMENT_EXTS', DEFAULT_ATTACHMENT_EXTS));
  },
  get allowedCopilotExts() {
    return new Set(envList('ALLOWED_COPILOT_EXTS', DEFAULT_COPILOT_EXTS));
  },
  get backupRetentionDays() {
    return envInt('BACKUP_RETENTION_DAYS', 14);
  },
};
