#!/usr/bin/env bash
# Pulls the image and (re)starts the stack. Rollback: TAG=sha-1a2b3c4 ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production (copy .env.production.example and fill it in)." >&2
  exit 1
fi

compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }

if [[ -n "${TAG:-}" ]]; then export TAG; fi
if [[ "${SKIP_PULL:-0}" == "1" ]]; then
  echo "→ Skipping pull (local image)"
else
  echo "→ Pulling images (tag: ${TAG:-from .env.production})"
  compose pull
fi

echo "→ Starting (migrations run first)"
compose up -d --remove-orphans --wait

echo "→ Migration log"
compose logs --no-log-prefix migrate | tail -n 5

echo "→ Health"
compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{console.log(r.status, await r.text());process.exit(r.ok?0:1)})"

docker image prune -f >/dev/null
echo "✓ Deployed"
