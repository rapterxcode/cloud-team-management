/**
 * Knowledge Article AI Copilot Presets and Prompt Builders
 */

export const COPILOT_ARTICLE_PRESETS = [
  {
    id: 'draft',
    label: '⚡ Draft from Title',
    description: 'Generate a structured article draft based on the title and category',
    buildPrompt: ({ name, category }) =>
      `Generate a comprehensive, production-grade ${category || 'technical'} article titled "${name || 'Untitled Article'}". Include an overview, prerequisites, step-by-step procedures, configuration examples with syntax-highlighted code blocks, and verification instructions.`,
  },
  {
    id: 'checklist',
    label: '📝 Add Checklist',
    description: 'Append a step-by-step verification and rollback checklist',
    buildPrompt: () =>
      'Append a clear, operational verification and rollback checklist section with interactive checkboxes (- [ ]) for pre-flight checks, execution verification, and rollback procedures.',
  },
  {
    id: 'format-code',
    label: '🛠️ Format Code & Tables',
    description: 'Format code blocks with language syntax and clean table alignments',
    buildPrompt: () =>
      'Refactor and clean up all code snippets into proper fenced code blocks with explicit language tags (e.g. ```bash, ```yaml, ```json), align markdown tables, and improve heading hierarchy.',
  },
  {
    id: 'convert-html',
    label: '🎨 Convert to HTML + Tailwind',
    description: 'Convert Markdown into modern styled HTML with Tailwind CSS classes',
    buildPrompt: () =>
      'Convert this entire article into clean, responsive, modern semantic HTML styled with Tailwind CSS classes (including cards, badges, styled tables, and code snippets). Set format to html.',
  },
  {
    id: 'executive-summary',
    label: '📋 Add Executive Summary',
    description: 'Add a concise summary callout and key takeaways at the top',
    buildPrompt: () =>
      'Add an Executive Summary section at the very top with key objectives, target audience, and bullet points of high-level takeaways or architectural impact.',
  },
  {
    id: 'polish',
    label: '🔍 Polish & Proofread',
    description: 'Enhance clarity, fix grammar, and improve technical precision',
    buildPrompt: () =>
      'Proofread and polish the article for high technical clarity, professional tone, active voice, and concise explanations without altering the technical facts or procedures.',
  },
  {
    id: 'runbook',
    label: '🚒 Add Runbook Steps',
    description: 'Add emergency response, triage commands, and escalation procedures',
    buildPrompt: () =>
      'Add a dedicated Incident Response & Operational Runbook section with alert triggers, immediate triage CLI commands, escalation contacts, and step-by-step resolution workflows.',
  },
];

/**
 * Builds the prompt string to send to POST /api/copilot/article
 *
 * @param {string} presetId - ID of preset action, or empty/custom
 * @param {object} context - Article context
 * @param {string} [context.name] - Article name/title
 * @param {string} [context.category] - Article category
 * @param {string} [context.format] - 'markdown' | 'html'
 * @param {string} [context.currentBody] - Current body content
 * @param {string} [context.customPrompt] - User's free-form prompt
 * @returns {string} Prompt string
 */
export function buildArticleCopilotPrompt(presetId, context = {}) {
  const { name = '', category = '', customPrompt = '' } = context;
  if (customPrompt && customPrompt.trim()) {
    return customPrompt.trim();
  }
  const preset = COPILOT_ARTICLE_PRESETS.find((p) => p.id === presetId);
  if (preset) {
    return preset.buildPrompt({ name: name.trim(), category: category.trim() });
  }
  return `Draft or improve the knowledge article "${name || 'Untitled'}"`;
}
