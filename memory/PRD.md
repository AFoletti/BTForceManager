# BTForceManager - Project Memory

## Source
Cloned from https://github.com/AFoletti/BTForceManager/ (public repo, already present in /app at session start).

## Stack
- Frontend: React 18 + Tailwind, lucide-react, @react-pdf/renderer
- Backend: FastAPI + SQLAlchemy (async) + Alembic migrations
- DB: SQLite, single committed file at /app/data/btforce.db (kept as-is per user request)

## Status (2026-08-11)
- Verified backend running on :8001, Alembic migrations applied cleanly (head reached)
- Verified frontend running on :3000, loads correctly, shows "No forces available" (empty DB state, expected - matches committed db)
- No code changes made yet. Awaiting user's bug descriptions.

## Next Steps
- Awaiting user to describe specific bugs to fix.
