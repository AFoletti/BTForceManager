# Deployment

Runbook for deploying BTForceManager via Docker Compose. Applies to any Docker host; a dedicated step-by-step section for Synology NAS is provided at the end. Following the steps below end-to-end is enough to get a working instance - no source code reading required.

## Prerequisites

- A Docker host with Docker Engine and the Compose plugin (`docker compose`, v2 syntax).
- `git` available on the host (or clone the repo elsewhere and copy the folder over).
- Shell/SSH access to the host.

## 1. Clone the repo

```bash
git clone https://github.com/AFoletti/BTForceManager.git
cd BTForceManager
```

## 2. Create your env files from the examples

```bash
cp .env.example .env
cp backend/.env.docker.example backend/.env.docker
```

Edit `.env` and set at least:

| Variable | Purpose | Notes |
|---|---|---|
| `REACT_APP_BACKEND_URL` | How the *browser* reaches the backend | e.g. `http://<host-ip>:8000`. Baked into the frontend at build time - changing it later requires a rebuild. |
| `PUID` / `PGID` | Host user/group the backend process runs as | Must match the owner of `./data` and the watch folder so the container can write to them. Find via `id <username>`. |
| `DB_DATA_PATH` | Host folder bind-mounted for the database | Informational only in this repo's compose file (the DB actually lives under the committed `./data` folder - see §Database persistence). |
| `MECH_CATALOG_WATCH_HOST_DIR` | Host folder watched for CSV auto-import | Default `./docker-data/mech-catalog-drop`. |
| `BACKEND_PORT` / `FRONTEND_PORT` | Host ports | Default `8000` / `3000`. |

Edit `backend/.env.docker` and set `CORS_ALLOWED_ORIGINS` only if the frontend will be served from a different origin than the backend (the default same-origin nginx proxy setup needs no change here).

## 3. Create the host folder for the mech catalog drop zone

This path must match `MECH_CATALOG_WATCH_HOST_DIR` in your `.env`:

```bash
mkdir -p ./docker-data/mech-catalog-drop
```

The database needs no separate folder to be created manually - `./data` already exists in the repo (it holds the committed `data/renameme.btforce.db` seed template) and is bind-mounted directly (`./data:/data`).

The watched folder is an ops-workflow alternative for updating the mech catalog outside the app (e.g. scripted/scheduled drops). The primary, in-app path is **Admin > Mech Catalog** (upload a MekBay CSV directly, no filesystem access needed) - both paths call the same upsert-by-MUL-ID logic.

## 4. Build and start the stack

```bash
docker compose up -d --build
```

What this does, in order:

1. Builds the backend and frontend images.
2. On container start, the backend entrypoint checks for `/data/btforce.db`; if it's missing (fresh `./data` folder), it copies `data/renameme.btforce.db` to `data/btforce.db` to seed a ready-to-use database. An existing live `btforce.db` is **never** overwritten by this step.
3. Runs Alembic migrations against `data/btforce.db`.
4. Starts the FastAPI server, then nginx (frontend) proxying `/api/*` to the backend.

## 5. Verify it's running

```bash
curl http://localhost:${BACKEND_PORT:-8000}/health
# {"status":"ok","db":"connected"}
```

Then open `http://<host-ip>:${FRONTEND_PORT:-3000}` in a browser. If you see "No forces available", use **Admin** (top-right shield icon) to create your first force.

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

The `./data` bind mount is untouched by a rebuild - your SQLite database and its history survive as long as you don't delete or reset that folder. `data/btforce.db` itself is not committed to the repo once seeded on your host (only the `renameme.btforce.db` template is tracked), so `git pull` never touches your live data.

## Backup

Schedule a periodic backup running a command like:

```bash
sqlite3 ./data/btforce.db ".backup ./data/btforce-backup.db"
```

Adjust the path if your repo clone lives somewhere other than the current working directory. Point the backup destination at a different disk/share if you want off-volume copies.

## Database persistence

