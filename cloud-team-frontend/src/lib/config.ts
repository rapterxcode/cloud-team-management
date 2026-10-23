import { api } from './api';

export interface PublicRuntimeConfig {
  app: {
    domain: string;
    environment: string;
  };
  limits: {
    maxAttachmentBytes: number;
    maxCopilotFileBytes: number;
    jsonBodyLimit: string;
    passwordMinLength: number;
  };
  ai: {
    enabled: boolean;
    model: string;
    snapshotBudget: number;
  };
}

const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const envConfig = {
  apiBaseUrl: metaEnv.VITE_API_BASE_URL || '/api',
  appName: metaEnv.VITE_APP_NAME || 'Cloud Team Management',
};

export const defaultClientConfig: PublicRuntimeConfig = {
  app: {
    domain: metaEnv.VITE_DOMAIN || 'localhost',
    environment: metaEnv.MODE || 'development',
  },
  limits: {
    maxAttachmentBytes: Number(metaEnv.VITE_MAX_ATTACHMENT_BYTES) || 25 * 1024 * 1024,
    maxCopilotFileBytes: Number(metaEnv.VITE_MAX_COPILOT_FILE_BYTES) || 15 * 1024 * 1024,
    jsonBodyLimit: metaEnv.VITE_JSON_BODY_LIMIT || '256kb',
    passwordMinLength: Number(metaEnv.VITE_PASSWORD_MIN_LENGTH) || 10,
  },
  ai: {
    enabled: true,
    model: metaEnv.VITE_GEMINI_MODEL || 'gemini-3.8-flash',
    snapshotBudget: Number(metaEnv.VITE_COPILOT_SNAPSHOT_BUDGET) || 1_000_000,
  },
};

export async function fetchRuntimeConfig(): Promise<PublicRuntimeConfig> {
  try {
    return await api<PublicRuntimeConfig>('/config');
  } catch {
    return defaultClientConfig;
  }
}
