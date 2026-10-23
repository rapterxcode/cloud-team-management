# 12. Modernized Modular Configuration Architecture (12-Factor & Domain-Scoped Config)

Date: 2026-10-23

## Status

Accepted

## Context

Initially, runtime configuration in Cloud Team Management (CTM) was either scattered across route files (`process.env.*`) or consolidated into a single monolithic configuration object (`api/src/config.ts`). As the platform expanded to encompass Multi-Workspace RBAC, PostgreSQL connection pooling, file storage governance, rate-limiting policies, and Gemini 3.8 Flash AI Copilot grounding, a flat monolithic configuration structure introduced coupling across unrelated domains and lacked a clean way to expose non-sensitive runtime settings to the React 19 SPA.

## Decision

We refactored the monolithic configuration into a **Modernized Domain-Scoped Configuration Architecture** under [`api/src/config/`](../../api/src/config/) following 12-Factor App principles:

1. **Multi-Profile Environment Layering (`api/src/config/env-loader.ts`):**
   - Automatically loads environment files in precedence order: `.env.<NODE_ENV>.local` → `.env.local` → `.env.<NODE_ENV>` → `.env`.
   - Provides strongly-typed coercion helpers (`envString`, `envInt`, `envBool`, `envList`).
2. **Domain-Scoped Configuration Modules:**
   - `config.app` ([`app.config.ts`](../../api/src/config/app.config.ts)): Environment mode, domain, port, payload limits, and proxy trust hops.
   - `config.db` ([`database.config.ts`](../../api/src/config/database.config.ts)): PostgreSQL credentials, automatic `DATABASE_URL` synthesis for production and `test` environments, and pool sizing.
   - `config.auth` ([`auth.config.ts`](../../api/src/config/auth.config.ts)): Session secret, cookie security flags, login rate-limiting thresholds, password policy, and initial admin bootstrap credentials.
   - `config.storage` ([`storage.config.ts`](../../api/src/config/storage.config.ts)): Host attachment directory, file size caps, extension allow-lists, and backup retention days.
   - `config.ai` ([`ai.config.ts`](../../api/src/config/ai.config.ts)): Gemini API key, model selection (`gemini-3.8-flash`), and snapshot character budget.
3. **Sanitized Public Runtime Config Endpoint (`GET /api/config`):**
   - Exposes `config.getPublicRuntimeConfig()` to authenticated clients ([`web/src/lib/config.ts`](../../web/src/lib/config.ts)) while strictly stripping all secrets (`sessionSecret`, `adminPassword`, `apiKey`, database credentials).

## Consequences

- Each architectural domain owns its configuration schema with clear defaults and type coercion.
- Local development and integration tests (`npm --prefix api test`) automatically resolve `.env` and synthesize `ctm_test` connection strings with zero manual CLI flags.
- Frontend and backend share a single source of truth for upload limits, AI model status, and environment metadata via `GET /api/config`.
