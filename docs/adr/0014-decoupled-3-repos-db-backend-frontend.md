# ADR 0014: Multi-Repository Separation of Database, Backend API, and Frontend SPA

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Engineering Team

## Context

Previously, the Cloud Team Management (CTM) platform bundled its PostgreSQL database, automated backup service, Express/Prisma Backend API, and React/Vite/Caddy Frontend SPA inside a single repository (`/Users/pasitc/PH/cloud-team-management`) with a single monolithic `compose.yml` and root-context Dockerfiles (`api/Dockerfile` and `caddy/Dockerfile` both required `context: .`).

To improve long-term maintainability, enable independent CI/CD pipelines, decouple database lifecycle operations from application deployments, and allow Backend and Frontend teams to release independently, the human owner requested separating the system into 3 distinct standalone project folders under `cloud-team-management/`:
1. **`cloud-team-db`** (`/Users/pasitc/PH/cloud-team-management/cloud-team-db`)
2. **`cloud-team-backend`** (`/Users/pasitc/PH/cloud-team-management/cloud-team-backend`)
3. **`cloud-team-frontend`** (`/Users/pasitc/PH/cloud-team-management/cloud-team-frontend`)

## Decision

1. **Dedicated Database Repository (`cloud-team-db`):**
   - Owns the PostgreSQL 17 runtime (`ctm-postgres`), automated `pg_dump` backup container (`ctm-backup`), Prisma schema (`prisma/schema.prisma`), SQL migrations (`prisma/migrations/`), and seed runner (`prisma/seed.ts`).
   - Provisions the shared Docker bridge network `ctm-network` so containerized services can reach `ctm-postgres:5432`, while also binding `127.0.0.1:${POSTGRES_PORT:-5432}:5432` for host-level tools and local development.

2. **Standalone Backend API Repository (`cloud-team-backend`):**
   - Owns the Express + TypeScript + Prisma ORM + Gemini 3.8 Flash Copilot API (`src/`, `test/`, `prisma/schema.prisma`).
   - Contains a self-contained `Dockerfile` (`context: .`) and `compose.yml` (`ctm-api`) that connects to PostgreSQL strictly via `DATABASE_URL` over `ctm-network` (or an external managed PostgreSQL instance) without bundling a database container.
   - Supports configurable `ALLOWED_ORIGINS` in `src/config/app.config.ts` and `src/middleware.ts` so the Frontend SPA can be hosted on a separate origin or proxied through Caddy.

3. **Standalone Frontend SPA Repository (`cloud-team-frontend`):**
   - Owns the React 19 + Vite 8 + Tailwind CSS 4 SPA (`src/`, `index.html`, `vite.config.ts`) and its Caddy 2 web server (`Caddyfile`, `Dockerfile`, `compose.yml`).
   - Builds with `context: .` and proxies `/api/*` requests to `${API_UPSTREAM:-ctm-api:3000}` over `ctm-network` (or any configured remote backend URL), while also supporting `VITE_API_BASE_URL` for direct API calls.

## Consequences

- **Independent Lifecycle & Maintenance:** Database maintenance, backups, and schema migrations are isolated in `cloud-team-db`. Backend API (`cloud-team-backend`) and Frontend UI (`cloud-team-frontend`) can be developed, tested, built, and deployed independently.
- **Zero Root-Context Coupling:** Each repository builds its own Docker image using `context: .` and manages its own `.env` and `package.json`.
- **Full Backward Compatibility:** All 63 API integration tests and 60 Frontend unit tests continue to pass 100% inside their respective standalone repositories.
