import { loadEnv } from './env-loader.js';
import { appConfig } from './app.config.js';
import { dbConfig } from './database.config.js';
import { authConfig } from './auth.config.js';
import { storageConfig } from './storage.config.js';
import { aiConfig } from './ai.config.js';

export { loadEnv, appConfig, dbConfig, authConfig, storageConfig, aiConfig };

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

/**
 * Modernized, domain-namespaced configuration registry (12-Factor Architecture).
 */
export const config = {
  app: appConfig,
  db: dbConfig,
  auth: authConfig,
  storage: storageConfig,
  ai: aiConfig,

  /**
   * Returns sanitized, non-sensitive runtime configuration safe for client consumption (`GET /api/config`).
   */
  getPublicRuntimeConfig(): PublicRuntimeConfig {
    return {
      app: {
        domain: appConfig.domain,
        environment: appConfig.nodeEnv,
      },
      limits: {
        maxAttachmentBytes: storageConfig.maxAttachmentBytes,
        maxCopilotFileBytes: storageConfig.maxCopilotFileBytes,
        jsonBodyLimit: appConfig.jsonBodyLimit,
        passwordMinLength: authConfig.passwordMinLength,
      },
      ai: {
        enabled: aiConfig.isEnabled,
        model: aiConfig.model,
        snapshotBudget: aiConfig.snapshotBudget,
      },
    };
  },
};

/**
 * Backwards-compatible flat configuration facade delegating to domain-scoped config modules.
 */
export const envConfig = {
  get nodeEnv() {
    return appConfig.nodeEnv;
  },
  get domain() {
    return appConfig.domain;
  },
  get port() {
    return appConfig.port;
  },
  get databaseUrl() {
    return dbConfig.url;
  },
  get sessionSecret() {
    return authConfig.sessionSecret;
  },
  get adminEmail() {
    return authConfig.adminEmail;
  },
  get adminPassword() {
    return authConfig.adminPassword;
  },
  get attachmentsDir() {
    return storageConfig.attachmentsDir;
  },
  get geminiApiKey() {
    return aiConfig.apiKey;
  },
  get geminiModel() {
    return aiConfig.model;
  },
  get copilotSnapshotBudget() {
    return aiConfig.snapshotBudget;
  },
  get maxAttachmentBytes() {
    return storageConfig.maxAttachmentBytes;
  },
  get maxCopilotFileBytes() {
    return storageConfig.maxCopilotFileBytes;
  },
  get jsonBodyLimit() {
    return appConfig.jsonBodyLimit;
  },
  get loginRateLimitMax() {
    return authConfig.loginRateLimitMax;
  },
  get loginRateLimitWindowMinutes() {
    return authConfig.loginRateLimitWindowMinutes;
  },
};
