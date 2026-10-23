import { envInt, envString } from './env-loader.js';

export const aiConfig = {
  get apiKey() {
    return envString('GEMINI_API_KEY', '');
  },
  get isEnabled() {
    return Boolean(this.apiKey);
  },
  get model() {
    return envString('GEMINI_MODEL', 'gemini-3.8-flash');
  },
  get snapshotBudget() {
    return envInt('COPILOT_SNAPSHOT_BUDGET', 1_000_000);
  },
  get maxQuestionLength() {
    return envInt('COPILOT_MAX_QUESTION_LENGTH', 2_000);
  },
};
