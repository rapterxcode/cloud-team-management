# Cloud Team Database (`cloud-team-db`)

Standalone PostgreSQL 17 database, automated `pg_dump` backup service, Prisma schema (`prisma/schema.prisma`), migration history (`prisma/migrations/`), and seed script (`prisma/seed.ts`) for the Cloud Team Management platform.

## Quick Start

```bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
```

## Architecture

- **`ctm-postgres`**: PostgreSQL 17 listening on `127.0.0.1:${POSTGRES_PORT:-5432}:5432` and attached to the shared Docker bridge network `ctm-network` (reachable as `ctm-postgres:5432` or `postgres:5432`).
- **`ctm-backup`**: Automated daily backup container writing compressed dumps to the `ctm_backups` Docker volume.
