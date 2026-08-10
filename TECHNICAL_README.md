# BattleTech Forces Manager – Technical README

This document is aimed at developers who want to work on the source, extend the app, or adjust its internal behaviour.

---

## 1. Architecture Overview

### 1.1 Runtime

The app is a **React frontend** + **FastAPI backend** + **SQLite database**:

- `frontend/` – React 18 + Tailwind SPA. Calls the backend exclusively through `REACT_APP_BACKEND_URL` + `/api/*` routes (see `frontend/src/lib/api.js`).
- `backend/` – FastAPI app (`server.py`), SQLAlchemy models (`models.py`), Alembic migrations (`alembic/`), per-resource routers (`routers/`), an `admin/` namespace for global/operational tooling, and a `services/` layer for logic shared across routers (force state serialization).
- `data/btforce.db` – the single, committed SQLite database. It ships prefilled with the full reference catalog (mech catalog, achievements, SP choices, downtime actions) and any campaign forces already created. There is no separate "example" vs "live" database - the file in the repo is the one the app runs against, and there are no JSON/CSV data files or import scripts left in the repo as a data source.
- `backend/watcher.py` + `backend/import_mech_catalog.py` – the only remaining CSV-related code, and it's operational rather than a data source: drop a mech catalog CSV (e.g. exported from MekHQ/MUL) into the watched folder and it's imported automatically, or run `import_mech_catalog.py <path>` manually. See README.md's "Updating the Mech Catalog" section.

### 1.2 Deployment

