# BattleTech Forces Manager – Technical README

This document is aimed at developers who want to work on the source, extend the app, or adjust its internal behaviour.

---

## 1. Architecture Overview

### 1.1 Runtime

The app is a **React frontend** + **FastAPI backend** + **SQLite database**:

- `frontend/` – React 18 + Tailwind SPA. Calls the backend exclusively through `REACT_APP_BACKEND_URL` + `/api/*` routes (see `frontend/src/lib/api.js`).
- `backend/` – FastAPI app (`server.py`), SQLAlchemy models (`models.py`), Alembic migrations (`alembic/`), per-resource routers (`routers/`), an `admin/` namespace for global/operational configuration, and a `services/` layer for logic shared across routers (force state serialization).
- `data/btforce.db` – the live SQLite database, bind-mounted into the backend container. It ships prefilled with the full reference catalog (mech catalog, achievements, SP choices, downtime actions). There are no JSON/CSV data files or import scripts left in the repo as a data source; the repo instead ships a `data/renameme.btforce.db` template used only to seed a brand-new `data/btforce.db` on first run (see §1.2).
- `backend/watcher.py` + `backend/import_mech_catalog.py` – the only remaining CSV-related code, and it's operational rather than a data source: drop a mech catalog CSV (e.g. exported from MekBay) into the watched folder and it's imported automatically, run `import_mech_catalog.py <path>` manually, or use the in-app Admin uploader (`admin/mech_catalog.py`). See README.md's "Updating the Mech Catalog" section.

### 1.2 Deployment

See `DEPLOYMENT.md` for the full Docker Compose runbook (Synology NAS or any Docker host). In short: `docker compose up -d --build` builds and starts both containers. The backend container's entrypoint script first checks whether `/data/btforce.db` exists; if not, it copies the committed `data/renameme.btforce.db` template to `data/btforce.db` (this seeds a brand-new deployment only - an existing live DB is never overwritten). It then runs Alembic migrations against whatever `data/btforce.db` is present, and starts the API server. There is no other seeding/import step, and no scripted reset. To reset data, replace `data/btforce.db` manually (see DEPLOYMENT.md's "Resetting data" section).

### 1.3 Admin namespace

`backend/admin/` exposes a separate `/api/admin/...` namespace, kept independent of the "play" APIs used by Mission Manager, Downtime, and force operations. It's the only place with write access to global/app-scoped configuration:

- `admin/router.py` - `GET /api/admin/health`.
- `admin/sp_choices.py` - full CRUD for the global SP purchase catalog (`SpChoice`). The play-facing `GET /api/sp-choices` stays read-only.
- `admin/downtime_actions.py` - full CRUD for the global downtime action catalog (`DowntimeAction`). The play-facing `GET /api/downtime-actions` stays read-only.
- `admin/achievements.py` - full CRUD for global achievement definitions (`AchievementDefinition`). The play-facing `GET /api/achievement-definitions` stays read-only. Deleting a definition also removes any `PilotAchievement` rows referencing it.
- `admin/mech_catalog.py` - `POST /api/admin/mech-catalog/import`, accepting a MekBay CSV upload and running it through the same `import_catalog()` upsert-by-MUL-ID logic used by the manual script and the watched-folder mechanism (`watcher.py`). This is the primary in-app path; the watched folder remains available for Docker/ops workflows (see DEPLOYMENT.md).

Force CRUD (`POST/PUT/DELETE /api/forces`, `routers/forces_write.py`) is exposed under the regular `/api/forces` prefix and is used directly by the Admin UI's Forces panel - it is not duplicated under `/api/admin`. Admin vs. play is a pure frontend/UI distinction (`components/AdminView.jsx` and its `components/admin/*` panels), reachable only via the header's Admin entry point (`data-testid="admin-entry-btn"`) - there are no accounts or roles.

Two `Force` fields exist specifically for Admin-configured Warchest setup: `startingDate` (campaign start date, default `"3025-01-01"`) and `wpMultiplier` (the Warchest-to-Support-Point conversion rate used by the Downtime tab, default `10`). Both are set via the same `POST`/`PUT /api/forces` payload the Admin Forces panel uses.

