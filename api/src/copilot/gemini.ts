import { GoogleGenAI, type FunctionDeclaration } from '@google/genai';

export type ChatAttachment =
  | { type: 'image'; mimeType: string; base64: string; originalName?: string }
  | { type: 'pdf'; mimeType: 'application/pdf'; base64: string; originalName?: string }
  | { type: 'text'; content: string; originalName?: string };

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
};

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

export type ProjectDraft = {
  name: string;
  description?: string;
  year?: number;
  status?: string;
  due?: string;
};

export type ArticleDraft = {
  name?: string;
  category?: string;
  body: string;
  format?: 'markdown' | 'html';
  summary?: string;
};

export type CopilotResult = {
  answer: string;
  draftProject?: ProjectDraft;
  draftArticles?: ArticleDraft[];
  draftArticle?: ArticleDraft;
  draftTask?: TaskDraft;
  draftTasks?: TaskDraft[];
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

const draftProjectTool: FunctionDeclaration = {
  name: 'draftProject',
  description: 'Draft a new project proposal with name, description, target year, status, and due date.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project name or title' },
      description: { type: 'string', description: 'Project summary, objectives, or scope' },
      year: { type: 'integer', description: 'Target year (e.g. 2026)' },
      status: {
        type: 'string',
        enum: ['New', 'On track', 'At risk', 'Completed'],
        description: 'Initial project status',
      },
      due: { type: 'string', description: 'Target due date in YYYY-MM-DD format' },
    },
    required: ['name'],
  },
};

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
      category: { type: 'string', description: 'Article category name (e.g. Architecture, SRE, DevSecOps, Runbook)' },
      body: { type: 'string', description: 'Complete content of the article in Markdown or HTML' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Format of the body content: markdown or html' },
      summary: { type: 'string', description: 'Concise explanation of what was drafted or changed' },
    },
    required: ['body'],
  },
};

const draftArticlesTool: FunctionDeclaration = {
  name: 'draftArticles',
  description: 'Draft one or more knowledge base articles, documentation, runbooks, or guides.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      articles: {
        type: 'array',
        description: 'List of knowledge base articles or documents',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Article title or document name' },
            category: {
              type: 'string',
              description: 'Category name (e.g. SRE, Architecture, DevSecOps, Incident Response, Runbook, General)',
            },
            body: { type: 'string', description: 'Complete content of the article in Markdown or HTML' },
            format: { type: 'string', enum: ['markdown', 'html'], description: 'Format of the body content' },
            summary: { type: 'string', description: 'Concise summary of what was drafted' },
          },
          required: ['name', 'body'],
        },
      },
    },
    required: ['articles'],
  },
};

const scaffoldWorkspaceTool: FunctionDeclaration = {
  name: 'scaffoldWorkspace',
  description:
    'Scaffold a complete workspace setup including a new project proposal, documentation/knowledge articles, and actionable tasks when the user requests creating a project along with tasks, documentation, and knowledge.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'object',
        description: 'New project proposal',
        properties: {
          name: { type: 'string', description: 'Project name' },
          description: { type: 'string', description: 'Project description and architecture overview' },
          year: { type: 'integer', description: 'Target year (e.g. 2026)' },
          status: { type: 'string', enum: ['New', 'On track', 'At risk', 'Completed'], description: 'Initial status' },
          due: { type: 'string', description: 'Target due date in YYYY-MM-DD' },
        },
        required: ['name'],
      },
      articles: {
        type: 'array',
        description: 'Knowledge articles or documentation to create for this project',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Article title or document name' },
            category: { type: 'string', description: 'Category (e.g. Architecture, SRE, DevSecOps, Runbook)' },
            body: { type: 'string', description: 'Full content in Markdown or HTML' },
            format: { type: 'string', enum: ['markdown', 'html'], description: 'Format' },
            summary: { type: 'string', description: 'Brief description' },
          },
          required: ['name', 'body'],
        },
      },
      tasks: {
        type: 'array',
        description: 'Actionable tasks for this project',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Task name or title' },
            phase: { type: 'string', description: 'Phase (Planning, Development, Testing, Launch, Audit)' },
            priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level' },
            start: { type: 'string', description: 'Start date in YYYY-MM-DD' },
            date: { type: 'string', description: 'Due date in YYYY-MM-DD' },
            description: { type: 'string', description: 'Detailed checklist or runbook notes' },
            ownerName: { type: 'string', description: 'Assigned owner name from team roster if known' },
          },
          required: ['name'],
        },
      },
      summary: { type: 'string', description: 'Overview explanation of the proposed workspace scaffolding' },
    },
    required: ['project'],
  },
};

