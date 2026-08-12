# BTForceManager - Project Memory

## Source
Cloned from https://github.com/AFoletti/BTForceManager/ (public repo).

## Stack
- Frontend: React 18 + Tailwind, lucide-react, @react-pdf/renderer
- Backend: FastAPI + SQLAlchemy (async) + Alembic migrations
- DB: SQLite, single committed file at /app/data/btforce.db

## Status (2026-02)
- Fix 1: docker-compose.yml backend entrypoint now seeds data/btforce.db from data/renameme.btforce.db on first run if missing (avoids overwriting live NAS data on git pull).
- Fix 2: Admin > Forces panel gained an Image field; removed legacy header "+ New Force" button/dialog (AddForceDialog.jsx deleted) - force creation now lives solely in Admin.
- Fix 3: Images (forces, mechs, elementals) now stored as bytes in DB instead of URLs.
  - Backend: added `image_data` (LargeBinary) + `image_mime_type` columns to Force/Mech/Elemental (migration 5b7ca80172e3). New `backend/routers/images.py` exposes POST/GET/DELETE `/api/{forces|mechs|elementals}/{id}/image` (5MB limit, png/jpeg/webp/gif only). Serializers compute `image` as the endpoint URL when bytes exist, falling back to legacy `image` URL column for old data.
  - Frontend: new shared `components/ui/image-upload-field.jsx` widget (upload/replace/remove + preview). Wired into AdminForcesPanel, MechRoster, ElementalRoster. `forceSync.js` no longer diffs the `image` field (uploads are immediate API calls, not part of the local-state diff engine); mech/elemental image uploads call `flushForceSync` first so the entity exists server-side before the image POST.
- Fix 4: Snapshot/Waypoint consolidation (7-step plan, completed):
  - Dropped legacy `Snapshot` and `FullSnapshot` tables; all campaign snapshots now live in `force_snapshots` (id, force_id, type, label, snapshot_json, created_at).
  - Snapshot creation is fully automatic on 3 triggers: pre-mission, post-mission, post-downtime (no manual "Create Snapshot/Waypoint" UI remains). Capped at 3 per force; consecutive downtime snapshots auto-merge.
  - Image bytes are embedded as base64 directly inside `snapshot_json`, so `POST /api/forces/{force_id}/state-snapshots/{id}/restore` fully restores image state too (previous known limitation is now resolved).
  - `WaypointsPanel.jsx` deleted; `SnapshotsTab.jsx` rewritten to be fully DB-backed; `PDFExport.jsx` updated to read from the new snapshot shape.
  - Verified via `/app/backend/tests/test_force_state_snapshots.py` (11/11 passing) + Playwright frontend checks (iteration_15.json) - 100% pass, zero action items.
- Fix 5: Dependency cleanup - removed unused npm packages `class-variance-authority` and `date-fns`.
- 2026-02: Post-fork sanity check performed (backend `/api/health` OK, frontend loads correctly showing "No forces available" empty state - expected since dev sandbox DB starts empty and isn't auto-seeded like the Docker Compose flow). No further bugs reported by user at this time.

## Next Steps / Backlog
- P1: Add DB-stored image upload capability to Pilot portraits (Forces/Mechs/Elementals already have it; Pilots still lack it).
- P2: Auto-resize/compress large image uploads server-side to prevent SQLite DB bloat over time.
- Awaiting user's next bug/feature request.
