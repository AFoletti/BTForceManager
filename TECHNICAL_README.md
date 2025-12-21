# BattleTech Forces Manager – Technical README

This document is aimed at developers who want to work on the source, extend the app, or adjust its internal behaviour.

The root of the repo (`/app`) contains the deployable static app (what GitHub Pages serves). The `frontend/` folder contains the original React + Tailwind source used to build `static/js/main.js` and `static/css/main.css`.

---

## 1. Architecture Overview

### 1.1 Runtime (static app)

The live app is a pure static site:

- `index.html` – entry point, always references `./static/js/main.js` and `./static/css/main.css`.
- `static/js/main.js` – compiled React bundle.
- `static/css/main.css` – compiled Tailwind-based styles.
- `data/` – JSON data used at runtime:
  - `data/forces/manifest.json` – list of force JSON files.
  - `data/forces/*.json` – individual force definitions.
  - `data/downtime-actions.json` – definitions for downtime/repair actions.
  - `data/mech-catalog.json` – mech database for autocomplete (name, tonnage, BV).
- `.nojekyll` – ensures GitHub Pages serves `/static` as-is.

There is **no backend** and no database. All state is in memory and/or JSON.

### 1.2 Source (React app)

The React source is under `frontend/`:

- `frontend/src/` – components, hooks, and utilities.
- `frontend/public/` – assets used at build time.
- `frontend/package.json` – dependencies & scripts (CRA, Tailwind, etc.).

You only need this folder if you want to change the app behaviour or styling and rebuild the static bundles.

---

## 2. Repository Layout

```text
/app
├── .nojekyll                 # Enable static asset serving on GitHub Pages
├── README.md                 # Short user-facing overview
├── TECHNICAL_README.md       # This file – developer documentation
├── index.html                # SPA entry point, loads static/js/main.js
├── package.json              # Optional helper for local static serving
├── data/
│   ├── downtime-actions.json # Downtime/repair definitions
│   ├── mech-catalog.json     # Mech database for autocomplete
│   └── forces/
│       ├── manifest.json     # List of force JSON files
│       └── *.json            # Individual forces
├── static/
│   ├── css/
│   │   └── main.css          # Compiled Tailwind CSS
│   └── js/
│       └── main.js           # Compiled React bundle
├── scripts/
│   └── build-mech-database.py  # Mech catalog builder script
├── .github/
│   └── workflows/
│       └── update-mech-catalog.yml  # GitHub Action to refresh mech catalog
└── frontend/                 # Source app (React + Tailwind)
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

### 3.1 Using the static app locally

You can open `index.html` directly in a browser, or serve the root with a tiny HTTP server:

```bash
cd /app
python3 -m http.server 8080
# then open http://localhost:8080/
```

The app fetches JSON from `./data/...`, so relative paths must remain intact.

### 3.2 Running the React dev server

For development:

```bash
cd frontend
yarn install
yarn start
# http://localhost:3000/
```

The dev server will serve the React app using the same data folder structure.

### 3.3 Rebuilding the production bundle

After editing React source:

```bash
cd frontend
yarn build

# From /app/frontend
cp build/static/js/main*.js ../static/js/main.js
cp build/static/css/main*.css ../static/css/main.css
```

> Do **not** copy `build/index.html`. The root `index.html` is hand-crafted to always load `./static/js/main.js` and `./static/css/main.css`.

After copying, `index.html` + `static/` are in sync with source.

---

## 4. Frontend Structure & Key Modules

### 4.1 Top level

- `src/App.js`
  - Header with force selector, export actions and PDF button.
  - Force banner showing current Warchest, counts, and optional image.
  - Tabbed content for Mechs, Elementals, Pilots, Missions, Downtime, Data Editor.

- `src/hooks/useForceManager.js`
  - Loads `data/forces/manifest.json` and each listed force JSON.
  - Manages `forces`, `selectedForceId`, `selectedForce`.
  - Exposes `updateForceData`, `addNewForce`, `exportForce`, loading/error state.

### 4.2 Libraries

- `src/lib/utils.js`
  - `cn(...classes)` – Tailwind class merging.
  - `formatNumber(num)` – apostrophe (`'`) as thousands separator.
  - `formatDate(date)` – localized timestamp.
  - `downloadJSON(data, filename)` – triggers a JSON file download.

- `src/lib/utils.js`
  - `cn(...classes)` – Tailwind class merging.
  - `formatNumber(num)` – apostrophe (`'`) as thousands separator.
  - `formatDate(date)` – localized timestamp.
  - `downloadJSON(data, filename)` – triggers a JSON file download.

- `src/lib/constants.js`
  - `UNIT_STATUS` – central enum of unit statuses (`Operational`, `Damaged`, `Disabled`, `Destroyed`, `Repairing`, `Unavailable`).
  - `getStatusBadgeVariant(status)` – maps a domain status to a UI badge variant used across rosters, mission editor, and PDF export.
  - `DOWNTIME_ACTION_IDS` – central list of downtime action identifiers used by `data/downtime-actions.json` and `lib/downtime.js`.

