import { GoogleGenAI } from '@google/genai';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AskLLM = (system: string, messages: ChatMessage[]) => Promise<string>;

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
    config: { systemInstruction: system },
  });
  const text = res.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
};
