#!/usr/bin/env bash
#
# Nightly backup: the database, the private media directory, and whatever the
# admin uploaded into the checkout before uploads moved out of it.
#
# Uploads now go to /var/lib/ielts/media/images, so the second archive covers
# them. public/test-media is still taken because the images uploaded there
# before the move are untracked files — git will not restore them and a fresh
# clone will not have them.
#
# Installed as root's cron job; see docs/DEPLOY.md, step 13.
#
#   sudo bash /srv/ielts/deploy/backup.sh

set -euo pipefail

APP_DIR=/srv/ielts
DEST=/var/backups/ielts
KEEP_DAYS=14
STAMP=$(date +%F)

mkdir -p "$DEST"
chmod 700 "$DEST"

# DATABASE_URL, and nothing else, out of the app's env file.
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a

pg_dump --format=custom --no-owner --file="$DEST/db-$STAMP.dump" "$DATABASE_URL"

tar -czf "$DEST/media-$STAMP.tar.gz" -C /var/lib/ielts media
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP_DIR" public/test-media

find "$DEST" -maxdepth 1 -type f -mtime "+$KEEP_DAYS" -delete

echo "Backed up to $DEST:"
ls -lh "$DEST" | grep "$STAMP"

# These live on the same disk as the thing they are backing up, which protects
# against a bad migration but not against losing the server. Copy them off
# periodically:
#
#   scp ielts@SERVER_IP:/var/backups/ielts/db-*.dump .
