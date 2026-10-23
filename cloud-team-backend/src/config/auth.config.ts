import { envBool, envInt, envString } from './env-loader.js';
import { appConfig } from './app.config.js';

export const authConfig = {
  get sessionSecret() {
    return envString('SESSION_SECRET', 'dev-secret');
  },
  get cookieSecure() {
    return envBool('SESSION_COOKIE_SECURE', appConfig.isProduction);
  },
  get cookieSameSite(): 'lax' | 'strict' | 'none' {
    const val = envString('SESSION_COOKIE_SAMESITE', 'lax').toLowerCase();
    if (val === 'strict' || val === 'none') return val;
    return 'lax';
  },
  get loginRateLimitMax() {
    return envInt('LOGIN_RATE_LIMIT_MAX', 10);
  },
  get loginRateLimitWindowMinutes() {
    return envInt('LOGIN_RATE_LIMIT_WINDOW_MINUTES', 15);
  },
  get passwordMinLength() {
    return envInt('PASSWORD_MIN_LENGTH', 10);
  },
  get adminEmail() {
    return envString('ADMIN_EMAIL', '').trim().toLowerCase();
  },
  get adminPassword() {
    return envString('ADMIN_PASSWORD', '');
  },
};
