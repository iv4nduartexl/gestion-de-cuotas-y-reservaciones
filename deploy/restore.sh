#!/usr/bin/env bash
# Restores a backup into the production database. DESTRUCTIVE: replaces all data.
#   ./restore.sh                 # lists available backups
#   ./restore.sh agenda-20261010-0600.dump
set -euo pipefail
cd "$(dirname "$0")"
compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }

if [[ $# -eq 0 ]]; then
  echo "Available backups:"
  compose exec -T backup ls -1t /backups
  exit 0
fi

file="$1"
compose exec -T backup test -f "/backups/$file" || { echo "Backup /backups/$file not found." >&2; exit 1; }

read -r -p "This REPLACES all production data with $file. Type 'restaurar' to continue: " answer
[[ "$answer" == "restaurar" ]] || { echo "Cancelled."; exit 1; }

echo "→ Stopping the app and the scheduler"
compose stop app cron

echo "→ Restoring"
compose exec -T backup sh -c 'pg_restore --clean --if-exists --no-owner -d "$PGDATABASE" "/backups/$1"' restore "$file"

echo "→ Starting again"
compose up -d --wait app cron
echo "✓ Restored $file"