- `src/lib/missions.js`
  - `isMechAvailableForMission(force, mech)` – enforces mission-availability rules for mechs (status, pilot assigned, pilot not KIA).
  - `isElementalAvailableForMission(elemental)` – enforces mission-availability rules for elemental points.
  - `calculateMissionTotalBV(force, mechIds, elementalIds)` – sums BV of assigned units.
  - `getAssignedMechs(force, mechIds)` / `getAssignedElementals(force, elementalIds)` – resolve ids to unit objects while preserving order.
  - `getMissionObjectiveReward(mission)` – sums rewards for achieved objectives.
  - `applyMissionCreation(force, formData, timestamp)` – adds a mission, logs assignments to mechs/elementals/pilots (via `pilotId`), and subtracts mission cost from Warchest.
  - `applyMissionUpdate(missions, missionId, formData, timestamp)` – pure mission array updater.
  - `applyMissionCompletion(force, missionId, completionData, timestamp)` – marks mission completed, updates objectives/recap, and adds objective rewards to Warchest.

- `src/lib/downtime.js`
  - `buildDowntimeContext(force, unit)` – generates context for downtime formulas (weight, suits, WP multiplier).
  - `evaluateDowntimeCost(formula, context)` – evaluates the formula using a tiny arithmetic expression parser (numbers, +, -, *, /, parentheses) with variables `weight`, `suitsDamaged`, `suitsDestroyed`, `wpMultiplier`.
  - `applyMechDowntimeAction(force, { mechId, action, cost, timestamp, lastMissionName })` – logs action to mech, and for the mech internal-structure repair downtime action sets status to `Repairing` (otherwise may set it to `Unavailable`), and subtracts cost from Warchest.
  - `applyElementalDowntimeAction(force, { elementalId, actionId, action, cost, timestamp, lastMissionName })` – logs action to elemental, applies action-specific changes (e.g. reset suits), and subtracts cost.
  - `applyPilotDowntimeAction(force, { pilotId, actionId, action, cost, timestamp, inGameDate, lastMissionName })` – logs action to pilot, applies training/healing rules based on `DOWNTIME_ACTION_IDS`, and subtracts cost.

- `src/lib/mechs.js`
  - `findPilotForMech(force, mech)` – resolves the assigned pilot **by `pilotId`**.
  - `findMechForPilot(force, pilot)` – inverse lookup by `pilotId`, used in the Pilot roster and PDF export.
  - `getAvailablePilotsForMech(force, editingMech)` – returns pilots not currently assigned to any other mech (except the one being edited).
  - `getBVMultiplier(gunnery, piloting)` – returns the BV skill multiplier for a G/P combination from the standard BattleTech table (9×9 grid, G0-8 × P0-8).
  - `getAdjustedBV(baseBV, gunnery, piloting)` – calculates adjusted BV by applying the skill multiplier, rounded to the nearest integer.
  - `getMechAdjustedBV(force, mech)` – convenience function that looks up the assigned pilot and returns the mech's adjusted BV (or base BV if no pilot).

### 4.3 Feature components

- `components/MechRoster.jsx`
  - Table of mechs with status, pilot, BV, weight, and last activity.
  - Pilot column shows:
    - `Missing Pilot` when unassigned.
    - `Name - KIA` when injuries = 6.
    - `Name - G:x / P:y` otherwise.
  - Add/edit dialog:
    - Pilot is chosen from a dropdown listing only available pilots (preventing duplicates).

- `components/PilotRoster.jsx`
  - Tracks pilot gunnery, piloting, injuries (0–6 with 6 = KIA).
  - New "Mech" column shows which mech, if any, the pilot is assigned to.
  - Injury buttons update the pilot directly.

- `components/ElementalRoster.jsx`
  - Elemental points with suits destroyed/damaged, status, commander, etc.

- `components/MissionManager.jsx`
  - Mission log list.
  - Mission dialog for:
    - Name, cost, gained WP, description, objectives, recap.
    - Mech and elemental assignment:
      - **Mech availability:**
        - Shown only if `status !== 'Destroyed'`.
        - Checkbox enabled only when:
          - Status is `Operational` or `Damaged`, **and**
          - Mech has a pilot, **and**
          - Pilot injuries `< 6` (not KIA).
      - **Elemental availability:**
        - Hidden if `suitsDestroyed >= 6`.
        - Checkbox enabled only when:
          - Status is `Operational` or `Damaged`, **and**
          - `suitsDestroyed <= 4`.
      - Selector lists mechs and elementals side-by-side using a 2-column grid.
  - Uses `lib/missions` helpers for creation, update, and completion side effects.

- `components/DowntimeOperations.jsx`
  - Warchest multiplier configuration.
  - Mech/elemental/other downtime actions loaded from `data/downtime-actions.json`.
  - Uses `lib/downtime` helpers for cost evaluation and applying actions.

- `components/DataEditor.jsx`
  - JSON editor for the selected force.
  - Changes are in-memory; you export and then move JSON under `data/forces/` to persist.

- `components/PDFExport.jsx`
  - Generates a multi-page PDF/print view of the current force.

