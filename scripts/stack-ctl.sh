#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$ROOT_DIR/cloud-team-db"
BACKEND_DIR="$ROOT_DIR/cloud-team-backend"
FRONTEND_DIR="$ROOT_DIR/cloud-team-frontend"

ACTION="${1:-status}"

case "$ACTION" in
  up)
    echo "=== [1/3] Starting Database Stack ($DB_DIR) ==="
    docker compose -f "$DB_DIR/compose.yml" --env-file "$DB_DIR/.env" up -d
    echo "=== [2/3] Starting Backend API ($BACKEND_DIR) ==="
    docker compose -f "$BACKEND_DIR/compose.yml" --env-file "$BACKEND_DIR/.env" up -d --build
    echo "=== [3/3] Starting Frontend SPA ($FRONTEND_DIR) ==="
    docker compose -f "$FRONTEND_DIR/compose.yml" --env-file "$FRONTEND_DIR/.env" up -d --build
    ;;
  down)
    echo "=== Stopping Frontend, Backend, and Database Stacks ==="
    docker compose -f "$FRONTEND_DIR/compose.yml" down || true
    docker compose -f "$BACKEND_DIR/compose.yml" down || true
    docker compose -f "$DB_DIR/compose.yml" down || true
    ;;
  status)
    echo "=== Decoupled 3-Tier Docker Status ==="
    docker ps --filter "name=ctm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    ;;
  *)
    echo "Usage: $0 {up|down|status}"
    exit 1
    ;;
esac
