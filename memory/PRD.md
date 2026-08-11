# BTForceManager - Project Memory

## Source
Cloned from https://github.com/AFoletti/BTForceManager/ (public repo).

## Stack
- Frontend: React 18 + Tailwind, lucide-react, @react-pdf/renderer
- Backend: FastAPI + SQLAlchemy (async) + Alembic migrations
- DB: SQLite, single committed file at /app/data/btforce.db

## Status (2026-08-11)
- Fix 1: docker-compose.yml backend entrypoint now seeds data/btforce.db from data/renameme.btforce.db on first run if missing (avoids overwriting live NAS data on git pull).
- Fix 2: Admin > Forces panel gained an Image field; removed legacy header "+ New Force" button/dialog (AddForceDialog.jsx deleted) - force creation now lives solely in Admin.
- Fix 3: Images (forces, mechs, elementals) now stored as bytes in DB instead of URLs.
  - Backend: added `image_data` (LargeBinary) + `image_mime_type` columns to Force/Mech/Elemental (migration 5b7ca80172e3). New `backend/routers/images.py` exposes POST/GET/DELETE `/api/{forces|mechs|elementals}/{id}/image` (5MB limit, png/jpeg/webp/gif only). Serializers compute `image` as the endpoint URL when bytes exist, falling back to legacy `image` URL column for old data.
  - Frontend: new shared `components/ui/image-upload-field.jsx` widget (upload/replace/remove + preview). Wired into AdminForcesPanel, MechRoster, ElementalRoster. `forceSync.js` no longer diffs the `image` field (uploads are immediate API calls, not part of the local-state diff engine); mech/elemental image uploads call `flushForceSync` first so the entity exists server-side before the image POST.
  - Known limitation (not in scope): force snapshot restore (`deserialize_force`, not wired to any endpoint yet) does not carry image bytes.

## Next Steps
- Awaiting user's next bug/feature request.