- `components/ui/*`
  - Buttons, inputs, selects, dialog, tabs, badges, etc., using Tailwind.

---

## 5. Data Contracts

### 5.1 Forces

A typical force JSON under `data/forces/*.json` contains:

- `id`, `name`, `description`, optional `image`.
- `startingWarchest`, `currentWarchest`, optional `wpMultiplier` for downtime.
- Arrays:
  - `mechs[]`
  - `pilots[]`
  - `elementals[]`
  - `missions[]`

Each mech, pilot, elemental and mission can carry its own `activityLog` array; these logs, plus mission costs and objective rewards, are what drive the financial ledger and PDF export.

`useForceManager` and feature components expect these properties but are resilient to missing optional fields (e.g. `activityLog`).

### 5.2 Downtime actions

`data/downtime-actions.json` typically looks like:

```json
{
  "mechActions": [
    {
      "id": "repair-mech",
      "name": "Repair Mech",
      "formula": "weight * wpMultiplier",
      "makesUnavailable": true,
      "description": "Full repair based on mech weight."
    }
  ],
  "elementalActions": [
    {
      "id": "repair-elemental",
      "name": "Repair Elemental",
      "formula": "(suitsDamaged + suitsDestroyed) * wpMultiplier",
      "description": "Re-arm and repair elementals."
    }
  ]
}
```

`evaluateDowntimeCost` evaluates formulas using a small arithmetic parser (no `eval`) over a limited context of variables: `weight`, `suitsDamaged`, `suitsDestroyed`, `wpMultiplier`. The file is assumed to be trusted (checked into the repo).

---

## 6. Conventions & Notes

- **IDs:** new mechs/pilots/missions use timestamp-based IDs like `mech-<timestamp>`; they only need to be unique within the force.
- **Status badges & colors:** All human-readable statuses (`Operational`, `Damaged`, `Disabled`, `Destroyed`, `Repairing`, `Unavailable`) are centralised in `lib/constants.js` as `UNIT_STATUS`. Components and PDF export convert statuses to visual variants via `getStatusBadgeVariant`.
- **Pilot–mech relationship:**
  - Mechs store `pilotId` as a reference to the pilot `id`.
  - Helper functions in `lib/mechs` resolve pilot ↔ mech associations purely by ID.
  - Mech pilot dropdown enforces one pilot per mech.
- **KIA handling:**
  - Pilot with `injuries === 6` is treated as KIA.
  - Mech roster and mission editor both label such pilots as `Name - KIA`.

---

## 7. Tech Stack Summary

- **Runtime:** Static HTML + JS + CSS.
- **Framework:** React 18 (bundled).
- **Styling:** Tailwind CSS (compiled to `static/css/main.css`).
- **Icons:** `lucide-react`.
- **PDFs:** `@react-pdf/renderer`.
- **State & data:** local React state + JSON files in `data/`.


---

## 9. Testing

The core game logic is covered by unit tests so that you can safely refactor or extend behaviour.

### 9.1 Where tests live

Tests are colocated with the domain libraries in the React source:

- `frontend/src/lib/downtime.test.js` – downtime expression parser and context builder.
- `frontend/src/lib/missions.test.js` – mission availability, BV calculation, mission lifecycle and Warchest updates.
- `frontend/src/lib/mechs.test.js` – mech–pilot relationship helpers (`findPilotForMech`, `findMechForPilot`, `getAvailablePilotsForMech`).
- `frontend/src/lib/ledger.test.js` – financial ledger construction (`buildLedgerEntries`) and aggregates (`summariseLedger`).

You can add new tests next to additional helpers (e.g. `foo.js` → `foo.test.js`) and CRA/Jest will pick them up automatically.

### 9.2 Running the tests

From the `frontend/` folder:

```bash
yarn install        # first time only
yarn test           # interactive watch mode
yarn test --watch=false  # single run, useful for CI
```

Jest will search for `*.test.js` files under `src/`.

### 9.3 Extending tests when changing behaviour

Whenever you change domain logic in `frontend/src/lib/` (missions, downtime, mechs, ledger, etc.):

1. Update or add corresponding tests in the matching `*.test.js` file.
2. Run `yarn test --watch=false` and ensure everything passes.
3. Only then rebuild the production bundle and copy `static/js/main.js` / `static/css/main.css`.

This keeps the static app on GitHub Pages in sync with the tested behaviour and reduces regressions when tweaking Warchest rules, mission handling, or downtime formulas.

---

## 8. Development Workflow (Recommended)

1. Edit React code under `frontend/src`.
2. Run `yarn start` while iterating on UI/logic.
3. When ready:
   - `yarn build` inside `frontend/`.
   - Copy `build/static/js/main*.js` to `static/js/main.js`.
   - Copy `build/static/css/main*.css` to `static/css/main.css`.
4. Optionally serve `/app` with `python3 -m http.server` and sanity-check.
5. Commit `frontend/src/**`, `static/js/main.js`, and `static/css/main.css` plus any `data/` changes.

This keeps GitHub Pages deployment simple while letting you evolve the app with a normal React workflow.
