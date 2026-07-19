# PRD - BTForceManager

## Original Problem Statement
Enhance BTForceManager (https://github.com/AFoletti/BTForceManager) via incremental, self-contained user stories. Migrate the app from a static GitHub Pages app (React bundle + flat JSON files) to a self-hosted app on a Synology NAS, backed by SQLite. Game logic in frontend/src/lib/*.js is storage-agnostic and must remain unchanged.

## Architecture Decisions
- Backend: FastAPI + SQLAlchemy (async, aiosqlite) + Alembic, deployed via Docker/docker-compose for the user's Synology NAS.
- DB engine intentionally deviates from the platform's default MongoDB convention: SQLite was explicitly requested by the user for a lightweight, single-user, self-hosted NAS deployment target (not Emergent's own hosting).
- In this sandbox, backend runs via supervisor/uvicorn on :8001 (no Docker daemon available here); Dockerfile/docker-compose.yml are deliverable artifacts for the user's actual NAS deployment.
- Existing frontend (static, JSON-driven) is untouched in this phase; game logic under frontend/src/lib/*.js preserved as-is.

## What's Implemented
### Phase 1 (Backend Skeleton + Health Check) - Done, tested 100% pass
- `backend/server.py`: FastAPI app, CORS, GET `/health` and GET `/api/health` (shared handler) returning `{status, db}`.
- `backend/database.py`: async SQLAlchemy engine/session, `DATABASE_URL` from env only.
- `backend/.env` (sandbox) + `.env.example` + `.env.docker.example` (NAS templates).
- Alembic initialized (`backend/alembic/`), empty baseline migration `e3c21f33f8fc`, `env.py` converts `sqlite+aiosqlite` -> `sqlite` for sync migrations.
- `backend/Dockerfile`, root `docker-compose.yml` (backend service, named volume for SQLite persistence at `/data`).
- `.gitignore` updated: ignores `backend/data/`, `*.db`, `__pycache__`; keeps `.env.example`/`.env.docker.example` committed.
- Verified: supervisor backend RUNNING, `/health` + `/api/health` (internal and external via ingress) both return `{"status":"ok","db":"connected"}`, `alembic upgrade head` creates `alembic_version` table in SQLite.

## Known Pre-existing Issue (not caused by Phase 1)
- Transient console error "Failed to fetch ghost-bear.json" on cold load in `useForceManager.js` `loadForces()` - app still functions correctly (other forces load fine). Flagged by testing agent, not blocking, not part of this migration scope yet.

## Prioritized Backlog
### P0 (next phases per migration roadmap)
- Phase 2: Define SQLAlchemy models mirroring the current force/mech/pilot/mission JSON data contracts; Alembic migration for real schema.
- Phase 3: Data migration script - import existing `data/forces/*.json` into SQLite.
- Phase 4: REST API (CRUD) for forces/mechs/pilots/missions/downtime, reusing existing pure logic from `frontend/src/lib/*.js` (ported or called via API).
- Phase 5: Wire frontend (`useForceManager.js`) to consume the new API instead of static JSON fetch; add `REACT_APP_BACKEND_URL`.
- Phase 6: Docker Compose full stack (frontend + backend) validated on actual Synology NAS.

### P1
- Investigate the pre-existing `ghost-bear.json` fetch race in `useForceManager.js`.

## Next Tasks
- Await user's next user-story (Phase 2 scope) before proceeding.
