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

## 3. Create the host folder for the mech catalog drop zone

This path must match `MECH_CATALOG_WATCH_HOST_DIR` in your `.env` (default shown below):

```bash
mkdir -p ./docker-data/mech-catalog-drop
```

The database itself needs no separate folder - `data/btforce.db` is committed in the repo and is bind-mounted directly (`./data:/data`) as the live database. There is no example/live DB distinction: the file you cloned is the one the app runs against.

## 4. Build and start the stack

```bash
docker compose up -d --build
```

This builds the backend (runs Alembic migrations automatically on start, then runs the one-time cutover - `backend/migrate_all.py`, plus the mech catalog import - **only if the database is empty**, later restarts never overwrite live progress) and the frontend (nginx serving the built React app, proxying `/api/*` to the backend).

If you ever need to re-run the cutover manually (e.g. debugging a fresh volume outside of first boot), exec into the backend container and run:

```bash
docker compose exec backend python migrate_all.py
```

This is the single entrypoint for the legacy JSON -> SQLite cutover - it runs `import_legacy_data`, `migrate_reference_data`, and `migrate_special_abilities` in the only valid order. Those three no longer support being run directly.

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

The `./data` bind mount is untouched by a rebuild - your SQLite database and its history survive as long as you don't delete or reset that folder. Since `data/btforce.db` is committed, `git pull` will only update it if a newer version was pushed upstream; your local in-place edits (via the running app) are not auto-committed by git.

## Backup

Schedule a periodic backup via Synology's **Task Scheduler** (Control Panel > Task Scheduler > Create > Scheduled Task > User-defined script), running a command like:

```bash
sqlite3 ./data/btforce.db ".backup ./data/btforce-backup.db"
```

Adjust the path if your repo clone lives somewhere other than the current working directory. Point the backup destination at a different share/folder if you want off-volume copies.

## Database persistence

The SQLite file must live under `/data` inside the container (bind-mounted from the repo's own `./data` folder) to persist across restarts; do not point `DATABASE_URL` elsewhere.
