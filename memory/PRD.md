# PRD - BTForceManager

## Original Problem Statement
Enhance BTForceManager (https://github.com/AFoletti/BTForceManager) via incremental, self-contained user stories. Migrate the app from a static GitHub Pages app (React bundle + flat JSON files) to a self-hosted app on a Synology NAS, backed by SQLite. Game logic in frontend/src/lib/*.js is storage-agnostic and must remain unchanged.

## Architecture Decisions
- Backend: FastAPI + SQLAlchemy (async, aiosqlite) + Alembic, deployed via Docker/docker-compose for the user's Synology NAS.
- DB engine intentionally deviates from the platform's default MongoDB convention: SQLite was explicitly requested by the user for a lightweight, single-user, self-hosted NAS deployment target (not Emergent's own hosting).
- In this sandbox, backend runs via supervisor/uvicorn on :8001 (no Docker daemon available here); Dockerfile/docker-compose.yml are deliverable artifacts for the user's actual NAS deployment.
- Existing frontend (static, JSON-driven) is untouched in this phase; game logic under frontend/src/lib/*.js preserved as-is.

## What's Implemented
### Phase 9 (Frontend Cutover to API - "Transparent Sync") - Done, tested 100% pass (testing agent + self curl verification)
- User-approved approach: **Transparent Sync**. All existing UI components (`MechRoster`, `PilotRoster`, `ElementalRoster`, `MissionManager`, `DowntimeOperations`, `NotesTab`, `SnapshotsTab`, `DataEditor`) and all `frontend/src/lib/*.js` game-logic files are **untouched**. Only `useForceManager.js` was rewritten.
- `frontend/.env` was missing entirely - created with `REACT_APP_BACKEND_URL` (protected var was never set up in an earlier session).
- `frontend/src/lib/api.js` (new): thin fetch wrappers for every backend endpoint.
- `frontend/src/hooks/forceSync.js` (new): generic diff engine. Given `prev` (last backend-confirmed force state) and `next` (current local state), it POSTs new entities (by id), PUTs entities with changed fields, DELETEs removed entities, for mechs/pilots/elementals/missions/force-scalars/snapshots/fullSnapshots. Pilot achievements and mission SP-purchases are handled as additive-only sub-diffs (dedicated join-table endpoints).
- `frontend/src/hooks/useForceManager.js` (rewritten): loads forces via `GET /api/forces` + `GET /api/forces/{id}` (all forces eagerly, matching the old static-JSON UX). Every `updateForceData(updates)` call merges locally (instant UI, unchanged) then schedules a ~900ms debounced call to `forceSync.js` against a per-force "last synced" snapshot ref. `addNewForce` now calls `POST /api/forces`.
- `frontend/src/components/MechAutocomplete.jsx`: search dropdown rewritten to call `GET /api/mech-catalog?search=` (debounced 250ms) instead of parsing the CSV client-side. `loadMechCatalog`/`lookupMechInCatalog` (still CSV-based, used by `MechRoster.jsx` for the read-only "catalog info" panel) intentionally left untouched.
- Backend additions required to make the generic diff fully lossless (all additive, no existing behavior changed):
  - `activityLog` settable on Mech/Pilot/Elemental create+update; `combatRecord` settable on Pilot update.
  - `Mission`: `id` accepted on create (client-generated ids now preserved, matching mechs/pilots/elementals); `completed`/`completedAt`/`recap` now settable via the plain `PUT /api/missions/{id}` (previously only settable via the Phase 8 `/complete` endpoint) - this is what let mission completion flow through the generic diff engine with zero special-casing.
  - New `DELETE /api/missions/{id}` (needed for snapshot-rollback / full-replace scenarios).
  - New `backend/routers/snapshots.py`: `POST/DELETE /api/forces/{id}/snapshots`, `POST/DELETE /api/forces/{id}/full-snapshots` (Phase 8 intentionally skipped these; without them snapshot history would not survive a page reload).
  - `MechCatalogEntry` extended with `walk/maxWalk/jump/maxJump/heat/dissipation/dissipationEfficiency/components` (migration `f666a8ff05f2`) + `import_mech_catalog.py` + `routers/mech_catalog.py` updated so the API fully replaces the CSV for autocomplete purposes (previously only chassis/model/bv/tonnage/year/techbase/role were captured).
- Verified via `testing_agent_v4` (100% pass, no critical/blocking issues): add/edit mech+pilot survive reload with client-generated ids preserved server-side, MechAutocomplete search hits the API, mission create+complete persists (incl. pilot combatRecord/achievements), downtime action persists, notes autosave debounce persists, Add Force dialog persists. Backend: all 36 pytest still passing after the additions; new endpoints self-verified via curl (create/verify/delete full lifecycle on a throwaway `qa-force`).
- Cleanup: testing agent's QA artifacts (a throwaway force + a test mech/mission/notes edit written into the real `ghost-bear` seed data) were removed by re-running `import_legacy_data.py` (idempotent) + deleting the throwaway force; confirmed both real forces (`ghost-bear`, `91st-division-vision-of-words`) match original row counts/notes again.
- Known accepted limitations (by design, documented, not bugs): removing an already-synced SP purchase from a mission has no unsync path (no DELETE endpoint for sp-purchases, very rare edge case); a transient sync failure silently drops that one change rather than retrying (acceptable for a single-user NAS tool); rolling back via Snapshots to before a mission was completed will not revert `mission.completed` server-side.
- Minor non-blocking note from testing agent: occasional transient "Failed to fetch" console error on the very first load in dev mode (React.StrictMode double-invokes the mount effect) that always self-resolves within ~1-2s with correct data rendered; harmless and stripped in production builds.

### Phase 1-8
See below entries (unchanged from prior session).

### Phase 1 (Backend Skeleton + Health Check) - Done, tested 100% pass
- `backend/server.py`: FastAPI app, CORS, GET `/health` and GET `/api/health` (shared handler) returning `{status, db}`.
- `backend/database.py`: async SQLAlchemy engine/session, `DATABASE_URL` from env only.
- `backend/.env` (sandbox) + `.env.example` + `.env.docker.example` (NAS templates).
- Alembic initialized (`backend/alembic/`), empty baseline migration `e3c21f33f8fc`, `env.py` converts `sqlite+aiosqlite` -> `sqlite` for sync migrations.
- `backend/Dockerfile`, root `docker-compose.yml` (backend service, named volume for SQLite persistence at `/data`).
- `.gitignore` updated: ignores `backend/data/`, `*.db`, `__pycache__`; keeps `.env.example`/`.env.docker.example` committed.
- Verified: supervisor backend RUNNING, `/health` + `/api/health` (internal and external via ingress) both return `{"status":"ok","db":"connected"}`, `alembic upgrade head` creates `alembic_version` table in SQLite.

### Phase 2 (Core Force Schema + Read-Only API) - Done, tested 100% pass
- `backend/models.py`: 7 SQLAlchemy tables - `forces`, `mechs`, `pilots`, `elementals`, `missions`, `snapshots`, `full_snapshots`. Nested/variable-shape sub-structures (activityLog, combatRecord, achievements, objectives, spPurchases, opForUnits, snapshot units, fullSnapshot forceData) stored as JSON columns rather than further-normalized tables (intentional scope decision for this phase).
- Alembic migration `4bce84c5ebae_core_force_schema` (autogenerated) creates all 7 tables.
- `backend/import_legacy_data.py`: one-time, idempotent migration script - reads `data/forces/manifest.json` + each listed force JSON, wipes+reinserts per-force. Verified twice with identical row counts: ghost-bear (18 mechs/18 pilots/3 elementals/2 missions/5 snapshots/3 fullSnapshots), 91st-division-vision-of-words (24/24/0/0/0/0).
- `backend/serializers.py` + `backend/routers/forces.py`: read-only `GET /api/forces` (summary list w/ counts) and `GET /api/forces/{id}` (full detail, camelCase, matches original JSON contract) + 404 handling.
- `backend/tests/test_forces_api.py`: 4 pytest tests (row-count-vs-source-JSON, list endpoint, detail endpoint, 404). All 10 backend tests pass (Phase 1 + Phase 2).
- Note: only forces listed in `data/forces/manifest.json` are imported (matches frontend's own runtime loading behavior); `19th-great-white.json`/`31th-comstar.json` on disk but not in manifest are intentionally not imported.

## Code Review Notes (flagged by testing agent, non-blocking for current phase)
- CORS in `server.py` uses `allow_origins=["*"]` with `allow_credentials=True` (spec-invalid combo, harmless now with no auth) - tighten before any phase introducing auth/sessions.
- Migration script doesn't remove forces previously imported but later dropped from manifest.json - fine for read-only phase, revisit once writes are trusted.

## Prioritized Backlog
### P0
- Phase 10: Docker Compose full stack (frontend + backend) validated on actual Synology NAS.

### P1
- Tighten CORS policy and add auth once writes/multi-user exposure are introduced.
- Consider case-insensitive uniqueness for special-abilities pool names if free-text entry is exposed in UI later.
- Pilot SPA pool (Phase 5) is intentionally not wired into `GET /api/forces/{id}` pilot serialization yet - wire in when a phase actually needs it.
- Minor code-review notes from Phase 7 (non-blocking): `watcher._history` list has no explicit lock around concurrent debounce timers; `process_csv_file` does a blocking file read inside an async function; zero-data-row files count as a successful "ok" import.
- Minor code-review note from Phase 8 (non-blocking): `routers/missions_write.py` is ~360 lines; consider extracting mission-completion logic into `domain/missions_logic.py` if it grows further.
- Add a DELETE endpoint for individual `mission_sp_purchases` rows (currently additive-only from the frontend sync engine's perspective).
- Migrate remaining read-only static JSON fetches (`achievements.json`, `sp-choices.json`, `downtime-actions.json` inside components) to their existing Phase 3/4 backend endpoints for full consistency (not required for correctness today, both sources are in sync).
- Pre-existing (not caused by Phase 9): pilot activityLog can show a duplicate "Assigned to mission" entry with identical timestamp after a mission is created then completed in the same session - lives in `frontend/src/lib/missions.js`, not part of the sync-layer work.

## Next Tasks
- Phase 10 (Docker Compose full-stack validation) or any new user-requested feature - await user's next steer.

### Phase 8 (Write API for Core Entities) - Done, tested 100% pass
- `backend/domain/`: pure business logic ported from `frontend/src/lib/*.js` - `mechs_logic.py` (BV adjustment table), `achievements_logic.py` (combat stats + condition checker), `downtime_logic.py` (formula tokenizer/RPN evaluator over `data/downtime-actions.json`), `missions_logic.py` (tonnage/BV/availability calculations).
- Full CRUD: `POST/PUT/DELETE /api/forces{,/…}`, `.../mechs`, `.../pilots`, `.../elementals` (`routers/forces_write.py`, `mechs.py`, `pilots.py`, `elementals.py`). Force delete cascades all children including Phase 3-5 join tables.
- `routers/missions_write.py`: `POST /api/forces/{id}/missions` (deducts cost, activity-logs assigned units/pilots, snapshots SP purchases via Phase 4 mechanism, computes tonnage), `PUT /api/missions/{id}` (does NOT touch warchest - matches original `lib/missions.js` exactly), `POST /api/missions/{id}/complete` (applies kills/assists to pilot combat records, checks achievements against Phase 4's pool, persists newly-earned ones, computes WP reward from achieved objectives, updates warchest; 409 guard against double-completion).
- `routers/downtime.py`: mech/elemental/pilot downtime actions using the ported formula evaluator (e.g. repair-armor = weight/wpMultiplier, heal-injury = 30\*injuries/wpMultiplier).
- Verified end-to-end manually via curl and via `tests/test_write_api_lifecycle.py` (5 tests): full lifecycle (create force -> mech/pilot -> assign -> mission w/ SP purchase -> complete -> achievement earned + reward applied -> downtime -> cascade delete). All 36 backend tests pass; testing agent also smoke-tested externally via ingress and confirmed real campaign data (ghost-bear, 91st-division-vision-of-words) untouched.
- Scope note: intentionally does NOT create snapshots/fullSnapshots or auto-advance `force.currentDate` - that's `MissionManager.jsx` UI-orchestration logic, out of scope for "mirroring lib/*.js" pure functions.

### Phase 7 (Watched-Folder Auto-Import Code) - Done, tested 100% pass
- `backend/watcher.py`: background `watchdog.Observer` monitoring `MEK_CATALOG_WATCH_DIR` (opt-in via env var, no-op if unset) for `*.csv` drops, debounced via per-file `threading.Timer` (default 2s, `MEK_CATALOG_WATCH_DEBOUNCE_SECONDS`). Core logic split into pure/testable functions: `validate_header`, `process_csv_file` (upserts strictly by mul_id, rows without mul_id counted as skipped), `handle_dropped_file` (archives to `processed/<name>_<timestamp>.csv` or quarantines to `errors/` + a `.log` explaining why).
- Wired into FastAPI `lifespan` (start on startup, stop on shutdown). New `GET /api/mech-catalog/import-status` reports enabled/running/watchDir/debounceSeconds + last 20 import results.
- `.env`/`.env.example`/`.env.docker.example` updated with `MEK_CATALOG_WATCH_DIR`.
- Verified live end-to-end in the sandbox (valid + malformed drops both processed correctly, cleaned up after). 7 new pytest tests including a real `watchdog.Observer` integration test against a temp dir (no NAS needed, CI-verifiable). All 31 backend tests pass.

### Phase 6 (Mech Catalog Table) - Done, tested 100% pass
- `backend/models.py`: added `MechCatalogEntry` (id, mul_id unique+nullable, chassis, model, bv, tonnage, year, techbase, role, updated_at). Migration `be34ee216040`.
- `backend/import_mech_catalog.py`: idempotent bulk-import from `data/mek_catalog.csv` (3867 rows -> 3861 unique entries; dedupes by mul_id, falls back to (chassis, model) for the ~89 rows without a mul_id). Verified: fresh run "Created 3861, updated 6"; re-run "Created 0, updated 3867" - fully idempotent, correct final count.
- `backend/routers/mech_catalog.py`: `GET /api/mech-catalog?search=` - replicates `MechAutocomplete.jsx`'s exact UX (min 2 chars, case-insensitive substring on chassis/model/combined name, capped at 50 results). Verified live via ingress.
- Additive-only: frontend's `MechAutocomplete.jsx` still does its own client-side CSV fetch+parse, untouched and confirmed still working (regression-tested). All 24 backend tests pass (Phases 1-6).

### Phase 5 (Pilot SPA Pool - Future-Proofing) - Done, tested 100% pass
- `backend/models.py`: added `PilotSpecialAbility` (id, name unique, description) and `PilotSpaAssignment` join table (composite PK pilot_id+spa_id) - mirrors Phase 3's force-special-abilities pattern but for pilots. Migration `81c5b91ac451`.
- `backend/routers/pilot_special_abilities.py`: `GET/POST /api/pilot-special-abilities`, `DELETE /api/pilot-special-abilities/{id}` (cascades assignment rows), `GET/PUT /api/pilots/{id}/spa`.
- Additive-only, zero-risk: no existing serializer/router touched; `GET /api/forces/{id}` pilots intentionally do NOT expose SPA data yet. All 19 backend tests pass (Phases 1-5), no regressions.

### Phase 4 (Reference Pools: Achievements & SP Purchases) - Done, tested 100% pass
- `backend/models.py`: added `AchievementDefinition` (id, name, icon, description, condition), `PilotAchievement` (autoincrement PK, pilot_id FK, achievement_id FK, earned_at nullable), `SpChoice` (id, name, cost as Float to support fractional prices like 0.5), `MissionSpPurchase` (id, mission_id FK, choice_id FK nullable, cost_at_purchase/name_at_purchase snapshots). Migration `a28c833e7254`.
- `backend/migrate_reference_data.py`: idempotent script - upserts global catalogs from `data/achievements.json` (16 defs) and `data/sp-choices.json` (25 choices), then get-or-create migrates each pilot's/mission's legacy JSON into `pilot_achievements`/`mission_sp_purchases` (6 links + 6 purchases from real data).
- `backend/routers/achievements.py`: `GET /api/achievement-definitions`, `GET/POST /api/pilots/{id}/achievements` (409 on duplicate, 404 on unknown pilot/definition).
- `backend/routers/sp_choices.py`: `GET /api/sp-choices`, `POST /api/missions/{id}/sp-purchases` (snapshots catalog name/cost at creation time - historical cost never changes even if catalog price is later edited).
- `GET /api/forces/{id}` pilots[].achievements and missions[].spPurchases now sourced from the normalized tables instead of raw JSON blobs.
- Verified core acceptance criteria: repeated purchases of the same choice create distinct line items (real example: ghost-bear M02 has 4 separate `air_hvstrike` entries); catalog price changes don't retroactively alter `cost_at_purchase`. All 17 backend tests pass (Phases 1-4).

### Phase 3 (Reference Pools: Special Abilities) - Done, tested 100% pass
- `backend/models.py`: added `SpecialAbility` (id, name unique, description) and `ForceSpecialAbility` join table (composite PK force_id+ability_id). Migration `27b52250a900`.
- `backend/migrate_special_abilities.py`: idempotent, get-or-create dedupe migration (importable `migrate(session)`); parses each Force's legacy `special_abilities` JSON column into the pool + join rows. Currently 0/0 for real data since neither manifest-imported force has specialAbilities yet.
- `backend/routers/special_abilities.py`: `GET/POST /api/special-abilities`, `DELETE /api/special-abilities/{id}`, `GET/PUT /api/forces/{id}/special-abilities`.
- `GET /api/forces/{id}` now sources `specialAbilities` from the join table (serialized as `[{id, title, description}]`, `title` key preserved for frontend contract compatibility) instead of the raw JSON blob.
- Swagger UI moved under `/api/docs` (+ `/api/redoc`, `/api/openapi.json`) so it's externally reachable through the ingress (which only proxies `/api/*`).
- `backend/tests/test_special_abilities.py`: dedup-across-two-forces test (1 pool row + 2 join rows, self-cleaning) + full CRUD/linking flow test. All 12 backend tests pass (Phase 1+2+3).
