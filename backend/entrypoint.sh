#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

groupmod -o -g "$PGID" appuser 2>/dev/null || true
usermod -o -u "$PUID" appuser 2>/dev/null || true

mkdir -p /data /watch
chown -R appuser:appuser /data /watch /app

exec su -s /bin/sh appuser -c "cd /app/backend && alembic upgrade head && python seed_if_empty.py && uvicorn server:app --host 0.0.0.0 --port 8000"