### 1.4 Force state serialization/deserialization service

`backend/services/force_state.py` is the single source of truth for turning a force (plus all of its mechs/pilots/elementals/missions/special abilities) into the JSON contract described in section 7 below, and back:

- `serialize_force(session, force_id)` – produces the export/detail JSON. Used by `GET /api/forces/{id}`, `GET /api/forces/{id}/export`, and `POST /api/forces/{id}/state-snapshots` (`routers/forces.py`, `routers/force_snapshots.py`), so Export, the regular detail view, and snapshot creation can never drift apart.
- `deserialize_force(session, force_id, data)` – reconstructs/overwrites a force's full state in the database from that same JSON shape. Used by the snapshot restore endpoint (§1.4.1).

### 1.4.1 Full-state force snapshots (automatic backup + rollback)

`force_snapshots` (`models.py::ForceSnapshot`, `routers/force_snapshots.py`) stores complete, restorable backups of a force - each row is one `serialize_force()` payload plus `label`/`waypointType`/`createdAt` metadata. A snapshot is created automatically:

- On mission creation (`pre-mission`) and mission completion (`post-mission`) - `MissionManager.jsx`.
- After each downtime cycle (`post-downtime`) - `DowntimeOperations.jsx`.

Retention/merge rules, enforced server-side in `routers/force_snapshots.py`:

- At most 3 snapshots are kept per force; creating a 4th deletes the oldest.
- Consecutive `post-downtime` snapshots merge into one (the newer one replaces the older), unless a mission snapshot has occurred in between - a mission always breaks the merge chain.

Endpoints:

- `POST /api/forces/{id}/state-snapshots` - `{label, waypointType}` body; serializes current force state via `serialize_force` and stores it, applying the retention/merge rules above.
- `GET /api/forces/{id}/state-snapshots` - metadata plus a computed display summary (`type`, `currentWarchest`, `netWarchestChange`, `missionsCompleted`, per-status unit counts), most recent first.
- `GET /api/forces/{id}/state-snapshots/{snapshot_id}` - metadata plus the full `snapshotJson` payload.
- `POST /api/forces/{id}/state-snapshots/{snapshot_id}/restore` - restores the force to that snapshot via `deserialize_force`, then deletes every snapshot newer than the one restored to. The frontend's **Snapshots** tab (`SnapshotsTab.jsx`) allows this on every snapshot except the single most recent one.

Images embedded on mechs/elementals/the force at snapshot time are stored as base64 inside the snapshot JSON, so a restore also restores images correctly. App-level catalogs (mech catalog, SP purchases, downtime actions, achievement definitions) are never copied into a snapshot - `serialize_force` only emits force-scoped data (by-value fields and light references like achievement/ability ids), so nothing catalog-wide needs restoring. Deleting a force cascades to `force_snapshots` rows (`routers/forces_write.py::delete_force`), same as the other per-force tables.

> Note: an older, lighter-weight point-in-time `Snapshot`/`FullSnapshot` pair of models (warchest/unit-count stats only, no restorability) has been fully removed and replaced by `force_snapshots` above; there is now a single, unified snapshot mechanism.

### 1.5 Migration harness