export const realAskLLM: AskLLM = async (system, messages, opts = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new CopilotNotConfiguredError();
  const ai = new GoogleGenAI({ apiKey });
  // Map our history to Gemini "contents"; assistant → model role.
  const contents = messages.map((m) => {
    const parts: any[] = [];
    if (m.content) {
      parts.push({ text: m.content });
    }
    if (m.attachments && m.attachments.length > 0) {
      for (const att of m.attachments) {
        if (att.type === 'image' || att.type === 'pdf') {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64,
            },
          });
        } else if (att.type === 'text') {
          parts.push({
            text: att.content,
          });
        }
      }
    }
    if (parts.length === 0) {
      parts.push({ text: ' ' });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const toolChoice = opts.toolChoice || 'all';
  const tools: FunctionDeclaration[] = [];
  if (toolChoice === 'task') {
    tools.push(draftTaskTool, draftTasksTool);
  } else if (toolChoice === 'article') {
    tools.push(draftArticleTool, draftArticlesTool);
  } else if (toolChoice === 'all') {
    tools.push(
      scaffoldWorkspaceTool,
      draftProjectTool,
      draftArticlesTool,
      draftArticleTool,
      draftTasksTool,
      draftTaskTool,
    );
  }

  const res = await ai.models.generateContent({
    model: MODEL(),
    contents,
    config: {
      systemInstruction: system,
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    },
  });

  const fnCalls = res.functionCalls || [];
  let draftProject: ProjectDraft | undefined;
  let draftTask: TaskDraft | undefined;
  let draftTasks: TaskDraft[] | undefined;
  let draftArticle: ArticleDraft | undefined;
  let draftArticles: ArticleDraft[] | undefined;
  let summaryFromTool = '';

  for (const fnCall of fnCalls) {
    if (!fnCall || !fnCall.args) continue;
    if (fnCall.name === 'scaffoldWorkspace') {
      const args = fnCall.args as {
        project?: ProjectDraft;
        articles?: ArticleDraft[];
        tasks?: TaskDraft[];
        summary?: string;
      };
      if (args.project && args.project.name) {
        draftProject = args.project;
      }
      if (Array.isArray(args.articles) && args.articles.length > 0) {
        draftArticles = (draftArticles || []).concat(args.articles);
      }
      if (Array.isArray(args.tasks) && args.tasks.length > 0) {
        draftTasks = (draftTasks || []).concat(args.tasks);
      }
      if (args.summary) {
        summaryFromTool = args.summary;
      }
    } else if (fnCall.name === 'draftProject') {
      draftProject = fnCall.args as ProjectDraft;
    } else if (fnCall.name === 'draftTask') {
      draftTask = fnCall.args as TaskDraft;
    } else if (fnCall.name === 'draftTasks') {
      const rawTasks = (fnCall.args as { tasks?: TaskDraft[] })?.tasks;
      if (Array.isArray(rawTasks)) {
        draftTasks = (draftTasks || []).concat(rawTasks);
      }
    } else if (fnCall.name === 'draftArticle') {
      draftArticle = fnCall.args as ArticleDraft;
    } else if (fnCall.name === 'draftArticles') {
      const rawArticles = (fnCall.args as { articles?: ArticleDraft[] })?.articles;
      if (Array.isArray(rawArticles)) {
        draftArticles = (draftArticles || []).concat(rawArticles);
      }
    }
  }

  // Normalize articles and tasks arrays
  if (draftArticle && (!draftArticles || draftArticles.length === 0)) {
    draftArticles = [draftArticle];
  }
  if (draftTask && (!draftTasks || draftTasks.length === 0)) {
    draftTasks = [draftTask];
  }
  if (draftTasks && draftTasks.length > 0 && !draftTask) {
    draftTask = draftTasks[0];
  }
  if (draftArticles && draftArticles.length > 0 && !draftArticle) {
    draftArticle = draftArticles[0];
  }

  let answer = '';
  if (fnCalls.length === 0) {
    try {
      answer = res.text || '';
    } catch {
      answer = '';
    }
  } else if (summaryFromTool) {
    answer = summaryFromTool;
  }

  if (!answer) {
    const items: string[] = [];
    if (draftProject) {
      items.push(`project proposal for "${draftProject.name}"`);
    }
    if (draftArticles && draftArticles.length > 0) {
      items.push(`${draftArticles.length} documentation/knowledge article(s)`);
    }
    if (draftTasks && draftTasks.length > 0) {
      items.push(`${draftTasks.length} task proposal(s)`);
    }
    if (items.length > 0) {
      answer = `I've prepared ${items.join(', ')}. Please review and confirm below.`;
    }
  }

  if (!answer && !draftProject && !draftTask && !draftTasks && !draftArticle && !draftArticles) {
    throw new Error('Empty response from Gemini');
  }

  return { answer, draftProject, draftArticles, draftArticle, draftTask, draftTasks };
};
