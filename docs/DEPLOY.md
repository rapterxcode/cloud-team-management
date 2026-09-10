# Deploying Cloud Team Management

## Prerequisites
- A Linux server with Docker + Docker Compose v2 and ports 80/443 open.
- A DNS A/AAAA record for your domain pointing at the server.

## First deployment
1. `git clone <repo> && cd cloud-team-management`
2. `cp .env.example .env` and fill every value — long random strings for
   `POSTGRES_PASSWORD` and `SESSION_SECRET`, your real `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`, and `DOMAIN` set to your public hostname.
3. `docker compose up -d --build`
4. Open `https://<DOMAIN>` — Caddy provisions HTTPS automatically. Sign in with
   `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
5. In the **Admin** view, create accounts for your team.

> The session cookie is `Secure`, so the app only works over HTTPS (which is
> how Caddy serves it in production). A plain-HTTP trial won't keep you logged
> in — use `DOMAIN=localhost` for a locally-trusted HTTPS trial instead.

## Updating
```sh
git pull && docker compose up -d --build
```
Migrations (`prisma migrate deploy`) and the idempotent seed run automatically
when the `api` container starts.

## Backups
The `backup` service writes `/backups/<YYYY-MM-DD>/ctm.dump` +
`attachments.tar.gz` nightly at 02:00, keeping 14 days. Copy them off-server on
your own schedule, e.g.:
```sh
docker compose cp backup:/backups ./offsite-copy
```

## Restore (runbook — rehearse before you need it)
Replace `2026-09-09` with the backup date you are restoring.

1. Stop the app so nothing writes during the restore:
   ```sh
   docker compose stop api caddy
   ```
2. Restore the database into a scratch DB, verify, then swap it in:
   ```sh
   docker compose exec postgres dropdb -U postgres --if-exists ctm_restore
   docker compose exec postgres createdb -U postgres ctm_restore
   # the backup container has the dumps mounted at /backups and can reach postgres:
   docker compose exec backup sh -c 'pg_restore -h postgres -U postgres -d ctm_restore /backups/2026-09-09/ctm.dump'
   # sanity-check the scratch DB, then swap:
   docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM projects;" ctm_restore
   docker compose exec postgres psql -U postgres -c "ALTER DATABASE ctm RENAME TO ctm_old; ALTER DATABASE ctm_restore RENAME TO ctm;"
   ```
3. Restore attachments into the `attachments` volume. The `backup` container
   mounts it read-only, so untar from a container that mounts it read-write —
   the `api` container (stopped, but you can run a one-off):
   ```sh
   docker compose run --rm --no-deps -v ctm_backups:/backups:ro api \
     sh -c 'tar -xzf /backups/2026-09-09/attachments.tar.gz -C /attachments'
   ```
   (Volume name is `<project>_backups`; check with `docker volume ls`.)
4. Start again and verify login + data:
   ```sh
   docker compose start api caddy
   ```
5. When satisfied, drop the old DB:
   ```sh
   docker compose exec postgres dropdb -U postgres ctm_old
   ```

## AI Copilot (optional)
Set `GEMINI_API_KEY` in `.env` (and optionally `GEMINI_MODEL`, default
`gemini-2.5-flash`) to enable the Copilot. When a question is asked, the backend
sends a compact snapshot of workspace data (projects, tasks, team, resources,
and truncated knowledge previews — never passwords, emails, or secrets) plus the
question to Google's Gemini API. Leave the key blank to keep the Copilot
disabled; the rest of the app is unaffected.

## Password resets
There is no email-based reset (see `docs/adr/0001`). An admin resets passwords
from the **Admin** view (or via `PATCH /api/users/:id`).