The project's migration mechanism is Alembic (`backend/alembic/`): every schema change is a versioned revision file under `alembic/versions/`, and the DB's current version is tracked in the `alembic_version` table inside `data/btforce.db`. `backend/migration_harness.py::run_migrations()` runs `alembic upgrade head` automatically every time the backend starts (called from `server.py`'s FastAPI `lifespan`, in addition to the Docker entrypoint already running it as a separate step) - a no-op on an up-to-date database, and safe to run repeatedly. To add a new migration later: `cd backend && alembic revision --autogenerate -m "..."`; it's picked up automatically on the next restart, no code changes needed here.

### 1.6 Force roster CRUD and deletion behavior

Mechs, elementals, and pilots each have full create/edit/delete endpoints (`routers/mechs.py`, `elementals.py`, `pilots.py`) and matching UI in `MechRoster.jsx`/`ElementalRoster.jsx`/`PilotRoster.jsx` (click a row to edit any field, including catalog-sourced ones like name/BV/weight; a trash-icon button per row deletes, gated by a confirmation prompt). The frontend never calls these endpoints directly - `hooks/forceSync.js` diffs the in-memory force against the last-synced state and issues the create/update/delete calls itself, so removing an entity from the local array is enough to trigger its deletion.

Documented deletion behavior (no soft-delete, no blocking - all three are hard deletes with an explicit, narrow cascade):

- **Mech / Elemental**: deleting one just deletes that row (and its `image_data`, if any). Nothing else references a mech/elemental by id at the DB level; a since-deleted unit's id lingering in a past mission's `assignedMechs`/`assignedElementals` list is expected and handled gracefully by the frontend (`lib/missions.js::getAssignedMechs/getAssignedElementals` filter out ids no longer in the roster) - mission history keeps `totalTonnage`/BV numbers already computed at completion time, it doesn't crash or refetch a deleted unit.
- **Pilot**: deleting a pilot removes it and cascades to `PilotAchievement` and `PilotSpaAssignment` link rows (`routers/pilots.py::delete_pilot`). The pilot's own `combatRecord` (kills, assists, mission history) is embedded JSON on the pilot row itself, so it's deleted with the pilot - by design, since it belongs to that pilot and nothing else reads it. Global catalogs (`achievement_definitions`, `pilot_special_abilities`) are never touched by a pilot delete. Any mech the pilot was flying is **unassigned, not deleted** - `pilot_id` is cleared to `""` server-side, and the frontend mirrors the same unassignment locally for immediate UI consistency.

### 1.7 Image uploads (forces, mechs, elementals)

`routers/images.py` exposes a generic, DB-backed image upload/fetch/delete API shared across `forces`, `mechs`, and `elementals`:

- `POST /api/{forces|mechs|elementals}/{entity_id}/image` - multipart upload; accepts PNG/JPEG/WEBP/GIF up to 5MB, stores the bytes on the entity's `image_data`/`image_mime_type` columns.
- `GET /api/{forces|mechs|elementals}/{entity_id}/image` - streams the stored bytes back with the correct content type.
- `DELETE /api/{forces|mechs|elementals}/{entity_id}/image` - clears the image.

Images are stored in the SQLite database itself, not on disk, so they're covered by the same `data/btforce.db` backup and are included in snapshot/export payloads (embedded as base64 where relevant). Pilots do not yet have image support. Large uploads are not automatically compressed - keep source images reasonably sized.

### 1.8 Financial ledger

`frontend/src/lib/ledger.js` (`buildLedgerEntries`, `summariseLedger`) derives a chronological, per-force transaction log purely from existing data (mission costs/rewards/SP purchases, downtime action costs) - there is no separate ledger table; it's computed client-side on each render from the force's missions/mechs/elementals/pilots. `components/LedgerTab.jsx` renders it as a table with running totals (starting/current Warchest, total spent/gained, net change).

### 1.9 Dead code note

`frontend/src/components/RepairBay.jsx` is an explicitly-marked legacy stub (renders `null`) kept only for reference from the pre-`DowntimeOperations` repair system. It is not imported anywhere in `App.js` and can be deleted in a future cleanup pass.

---

## 2. Repository Layout

```text
/app
├── README.md                 # User-facing overview
├── TECHNICAL_README.md       # This file – developer documentation
├── DEPLOYMENT.md             # Docker Compose deployment runbook
├── docker-compose.yml
├── data/
│   ├── btforce.db              # The live SQLite database (gitignored after first seed on a NAS)
│   └── renameme.btforce.db     # Committed seed template, copied to btforce.db only if it's missing
├── backend/
│   ├── server.py              # FastAPI app entrypoint
│   ├── models.py               # SQLAlchemy models
│   ├── database.py             # Engine/session setup (reads DATABASE_URL)
│   ├── migration_harness.py    # Run-on-start Alembic migration harness
│   ├── alembic/                # Migrations
│   ├── admin/                  # Admin namespace (/api/admin/...): SP/downtime/achievements CRUD, mech catalog import
│   ├── services/                # Shared logic (force state serialization/deserialization)
│   ├── routers/                # One module per resource (forces, mechs, downtime, images, force_snapshots, ...)
│   ├── domain/                  # Pure business logic (downtime formulas, achievements, ...)
│   ├── watcher.py               # Watched-folder mech catalog auto-import
│   ├── import_mech_catalog.py   # Manual/operational mech catalog CSV importer
│   └── tests/                   # pytest suite
└── frontend/                  # React + Tailwind source
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── App.js
        ├── index.js
        ├── index.css
        ├── components/          # Roster tabs, MissionManager, DowntimeOperations, LedgerTab, SnapshotsTab, AdminView + admin/*
        ├── hooks/                # useForceManager, forceSync (diff-based sync to backend)
        └── lib/                  # Pure logic: missions, achievements, downtime, mechs, pilots, ledger, utils
```

---

## 3. Running & Building

### 3.1 Backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn server:app --host 0.0.0.0 --port 8001
```

`DATABASE_URL` (in `backend/.env`) must point at the SQLite file, e.g. `sqlite+aiosqlite:////app/data/btforce.db`.

### 3.2 Frontend dev server

```bash
cd frontend
yarn install
yarn start
# http://localhost:3000/
```

`REACT_APP_BACKEND_URL` (in `frontend/.env`) must point at the running backend.

### 3.3 Production build

```bash
cd frontend
yarn build
```

For containerized deployment, see `DEPLOYMENT.md` - the backend and frontend Dockerfiles handle building/serving automatically via `docker compose up -d --build`.

---

## 4. Support Points (SP) Data Model

Support Point (SP) purchases allow players to buy tactical support during mission setup. They're stored in the `sp_choices` table (see `models.py::SpChoice`), managed via `admin/sp_choices.py`, and served read-only via `GET /api/sp-choices`.

### 4.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (used internally) |
| `name` | string | Display name shown in dropdown |
| `cost` | number | SP cost for this purchase |

### 4.2 How it works in the app

- Mission dialog shows SP Budget field.
- When budget > 0, a dropdown appears with available choices.
- Items with cost > remaining budget are disabled.
- Selected items create a `MissionSpPurchase` row (`POST /api/missions/{id}/sp-purchases`), snapshotting the catalog's name/cost at purchase time so later price changes don't retroactively alter history.
- Purchases appear in mission cards, the Ledger, and PDF export.

---

## 5. Achievements Data Model

Achievements are automatically awarded to pilots based on their combat records. Definitions live in the `achievement_definitions` table (see `models.py::AchievementDefinition`), managed via `admin/achievements.py`, and served read-only via `GET /api/achievement-definitions`.

### 5.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (stored per-pilot via `PilotAchievement`) |
| `name` | string | Display name |
| `icon` | string | Icon (shown in web UI only, not PDF) |
| `description` | string | Achievement description |
| `condition` | string | Condition expression (see below) |

### 5.2 Condition expressions

Conditions are evaluated against computed combat stats. Available variables:

| Variable | Description |
|----------|-------------|
| `killCount` | Total number of kills |
| `assists` | Total assists |
| `missionsCompleted` | Missions participated in |
| `missionsWithoutInjury` | Consecutive missions without taking injury |
| `totalInjuriesHealed` | Cumulative injuries healed |
| `lightKills` | Kills of 20-35 ton mechs |
| `mediumKills` | Kills of 40-55 ton mechs |
| `heavyKills` | Kills of 60-75 ton mechs |
| `assaultKills` | Kills of 80-100 ton mechs |
| `totalTonnageDestroyed` | Sum of all kill tonnages |
| `maxTonnageKill` | Heaviest single mech destroyed |

Supported operators: `>=`, `>`, `<=`, `<`, `===`

Compound conditions use `&&`:
```
"condition": "missionsCompleted >= 5 && totalInjuriesTaken === 0"
```

### 5.3 Weight class boundaries

For weight-class achievements, mechs are classified as:

| Class | Tonnage Range |
|-------|---------------|
| Light | 20-35 tons |
| Medium | 40-55 tons |
| Heavy | 60-75 tons |
| Assault | 80-100 tons |

### 5.4 How achievements work

1. During mission completion, kills/assists are logged per pilot.
2. `lib/achievements.js` (frontend) / `domain/achievements_logic.py` (backend) compute stats from `pilot.combatRecord`.
3. Each achievement condition is evaluated against stats.
4. New achievements trigger a popup dialog.
5. Earned achievements are stored as `PilotAchievement` rows (normalized, not embedded JSON).
6. Displayed as badges in Pilot Roster (hover for details).
7. PDF export shows achievement names only.

---

## 6. Frontend Structure & Key Modules

### 6.1 Top level

- `src/App.js`
  - Header with force selector, PDF export, JSON export, and Admin entry point.
  - Force banner showing current Warchest, in-universe date, BV totals, special abilities, and optional image.
  - Tabbed content for Mechs, Elementals, Pilots, Missions, Downtime, Ledger, Notes, Snapshots.

- `src/hooks/useForceManager.js`
  - Fetches forces from `GET /api/forces` and `GET /api/forces/{id}`.
  - Manages `forces`, `selectedForceId`, `selectedForce`.
  - Exposes `updateForceData`, `exportForce`, `refreshForces`, `flushForceSync`, loading/error state.

- `src/hooks/forceSync.js`
  - Diffs the in-memory force against the last backend-confirmed state and issues the minimal set of create/update/delete API calls (debounced), so UI edits sync to the backend without a full re-save of the whole force.

### 6.2 Libraries

- `src/lib/utils.js`
  - `cn(...classes)` – Tailwind class merging.
  - `formatNumber(num)` – apostrophe (`'`) as thousands separator.
  - `formatDate(date)` – localized timestamp.
  - `downloadJSON(data, filename)` – triggers a JSON file download.

- `src/lib/constants.js`
  - `UNIT_STATUS` – central enum of unit statuses.
  - `getStatusBadgeVariant(status)` – maps status to UI badge variant.
  - `DOWNTIME_ACTION_IDS` – downtime action identifiers.

- `src/lib/missions.js`
  - `isMechAvailableForMission(force, mech)` – enforces mission-availability rules.
  - `isElementalAvailableForMission(elemental)` – elemental availability rules.
  - `calculateMissionTotalBV(force, mechIds, elementalIds)` – sums adjusted BV.
  - `calculateMissionTotalTonnage(force, mechIds)` – sums mech tonnage.
  - `applyMissionCreation`, `applyMissionUpdate`, `applyMissionCompletion` – mission lifecycle (each now also triggers a `state-snapshots` call from `MissionManager.jsx`).

- `src/lib/achievements.js`
  - `getWeightClass(tonnage)` – returns light/medium/heavy/assault.
  - `computeCombatStats(combatRecord)` – calculates all stat variables.
  - `checkCondition(condition, stats)` – evaluates condition string.
  - `checkAchievements(combatRecord, definitions)` – returns earned achievement IDs.
  - `findNewAchievements(prev, current)` – identifies newly earned achievements.
  - `createEmptyCombatRecord()`, `addKill()`, `addAssists()`, `recordMissionCompletion()` – combat record helpers.

- `src/lib/downtime.js`
  - `buildDowntimeContext`, `evaluateDowntimeCost` – formula evaluation.
  - `applyMechDowntimeAction`, `applyElementalDowntimeAction`, `applyPilotDowntimeAction`.

- `src/lib/mechs.js`
  - `findPilotForMech`, `findMechForPilot` – relationship lookups.
  - `getBVMultiplier`, `getAdjustedBV`, `getMechAdjustedBV` – BV calculations.

- `src/lib/pilots.js`
  - `adjustGunnery`, `adjustPiloting`, `adjustInjuries` – stat adjustments.
  - `getPilotDisplayName(pilot)` – returns name with 🚫 if Dezgra.

- `src/lib/ledger.js`
  - `buildLedgerEntries(force)` – derives a chronological transaction log from missions/downtime/SP purchases.
  - `summariseLedger(entries, currentWarchest, startingWarchest)` – running totals (spent, gained, net).

### 6.3 Feature components

- `components/MechRoster.jsx` – Mech table with status, pilot, BV, weight, image upload.
- `components/MechAutocomplete.jsx` – Searchable mech catalog dropdown.
- `components/PilotRoster.jsx` – Pilot table with kills, achievements, injuries.
- `components/ElementalRoster.jsx` – Elemental points management, image upload.
- `components/MissionManager.jsx` – Mission CRUD, SP purchases, kill tracking, achievement popup, automatic pre/post-mission snapshots.
- `components/DowntimeOperations.jsx` – Downtime actions with formula costs; automatic post-downtime snapshot per cycle.
- `components/LedgerTab.jsx` – Read-only financial ledger view (`lib/ledger.js`).
- `components/SnapshotsTab.jsx` – DB-backed snapshot history with rollback.
- `components/AdminView.jsx` – Tabbed Admin modal (Forces, Mech Catalog, SP Purchases, Downtime, Achievements), reachable only via the header's Admin entry point.
- `components/admin/*` – Admin panels: `AdminForcesPanel.jsx` (force CRUD + Warchest setup), `AdminMechCatalogPanel.jsx` (CSV import + watched-folder status), `AdminSpChoicesPanel.jsx`, `AdminDowntimeActionsPanel.jsx`, `AdminAchievementsPanel.jsx`, `EmojiPicker.jsx`.
- `components/PDFExport.jsx` – PDF generation with combat records.
- `components/NotesTab.jsx` – Campaign notes editor.
- `components/RepairBay.jsx` – Dead code, see §1.9.
- `components/ui/*` – Reusable UI components.

---

## 7. Data Contracts

### 7.1 Forces

`GET /api/forces/{id}` returns:

- `id`, `name`, `description`, optional `image`.
- `startingWarchest`, `currentWarchest`, `wpMultiplier`.
- `currentDate` – in-universe campaign date (YYYY-MM-DD format).
- `startingDate` – campaign start date (YYYY-MM-DD format), default `"3025-01-01"`.
- `specialAbilities[]` – optional array of `{ id, title, description }`.
- Arrays: `mechs[]`, `pilots[]`, `elementals[]`, `missions[]`.

Full-state history is no longer embedded here - see `GET /api/forces/{id}/state-snapshots` (§1.4.1). This same shape is what `Force`/`Mech`/`Pilot`/... in `models.py` serialize to via `services/force_state.py`.

### 7.2 Pilot combat record

Pilots may have a `combatRecord` object:

```json
{
  "combatRecord": {
    "kills": [
      { "mechModel": "Atlas AS7-D", "tonnage": 100, "mission": "M01", "date": "3052-05-01" }
    ],
    "assists": 2,
    "missionsCompleted": 5,
    "missionsWithoutInjury": 3,
    "totalInjuriesHealed": 1
  },
  "achievements": ["first-blood", "ace", "veteran"]
}
```

### 7.3 Mission with SP purchases and tonnage

```json
{
  "id": "mission-123",
  "name": "Assault on Base Alpha",
  "cost": 50,
  "spBudget": 100,
  "spPurchases": [
    { "id": "sp-1", "choiceId": "artillery-strike", "name": "Artillery Strike", "cost": 50 }
  ],
  "totalTonnage": 245,
  "assignedMechs": ["mech-1", "mech-2"],
  "objectives": [...],
  "completed": false
}
```

### 7.4 Downtime actions

Stored in the `downtime_actions` table, served flat via `GET /api/downtime-actions` (each row has `id`, `name`, `description`, `category`, `formula`, `flags`). Managed via `admin/downtime_actions.py`. See README.md for the formula/action semantics.

### 7.5 Mech catalog

The mech catalog (`mech_catalog` table, served via `GET /api/mech-catalog?search=...`) provides autocomplete for adding mechs and logging kills. Sourced from [MekBay](https://next.mekbay.com); update it via the Admin CSV upload, the watched-folder auto-import, or `backend/import_mech_catalog.py` (see README.md's "Updating the Mech Catalog").

> **Copyright Notice:** This app contains MegaMek data (copyright 2025 The MegaMek Team), licensed under CC BY-NC-SA 4.0.

### 7.6 Force state snapshots

`GET /api/forces/{id}/state-snapshots` returns, per snapshot, most recent first:

```json
{
  "id": "snap-1",
  "label": "Assault on Base Alpha",
  "waypointType": "post-mission",
  "createdAt": "2026-08-12T04:27:00Z",
  "currentWarchest": 1200,
  "netWarchestChange": -50,
  "missionsCompleted": 6,
  "units": {
    "mechs": { "byStatus": { "operational": 8, "damaged": 1, "destroyed": 0, "...": 0 } },
    "elementals": { "byStatus": { "operational": 3, "...": 0 } }
  }
}
```

`GET /api/forces/{id}/state-snapshots/{snapshot_id}` additionally includes `snapshotJson`, the full `serialize_force()` payload at that point in time (images embedded as base64).

### 7.7 Images

`GET/POST/DELETE /api/{forces|mechs|elementals}/{entity_id}/image` - see §1.7. The `image` field on a force/mech/elemental in the regular detail responses is a URL to this endpoint, not embedded data (except inside snapshot JSON, where it is embedded as base64 - see §1.4.1).

---

## 8. Conventions & Notes

- **IDs:** Timestamp-based IDs like `mech-<timestamp>`; unique within force.
- **Status badges:** Centralised in `lib/constants.js` as `UNIT_STATUS`.
- **Pilot–mech relationship:** Mechs store `pilotId` reference.
- **KIA handling:** Pilot with `injuries === 6` is KIA.
- **Dezgra pilots:** Marked with 🚫 in web UI, `[Dezgra]` in PDF.
- **Adjusted BV:** Base BV × skill multiplier (1.0× at 4/5).
- **Emoji in PDF:** Not supported by react-pdf; achievements show names only.
- **Images:** stored as raw bytes + MIME type in the DB, not on disk; not automatically compressed on upload.

---

## 9. Tech Stack Summary

- **Frontend:** React 18, Tailwind CSS, `lucide-react` icons, `@react-pdf/renderer` for PDFs.
- **Backend:** FastAPI, SQLAlchemy (async) + Alembic migrations, `watchdog` for the catalog watcher.
- **Database:** SQLite, single live file at `data/btforce.db` (seeded from `data/renameme.btforce.db` on first run only).
- **State:** Frontend React state, hydrated from/persisted to the backend API via a diff-based sync (`hooks/forceSync.js`); no client-side JSON persistence.

---

## 10. Testing

Frontend game logic is covered by unit tests in `frontend/src/lib/*.test.js`; backend logic/endpoints are covered by `backend/tests/*.py` (pytest).

### Running frontend tests

```bash
cd frontend
yarn install
yarn test              # interactive watch mode
yarn test --watch=false  # single run (CI)
```

### Running backend tests

```bash
cd backend
python3 -m pytest -q
```

### Frontend test files

- `downtime.test.js` – downtime expression parser
- `missions.test.js` – mission lifecycle, BV calculation
- `mechs.test.js` – pilot-mech relationships, BV multipliers
- `ledger.test.js` – financial ledger construction
- `snapshots.test.js` – snapshot date-advance helper (`advanceDateString`)

---

## 11. Development Workflow

1. Edit React code under `frontend/src` and/or backend code under `backend/`.
2. Run `yarn start` (frontend) and `uvicorn server:app --reload` (backend, or rely on the supervisor-managed hot reload in the dev sandbox) while iterating.
3. Run `yarn test --watch=false` and `python3 -m pytest -q` before committing.
4. For deployment, see `DEPLOYMENT.md` (Docker Compose) - `docker compose up -d --build` handles both containers, migrations, and (on a fresh `data/` folder only) the initial DB seed.
