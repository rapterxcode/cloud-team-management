import { envInt, envString } from './env-loader.js';
import { appConfig } from './app.config.js';

export const dbConfig = {
  get user() {
    return envString('POSTGRES_USER', 'postgres');
  },
  get password() {
    return envString('POSTGRES_PASSWORD', '');
  },
  get host() {
    return envString('POSTGRES_HOST', '127.0.0.1');
  },
  get port() {
    return envInt('POSTGRES_PORT', 5432);
  },
  get dbName() {
    return envString('POSTGRES_DB', 'ctm');
  },
  get testDbName() {
    return envString('POSTGRES_TEST_DB', 'ctm_test');
  },
  get poolMax() {
    return envInt('POSTGRES_POOL_MAX', 10);
  },
  get allowExitOnIdle() {
    return appConfig.isTest;
  },
  get url() {
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }
    if (this.password) {
      const targetDb = appConfig.isTest ? this.testDbName : this.dbName;
      return `postgresql://${this.user}:${encodeURIComponent(this.password)}@${this.host}:${this.port}/${targetDb}`;
    }
    return '';
  },
};
