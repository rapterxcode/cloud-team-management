# Cloud Team Backend (`cloud-team-backend`)

Standalone Node.js 22 + Express + TypeScript + Prisma ORM + Gemini 3.8 Flash AI Copilot Backend API for the Cloud Team Management platform.

## Architecture & Decoupling

- **No Bundled Database Container:** Connects to `cloud-team-db` (`ctm-postgres:5432` over `ctm-network`) or any external PostgreSQL instance via `DATABASE_URL`.
- **12-Factor Modular Configuration:** Domain-scoped config in `src/config/*` (`app`, `db`, `auth`, `storage`, `ai`) and public runtime config endpoint `GET /api/config`.
- **Cross-Origin Support:** Configurable `ALLOWED_ORIGINS` allowing `cloud-team-frontend` to run on an independent port or domain.

## Quick Start

```bash
cp .env.example .env
npm ci
npx prisma generate
npm run build
npm test
docker compose up -d --build
```