The SQLite file must live under `/data` inside the container (bind-mounted from the repo's own `./data` folder) to persist across restarts; do not point `DATABASE_URL` elsewhere.

## Resetting data

There is no "reset" command and no JSON/CSV re-import path - the container only ever seeds-if-missing, runs migrations, and starts the server. To reset a deployment to a blank slate: stop the stack, delete or move `data/btforce.db` (keep `data/renameme.btforce.db` in place), then start the stack again - the entrypoint will re-seed a fresh `btforce.db` from the template. Alembic will run its migrations against it on that next boot.

---

## Synology NAS setup (personal deployment notes)

This section documents the concrete steps for running BTForceManager on a Synology NAS via **Container Manager**.

### A. One-time NAS prerequisites

1. Install **Container Manager** (DSM 7.2+; called **Docker** on older DSM) from Package Center.
2. Enable SSH: **Control Panel > Terminal & SNMP > Enable SSH service**.
3. Confirm the NAS user you'll run the stack as has read/write access to the shared folder you'll use (e.g. `docker`), and note its UID/GID:

   ```bash
   ssh <user>@<nas-ip>
   id <username>
   # uid=1026(afoletti) gid=100(users) ...
   ```

   Use these values for `PUID`/`PGID` in step C below.

### B. Clone the repo onto the NAS

```bash
ssh <user>@<nas-ip>
cd /volume1/docker
git clone https://github.com/AFoletti/BTForceManager.git
cd BTForceManager
```

### C. Configure environment for this NAS

```bash
cp .env.example .env
cp backend/.env.docker.example backend/.env.docker
```

Edit `.env` (e.g. `vi .env`) with NAS-specific values:

```ini
REACT_APP_BACKEND_URL=http://<nas-ip>:8000
PUID=1026
PGID=100
MECH_CATALOG_WATCH_HOST_DIR=./docker-data/mech-catalog-drop
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

Leave `backend/.env.docker`'s `CORS_ALLOWED_ORIGINS` empty (same-origin nginx proxy).

> If your NAS already runs something on ports 8000/3000, pick free ports here and adjust the URLs below accordingly. Check **Control Panel > Info Center > Network** or `netstat -tlnp` over SSH if unsure.

### D. Create the watch folder and start the stack

```bash
mkdir -p ./docker-data/mech-catalog-drop
docker compose up -d --build
```

The first build can take a few minutes on NAS-class hardware. Watch progress with:

```bash
docker compose logs -f
```

### E. Verify and bookmark

```bash
curl http://localhost:8000/health
```

Then browse to `http://<nas-ip>:3000` from any device on your LAN. Bookmark it, and optionally add a **Synology DSM shortcut** (Application Portal / reverse proxy) if you want a friendly hostname instead of `<nas-ip>:3000`.

### F. Keep it running across reboots and updates

- Compose services already use `restart: unless-stopped`, so containers come back up automatically after a NAS reboot as long as Container Manager's own auto-start is enabled for the project.
- To update: SSH in, `cd /volume1/docker/BTForceManager`, then `git pull && docker compose up -d --build`. Your `./data` folder (and thus your campaigns) is untouched.

### G. Automate backups with Task Scheduler

**Control Panel > Task Scheduler > Create > Scheduled Task > User-defined script**, running (adjust the path to your clone):

```bash
sqlite3 /volume1/docker/BTForceManager/data/btforce.db ".backup /volume1/docker/BTForceManager/data/btforce-backup-$(date +%Y%m%d).db"
```

Schedule this daily or weekly, and consider a second task that copies the backup file to a different volume/share (e.g. via Hyper Backup or a simple `cp`) for off-box redundancy.

### H. Updating the mech catalog on this NAS

Either upload the CSV directly from **Admin > Mech Catalog** in the app (simplest - no NAS filesystem access needed), or drop the CSV file into `/volume1/docker/BTForceManager/docker-data/mech-catalog-drop/` via File Station/SMB - the backend picks it up automatically within a few seconds.
