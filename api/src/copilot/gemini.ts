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

export type CopilotResult = {
  answer: string;
  draftTask?: TaskDraft;
};

export type AskLLM = (system: string, messages: ChatMessage[]) => Promise<CopilotResult | string>;

export class CopilotNotConfiguredError extends Error {
  constructor() {
    super('Copilot is not configured');
    this.name = 'CopilotNotConfiguredError';
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const draftTaskTool: FunctionDeclaration = {
  name: 'draftTask',
  description: 'Draft a task to be added to a project when the user asks to create, schedule, or assign a task.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Task name or title' },
      projectName: { type: 'string', description: 'Target project name from workspace data' },
      ownerName: { type: 'string', description: 'Assigned owner/member name from workspace data' },
      phase: { type: 'string', enum: ['Planning', 'Development', 'Launch'], description: 'Phase of the task' },
      priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level' },
      start: { type: 'string', description: 'Start date in YYYY-MM-DD format if specified' },
      date: { type: 'string', description: 'Finish or due date in YYYY-MM-DD format if specified' },
      description: { type: 'string', description: 'Detailed runbook notes, checklist, or instructions for the task' },
    },
    required: ['name'],
  },
};

export const realAskLLM: AskLLM = async (system, messages) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new CopilotNotConfiguredError();
  const ai = new GoogleGenAI({ apiKey });
  // Map our history to Gemini "contents"; assistant → model role.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await ai.models.generateContent({
    model: MODEL(),
    contents,
    config: {
      systemInstruction: system,
      tools: [{ functionDeclarations: [draftTaskTool] }],
    },
  });

  const fnCall = res.functionCalls?.[0];
  let draftTask: TaskDraft | undefined;
  if (fnCall && fnCall.name === 'draftTask' && fnCall.args) {
    draftTask = fnCall.args as TaskDraft;
  }

  let answer = res.text || '';
  if (!answer && draftTask) {
    answer = `I've prepared a draft for "${draftTask.name}". Please review and confirm below.`;
  }
  if (!answer && !draftTask) {
    throw new Error('Empty response from Gemini');
  }

  return { answer, draftTask };
};
