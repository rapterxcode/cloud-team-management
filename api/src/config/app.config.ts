import { envInt, envString } from './env-loader.js';

export const appConfig = {
  get nodeEnv() {
    return envString('NODE_ENV', 'development');
  },
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  get isTest() {
    return this.nodeEnv === 'test';
  },
  get isDevelopment() {
    return !this.isProduction && !this.isTest;
  },
  get domain() {
    return envString('DOMAIN', 'localhost');
  },
  get port() {
    return envInt('PORT', 3000);
  },
  get jsonBodyLimit() {
    return envString('JSON_BODY_LIMIT', '256kb');
  },
  get trustProxy() {
    return envInt('TRUST_PROXY_HOPS', 1);
  },
};
