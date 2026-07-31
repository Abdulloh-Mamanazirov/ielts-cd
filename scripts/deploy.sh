#!/usr/bin/env bash
#
# Deploys the checkout in place, on the server, as the `ielts` user.
#
# CI runs it over SSH after resetting /srv/ielts to origin/master; run it by
# hand for the same effect. Everything it needs comes from .env, which is not in
# git and is left alone here.
#
#   bash scripts/deploy.sh
#
# It builds before it restarts, so a build that fails leaves the running app
# alone. See docs/DEPLOY.md.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n==> %s\n' "$1"; }

if [ ! -f .env ]; then
  echo "No .env in $PWD. See docs/DEPLOY.md, step 6." >&2
  exit 1
fi

log "Installing dependencies"
npm ci --no-audit --no-fund

# The generated client is gitignored, so a fresh checkout has none.
log "Generating the Prisma client"
npx prisma generate

# `migrate deploy` only applies migrations that already exist. It never invents
# one from a schema drift, which is what makes it safe to run unattended.
log "Applying migrations"
npx prisma migrate deploy

log "Building"
npm run build

log "Restarting"
sudo systemctl restart ielts

# The home page reads the database, so answering at all proves the app, the
# connection and the migrations together.
log "Waiting for the app to answer"
for attempt in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/; then
    log "Live (after ${attempt}s)"
    exit 0
  fi
  sleep 1
done

echo "The app did not answer on 127.0.0.1:3000 within 30s." >&2
echo "  sudo journalctl -u ielts -n 50 --no-pager" >&2
exit 1
