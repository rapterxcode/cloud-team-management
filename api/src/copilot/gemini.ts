import { GoogleGenAI, type FunctionDeclaration } from '@google/genai';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type TaskDraft = {
  name: string;
  projectName?: string;
  projectId?: string;
  ownerName?: string;
  ownerId?: string;
  phase?: string;
  priority?: string;
  start?: string;
  date?: string;
  description?: string;
};

export type ArticleDraft = {
  name?: string;
  body: string;
  format?: 'markdown' | 'html';
  summary?: string;
};

export type CopilotResult = {
  answer: string;
  draftTask?: TaskDraft;
  draftTasks?: TaskDraft[];
  draftArticle?: ArticleDraft;
};

export type AskLLM = (
  system: string,
  messages: ChatMessage[],
  opts?: { toolChoice?: 'task' | 'article' | 'all' }
) => Promise<CopilotResult | string>;

export class CopilotNotConfiguredError extends Error {
  constructor() {
    super('Copilot is not configured');
    this.name = 'CopilotNotConfiguredError';
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const draftTaskTool: FunctionDeclaration = {
  name: 'draftTask',
  description: 'Draft a single task to be added to a project when the user asks to create, schedule, or assign a single task.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Task name or title' },
      projectName: { type: 'string', description: 'Target project name from workspace data' },
      ownerName: { type: 'string', description: 'Assigned owner/member name from workspace data' },
      phase: { type: 'string', description: 'Phase of the task (e.g. Planning, Development, Testing, Launch, Audit)' },
      priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level' },
      start: { type: 'string', description: 'Start date in YYYY-MM-DD format if specified' },
      date: { type: 'string', description: 'Finish or due date in YYYY-MM-DD format if specified' },
      description: { type: 'string', description: 'Detailed runbook notes, checklist, or instructions for the task' },
    },
    required: ['name'],
  },
};

const draftTasksTool: FunctionDeclaration = {
  name: 'draftTasks',
  description:
    'Draft multiple actionable tasks to be added to projects when the user asks to create, schedule, break down, or extract multiple tasks from instructions, runbooks, or plans.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'Array of actionable task proposals',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Task name or title' },
            projectName: { type: 'string', description: 'Target project name from workspace data' },
            ownerName: { type: 'string', description: 'Assigned owner/member name from workspace data' },
            phase: { type: 'string', description: 'Phase of the task (e.g. Planning, Development, Testing, Launch, Audit)' },
            priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level' },
            start: { type: 'string', description: 'Start date in YYYY-MM-DD format if specified' },
            date: { type: 'string', description: 'Finish or due date in YYYY-MM-DD format if specified' },
            description: { type: 'string', description: 'Detailed runbook notes, checklist, or instructions for the task' },
          },
          required: ['name'],
        },
      },
    },
    required: ['tasks'],
  },
};

const draftArticleTool: FunctionDeclaration = {
  name: 'draftArticle',
  description:
    'Draft or modify a knowledge base article in markdown or interactive HTML format, providing the article name, content body, format, and an explanation summary of what was generated or changed.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Title or name of the knowledge article' },
      body: { type: 'string', description: 'Complete content of the article in Markdown or HTML' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Format of the body content: markdown or html' },
      summary: { type: 'string', description: 'Concise explanation of what was drafted or changed' },
    },
    required: ['body'],
  },
};

export const realAskLLM: AskLLM = async (system, messages, opts = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new CopilotNotConfiguredError();
  const ai = new GoogleGenAI({ apiKey });
  // Map our history to Gemini "contents"; assistant → model role.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const toolChoice = opts.toolChoice || 'all';
  const tools: FunctionDeclaration[] = [];
  if (toolChoice === 'task' || toolChoice === 'all') {
    tools.push(draftTaskTool, draftTasksTool);
  }
  if (toolChoice === 'article' || toolChoice === 'all') {
    tools.push(draftArticleTool);
  }

  const res = await ai.models.generateContent({
    model: MODEL(),
    contents,
    config: {
      systemInstruction: system,
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    },
  });

  const fnCall = res.functionCalls?.[0];
  let draftTask: TaskDraft | undefined;
  let draftTasks: TaskDraft[] | undefined;
  let draftArticle: ArticleDraft | undefined;
  if (fnCall && fnCall.name === 'draftTask' && fnCall.args) {
    draftTask = fnCall.args as TaskDraft;
  } else if (fnCall && fnCall.name === 'draftTasks' && fnCall.args) {
    const rawTasks = (fnCall.args as { tasks?: TaskDraft[] })?.tasks;
    if (Array.isArray(rawTasks)) {
      draftTasks = rawTasks;
    }
  } else if (fnCall && fnCall.name === 'draftArticle' && fnCall.args) {
    draftArticle = fnCall.args as ArticleDraft;
  }

  let answer = '';
  if (!fnCall) {
    try {
      answer = res.text || '';
    } catch {
      answer = '';
    }
  }

  if (!answer && draftTasks && draftTasks.length > 0) {
    answer = `I've prepared ${draftTasks.length} task proposals. Please review and confirm below.`;
  } else if (!answer && draftTask) {
    answer = `I've prepared a draft for "${draftTask.name}". Please review and confirm below.`;
  } else if (!answer && draftArticle) {
    answer = draftArticle.summary || `I've prepared a draft for "${draftArticle.name || 'the article'}". Please review and confirm below.`;
  }
  if (!answer && !draftTask && !draftTasks && !draftArticle) {
    throw new Error('Empty response from Gemini');
  }

  return { answer, draftTask, draftTasks, draftArticle };
};
