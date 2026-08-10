# Deployment

Runbook for deploying BTForceManager on a Synology NAS via Container Manager (Docker Compose). Following the steps below end-to-end is enough to get a working instance - no source code reading required.

## Prerequisites

- A Synology NAS with **Container Manager** (or the older **Docker** package) installed and enabled from Package Center.
- SSH access to the NAS enabled (Control Panel > Terminal & SNMP), since `docker compose` is run from a shell.
- `git` available on the NAS (or clone the repo on another machine and copy the folder over via File Station/SMB).

## 1. Clone the repo onto the NAS

SSH into the NAS, then pick a folder to hold the app (e.g. a shared folder mounted at `/volume1/docker/`):

```bash
cd /volume1/docker
git clone -b env https://github.com/AFoletti/BTForceManager.git
cd BTForceManager
```

## 2. Create your env files from the examples (Issue 1)

```bash
cp .env.example .env
cp backend/.env.docker.example backend/.env.docker
```

Edit `.env` and set at least:
- `REACT_APP_BACKEND_URL` to how the browser will reach the backend (e.g. `http://<your-nas-ip>:8000`).
- `PUID`/`PGID` to match the NAS user that should own the data files (find them via `id <username>`).

Edit `backend/.env.docker` and set `CORS_ALLOWED_ORIGINS` only if the frontend will be served from a different origin than the backend (default same-origin nginx proxy setup needs no change here).

## 3. Create the host folders for persistent data

These paths must match `DB_DATA_PATH` and `MECH_CATALOG_WATCH_HOST_DIR` in your `.env` (defaults shown below):

```bash
mkdir -p ./docker-data/db
mkdir -p ./docker-data/mech-catalog-drop
```

## 4. Build and start the stack

```bash
docker compose up -d --build
```

This builds the backend (runs Alembic migrations automatically on start, then seeds the initial campaign/reference data from the `data/` folder **only if the database is empty** - later restarts never overwrite live progress) and the frontend (nginx serving the built React app, proxying `/api/*` to the backend).

## 5. Verify it's running

```bash
curl http://localhost:${BACKEND_PORT:-8000}/health
# {"status":"ok","db":"connected"}
```

Then open `http://<your-nas-ip>:${FRONTEND_PORT:-3000}` in a browser.

## 6. Viewing logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Updating

To pull the latest changes and rebuild without losing data:

```bash
git pull
docker compose up -d --build
```

The `/data` bind mount (`DB_DATA_PATH` on the host) is untouched by a rebuild - your SQLite database and its history survive as long as you don't delete that host folder.

## Backup

Schedule a periodic backup via Synology's **Task Scheduler** (Control Panel > Task Scheduler > Create > Scheduled Task > User-defined script), running a command like:

```bash
sqlite3 <DB_DATA_PATH>/btforce.db ".backup <DB_DATA_PATH>/btforce-backup.db"
```

Replace `<DB_DATA_PATH>` with the exact host path you set for `DB_DATA_PATH` in your `.env` (e.g. `/volume1/docker/BTForceManager/docker-data/db`). Point the backup destination at a different share/folder if you want off-volume copies.

## Database persistence

The SQLite file must live under `/data` inside the container to persist across restarts; do not point `DATABASE_URL` elsewhere.