See `DEPLOYMENT.md` for the full Docker Compose runbook (Synology NAS or any Docker host). In short: `docker compose up -d --build` builds and starts both containers, Alembic migrations run automatically against the bind-mounted `data/btforce.db`, and there is no seeding/import step at boot. The startup sequence (both in Docker and in local dev) is always exactly: run Alembic migrations, then start the server - never anything that inspects the DB and conditionally imports data. A cloned repo is assumed to already have a non-empty, ready-to-use `data/btforce.db`; there is no "first boot" concept. To reset data, replace the DB file manually (see DEPLOYMENT.md's "Resetting data" section) - there is no scripted reset.

### 1.3 Admin namespace

`backend/admin/` exposes a separate `/api/admin/...` namespace, kept independent of the "play" APIs used by Mission Manager, Downtime, and force operations. It's the only place with write access to global/app-scoped configuration:

- `admin/router.py` - `GET /api/admin/health`.
- `admin/sp_choices.py` - full CRUD for the global SP purchase catalog (`SpChoice`). The play-facing `GET /api/sp-choices` stays read-only.
- `admin/downtime_actions.py` - full CRUD for the global downtime action catalog (`DowntimeAction`). The play-facing `GET /api/downtime-actions` stays read-only.
- `admin/achievements.py` - full CRUD for global achievement definitions (`AchievementDefinition`). The play-facing `GET /api/achievement-definitions` stays read-only. Deleting a definition also removes any `PilotAchievement` rows referencing it.
- `admin/mech_catalog.py` - `POST /api/admin/mech-catalog/import`, accepting a MekBay CSV upload and running it through the same `import_catalog()` upsert-by-MUL-ID logic used by the manual script and the watched-folder mechanism (`watcher.py`). This is the primary in-app path; the watched folder remains available for Docker/ops workflows (see DEPLOYMENT.md).

Force CRUD itself (`POST/PUT/DELETE /api/forces`) is **not** duplicated under `/api/admin` - the Admin UI's Forces section reuses the existing play-facing endpoints directly. Admin vs. play is a pure frontend/UI distinction (`components/AdminView.jsx` and its `components/admin/*` panels), reachable only via the header's Admin entry point - there are no accounts or roles.

Two Force fields exist specifically for Admin-configured Warchest setup: `startingDate` (campaign start date, default `"3025-01-01"`) and the pre-existing `wpMultiplier` (the Warchest-to-Support-Point conversion rate used by the Downtime tab, default now `10`). Both are set via the same `POST`/`PUT /api/forces` payload the Admin Forces panel uses.

### 1.4 Force state serialization/deserialization service

`backend/services/force_state.py` is the single source of truth for turning a force (plus all of its mechs/pilots/elementals/missions/snapshots/special abilities) into the JSON contract described in section 7 below, and back:

- `serialize_force(session, force_id)` – produces the export/detail JSON. Used by both `GET /api/forces/{id}` and the dedicated `GET /api/forces/{id}/export` endpoint (`routers/forces.py`), so Export and the regular detail view can never drift apart.
- `deserialize_force(session, force_id, data)` – reconstructs/overwrites a force's full state in the database from that same JSON shape. Not wired to any endpoint yet; it exists so force-level snapshot restore (a later issue) can call it directly instead of duplicating serialization logic.

### 1.5 Migration harness

The project's migration mechanism is Alembic (`backend/alembic/`): every schema change is a versioned revision file under `alembic/versions/`, and the DB's current version is tracked in the `alembic_version` table inside `data/btforce.db`. `backend/migration_harness.py::run_migrations()` runs `alembic upgrade head` automatically every time the backend starts (called from `server.py`'s FastAPI `lifespan`, in addition to the Docker entrypoint already running it as a separate step) - a no-op on an up-to-date database, and safe to run repeatedly. To add a new migration later: `cd backend && alembic revision --autogenerate -m "..."`; it's picked up automatically on the next restart, no code changes needed here.

### 1.6 Force roster CRUD and deletion behavior

Mechs, elementals, and pilots each have full create/edit/delete endpoints (`routers/mechs.py`, `elementals.py`, `pilots.py`) and matching UI in `MechRoster.jsx`/`ElementalRoster.jsx`/`PilotRoster.jsx` (click a row to edit any field, including catalog-sourced ones like name/BV/weight; a trash-icon button per row deletes, gated by a confirmation prompt). The frontend never calls these endpoints directly - `hooks/forceSync.js` diffs the in-memory force against the last-synced state and issues the create/update/delete calls itself, so removing an entity from the local array is enough to trigger its deletion.

Documented deletion behavior (no soft-delete, no blocking - all three are hard deletes with an explicit, narrow cascade):

- **Mech / Elemental**: deleting one just deletes that row. Nothing else references a mech/elemental by id at the DB level; a since-deleted unit's id lingering in a past mission's `assignedMechs`/`assignedElementals` list is expected and handled gracefully by the frontend (`lib/missions.js::getAssignedMechs/getAssignedElementals` filter out ids no longer in the roster) - mission history keeps `totalTonnage`/BV numbers already computed at completion time, it doesn't crash or refetch a deleted unit.
- **Pilot**: deleting a pilot removes it and cascades to `PilotAchievement` and `PilotSpaAssignment` link rows (`routers/pilots.py::delete_pilot`). The pilot's own `combatRecord` (kills, assists, mission history) is embedded JSON on the pilot row itself, so it's deleted with the pilot - by design, since it belongs to that pilot and nothing else reads it. Global catalogs (`achievement_definitions`, `pilot_special_abilities`) are never touched by a pilot delete. Any mech the pilot was flying is **unassigned, not deleted** - `pilot_id` is cleared to `""` server-side, and the frontend mirrors the same unassignment locally for immediate UI consistency.

---

## 2. Repository Layout

```text
/app
├── README.md                 # User-facing overview
├── TECHNICAL_README.md       # This file – developer documentation
├── DEPLOYMENT.md             # Docker Compose deployment runbook
├── docker-compose.yml
├── data/
│   └── btforce.db             # The single committed, live SQLite database
├── backend/
│   ├── server.py              # FastAPI app entrypoint
│   ├── models.py               # SQLAlchemy models
│   ├── database.py             # Engine/session setup (reads DATABASE_URL)
│   ├── migration_harness.py    # Run-on-start Alembic migration harness
│   ├── alembic/                # Migrations
│   ├── admin/                  # Admin namespace (/api/admin/...), scaffolding
│   ├── services/                # Shared logic (force state serialization/deserialization)
│   ├── routers/                # One module per resource (forces, mechs, downtime, ...)
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
        ├── components/
        ├── hooks/
        └── lib/
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

Support Point (SP) purchases allow players to buy tactical support during mission setup. They're stored in the `sp_choices` table (see `models.py::SpChoice`) and served via `GET /api/sp-choices`.

### 4.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (used internally) |
| `name` | string | Display name shown in dropdown |
| `cost` | number | SP cost for this purchase |

### 4.2 How it works in the app

- Mission dialog shows SP Budget field
- When budget > 0, a dropdown appears with available choices
- Items with cost > remaining budget are disabled
- Selected items create a `MissionSpPurchase` row (`POST /api/missions/{id}/sp-purchases`), snapshotting the catalog's name/cost at purchase time so later price changes don't retroactively alter history
- Purchases appear in mission cards and PDF export

---

## 5. Achievements Data Model

Achievements are automatically awarded to pilots based on their combat records. Definitions live in the `achievement_definitions` table (see `models.py::AchievementDefinition`), served via `GET /api/achievement-definitions`.

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

1. During mission completion, kills/assists are logged per pilot
2. `lib/achievements.js` (frontend) / `domain/achievements_logic.py` (backend) compute stats from `pilot.combatRecord`
3. Each achievement condition is evaluated against stats
4. New achievements trigger a popup dialog
5. Earned achievements are stored as `PilotAchievement` rows (normalized, not embedded JSON)
6. Displayed as badges in Pilot Roster (hover for details)
7. PDF export shows achievement names only

---

## 6. Frontend Structure & Key Modules

### 6.1 Top level

- `src/App.js`
  - Header with force selector, export actions and PDF button.
  - Force banner showing current Warchest, counts, special abilities, and optional image.
  - Tabbed content for Mechs, Elementals, Pilots, Missions, Downtime, Notes, Data Editor.

- `src/hooks/useForceManager.js`
  - Fetches forces from `GET /api/forces` and `GET /api/forces/{id}`.
  - Manages `forces`, `selectedForceId`, `selectedForce`.
  - Exposes `updateForceData`, `addNewForce`, `exportForce`, loading/error state.

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
  - `applyMissionCreation`, `applyMissionUpdate`, `applyMissionCompletion` – mission lifecycle.

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

### 6.3 Feature components

- `components/MechRoster.jsx` – Mech table with status, pilot, BV, weight.
- `components/MechAutocomplete.jsx` – Searchable mech catalog dropdown.
- `components/PilotRoster.jsx` – Pilot table with kills, achievements, injuries.
- `components/ElementalRoster.jsx` – Elemental points management.
- `components/MissionManager.jsx` – Mission CRUD, SP purchases, kill tracking, achievement popup.
- `components/DowntimeOperations.jsx` – Downtime actions with formula costs.
- `components/DataEditor.jsx` – JSON editor for force data.
- `components/PDFExport.jsx` – PDF generation with combat records.
- `components/NotesTab.jsx` – Campaign notes editor.
- `components/ui/*` – Reusable UI components.

---

## 7. Data Contracts

### 7.1 Forces

`GET /api/forces/{id}` returns:

- `id`, `name`, `description`, optional `image`.
- `startingWarchest`, `currentWarchest`, optional `wpMultiplier`.
- `currentDate` – in-universe campaign date (YYYY-MM-DD format).
- `specialAbilities[]` – optional array of `{ id, title, description }`.
- Arrays: `mechs[]`, `pilots[]`, `elementals[]`, `missions[]`.
- `snapshots[]`, `fullSnapshots[]` – campaign state history.

This same shape is what `Force`/`Mech`/`Pilot`/... in `models.py` serialize to via `serializers.py`.

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

Stored in the `downtime_actions` table, served flat via `GET /api/downtime-actions` (each row has `id`, `name`, `description`, `category`, `formula`, `flags`). See README.md for the formula/action semantics.

### 7.5 Mech catalog

The mech catalog (`mech_catalog` table, served via `GET /api/mech-catalog?search=...`) provides autocomplete for adding mechs and logging kills. Sourced from [MekBay](https://next.mekbay.com); update it via the watched-folder auto-import or `backend/import_mech_catalog.py` (see README.md's "Updating the Mech Catalog").

> **Copyright Notice:** This app contains MegaMek data (copyright 2025 The MegaMek Team), licensed under CC BY-NC-SA 4.0.

---

## 8. Conventions & Notes

- **IDs:** Timestamp-based IDs like `mech-<timestamp>`; unique within force.
- **Status badges:** Centralised in `lib/constants.js` as `UNIT_STATUS`.
- **Pilot–mech relationship:** Mechs store `pilotId` reference.
- **KIA handling:** Pilot with `injuries === 6` is KIA.
- **Dezgra pilots:** Marked with 🚫 in web UI, `[Dezgra]` in PDF.
- **Adjusted BV:** Base BV × skill multiplier (1.0× at 4/5).
- **Emoji in PDF:** Not supported by react-pdf; achievements show names only.

---

## 9. Tech Stack Summary

- **Frontend:** React 18, Tailwind CSS, `lucide-react` icons, `@react-pdf/renderer` for PDFs.
- **Backend:** FastAPI, SQLAlchemy (async) + Alembic migrations, `watchdog` for the catalog watcher.
- **Database:** SQLite, single committed file at `data/btforce.db`.
- **State:** Frontend React state, hydrated from/persisted to the backend API; no client-side JSON persistence.

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
- `snapshots.test.js` – snapshot creation and restoration

---

## 11. Development Workflow

1. Edit React code under `frontend/src` and/or backend code under `backend/`.
2. Run `yarn start` (frontend) and `uvicorn server:app --reload` (backend, or rely on the supervisor-managed hot reload in the dev sandbox) while iterating.
3. Run `yarn test --watch=false` and `python3 -m pytest -q` before committing.
4. For deployment, see `DEPLOYMENT.md` (Docker Compose) - there is no manual bundle-copy step; `docker compose up -d --build` handles both containers.
