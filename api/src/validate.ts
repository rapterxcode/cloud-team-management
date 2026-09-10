export const PROJECT_STATUSES = ['On track', 'At risk'];
export const PHASES = ['Planning', 'Development', 'Launch'];
export const TASK_STATUSES = ['To do', 'In progress', 'Done'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const CATEGORIES = ['Guides', 'Runbooks', 'Onboarding', 'Meeting notes'];
export const AUDIT_CATEGORIES = ['CR', 'CC', 'CRA', 'Diagram', 'RBAC', 'TestEvidence', 'General'] as const;
export const DOCUMENT_EXTS = new Set(['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.svg', '.csv', '.zip', '.yaml', '.json', '.txt']);
export function badRequest(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

export function assertIn(value: unknown, list: string[], label: string) {
  if (!list.includes(String(value))) throw badRequest(`${label} must be one of: ${list.join(', ')}`);
}

// Mirrors web/src/lib/gantt.mjs exactly — messages must stay in sync.
const DAY = 86400000;
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('Enter a valid date.');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw badRequest('Enter a valid date.');
  return time / DAY;
}
export function validateDates(start: string, end: string) {
  if (!start && !end) return true;
  if (!start || !end) throw badRequest('Enter both a start and finish date, or leave both empty.');
  if (day(end) < day(start)) throw badRequest('Finish must be on or after start.');
  return true;
}
