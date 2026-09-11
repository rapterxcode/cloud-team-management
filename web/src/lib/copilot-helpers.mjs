export const COPILOT_QUICK_ACTIONS = [
  {
    id: 'exec-report',
    label: '📊 สรุปรายงานผู้บริหาร',
    prompt: 'โปรดจัดทำ Executive Status Report สรุปภาพรวมความคืบหน้าของโครงการทั้งหมด งานสำคัญที่ทำเสร็จ และงานที่มีความเสี่ยง พร้อมข้อเสนอแนะเชิงกลยุทธ์',
  },
  {
    id: 'risk-analysis',
    label: '⚠️ วิเคราะห์โครงการ At-Risk',
    prompt: 'โปรดวิเคราะห์โครงการและงานที่มีความเสี่ยงล่าช้า (At-risk) หรืองานที่ใกล้ถึง Due Date พร้อมคำแนะนำแนวทางแก้ไขและการลดผลกระทบ',
  },
  {
    id: 'workload-balance',
    label: '👥 เช็คภาระงานทีม (Workload)',
    prompt: 'โปรดวิเคราะห์การกระจาย Workload ของสมาชิกในทีม ว่าใครมีภาระงานสูงเกิน 80% หรือใครมี Capacity ว่าง พร้อมคำแนะนำการกระจายงานให้สมดุล',
  },
  {
    id: 'extract-tasks',
    label: '📋 สกัด Tasks จาก Runbook',
    prompt: 'โปรดสกัดขั้นตอนและ Checklist การปฏิบัติงานออกมาเป็นชุด Tasks พร้อมระบุ Phase, Priority, วันที่ และคำแนะนำการปฏิบัติงาน',
  },
];

export function normalizeBatchDraftTasks(draftTasks, draftTask) {
  const list = Array.isArray(draftTasks) && draftTasks.length > 0
    ? draftTasks
    : (draftTask && draftTask.name ? [draftTask] : []);

  return list
    .filter(t => t && typeof t === 'object' && String(t.name || '').trim().length > 0)
    .map(t => ({
      name: String(t.name).trim(),
      projectId: t.projectId || '',
      projectName: t.projectName || '',
      ownerId: t.ownerId || '',
      ownerName: t.ownerName || '',
      phase: t.phase || 'Planning',
      priority: t.priority || 'Medium',
      start: t.start || '',
      date: t.date || '',
      description: t.description || '',
    }));
}

export function extractReportTitle(content) {
  if (!content || typeof content !== 'string') return 'Executive Workspace Report';
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim().replace(/[*_~`]/g, '');
  }
  const firstLine = content.trim().split('\n')[0];
  if (firstLine && firstLine.length <= 80) {
    return firstLine.replace(/[*_~`#]/g, '').trim();
  }
  return 'Executive Workspace Report';
}

export function isSubstantiveReport(content) {
  if (!content || typeof content !== 'string') return false;
  const lines = content.trim().split('\n').length;
  const wordCount = content.trim().split(/\s+/).length;
  // Consider substantive if more than 6 lines or > 50 words and contains Markdown indicators (headers, bullet points, or tables)
  return (lines >= 6 || wordCount >= 50) && /(^#|\n- |\n\* |\|.*\|)/m.test(content);
}

export function groupConversationsByDate(conversations) {
  if (!Array.isArray(conversations)) return { today: [], yesterday: [], earlier: [] };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const today = [];
  const yesterday = [];
  const earlier = [];

  for (const c of conversations) {
    const time = new Date(c.updatedAt || c.createdAt).getTime();
    if (time >= todayStart) {
      today.push(c);
    } else if (time >= yesterdayStart) {
      yesterday.push(c);
    } else {
      earlier.push(c);
    }
  }

  return { today, yesterday, earlier };
}

