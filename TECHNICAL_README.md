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
  - `data/sp-choices.json` – Support Point purchase options for missions.
  - `data/achievements.json` – pilot achievement definitions.
  - `data/mek_catalog.csv` – mech database for autocomplete (from MekBay).
- `.nojekyll` – ensures GitHub Pages serves `/static` as-is.

There is **no backend** and no database. All state is in memory and/or JSON.

### 1.2 Source (React app)

The React source is under `frontend/`:

- `frontend/src/` – components, hooks, and utilities.
- `frontend/public/` – assets used at build time (mirrors `data/` for dev server).
- `frontend/package.json` – dependencies & scripts (CRA, Tailwind, etc.).

You only need this folder if you want to change the app behaviour or styling and rebuild the static bundles.

---

## 2. Repository Layout

```text
/app
├── .nojekyll                 # Enable static asset serving on GitHub Pages
├── README.md                 # User-facing overview
├── TECHNICAL_README.md       # This file – developer documentation
├── index.html                # SPA entry point, loads static/js/main.js
├── package.json              # Optional helper for local static serving
├── data/
│   ├── downtime-actions.json # Downtime/repair definitions
│   ├── sp-choices.json       # Support Point purchase options
│   ├── achievements.json     # Pilot achievement definitions
│   ├── mek_catalog.csv       # Mech database for autocomplete (from MekBay)
│   └── forces/
│       ├── manifest.json     # List of force JSON files
│       └── *.json            # Individual forces
├── static/
│   ├── css/
│   │   └── main.css          # Compiled Tailwind CSS
│   └── js/
│       └── main.js           # Compiled React bundle
└── frontend/                 # Source app (React + Tailwind)
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── public/
    │   └── data/             # Dev server copy of data files
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

**Important:** When adding or modifying data files (like `sp-choices.json` or `achievements.json`), copy them to both:
- `/app/data/` (for production)
- `/app/frontend/public/data/` (for dev server)

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

## 4. Customizing SP Purchases

Support Point (SP) purchases allow players to buy tactical support during mission setup.

### 4.1 File location

`data/sp-choices.json`

### 4.2 Structure

```json
{
  "spChoices": [
    {
      "id": "artillery-strike",
      "name": "Artillery Strike",
      "cost": 50
    },
    {
      "id": "air-support",
      "name": "Air Support",
      "cost": 75
    }
  ]
}
```

### 4.3 Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (used internally) |
| `name` | string | Display name shown in dropdown |
| `cost` | number | SP cost for this purchase |

### 4.4 Adding new SP choices

1. Edit `data/sp-choices.json`
2. Add a new entry with unique `id`, `name`, and `cost`
3. Copy to `frontend/public/data/sp-choices.json` (for dev server)
4. Commit and push – changes take effect on next page load

### 4.5 How it works in the app

- Mission dialog shows SP Budget field
- When budget > 0, a dropdown appears with available choices
- Items with cost > remaining budget are disabled
- Selected items are stored in `mission.spPurchases[]`
- Purchases appear in mission cards and PDF export

---

## 5. Customizing Achievements

Achievements are automatically awarded to pilots based on their combat records.

### 5.1 File location

`data/achievements.json`

### 5.2 Structure

```json
{
  "achievements": [
    {
      "id": "first-blood",
      "name": "First Blood",
      "icon": "🎯",
      "description": "First confirmed kill",
      "condition": "killCount >= 1"
    },
    {
      "id": "ace",
      "name": "Ace",
      "icon": "⭐",
      "description": "5 confirmed kills",
      "condition": "killCount >= 5"
    }
  ]
}
```

### 5.3 Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (stored in pilot data) |
| `name` | string | Display name |
| `icon` | string | Emoji icon (shown in web UI only, not PDF) |
| `description` | string | Achievement description |
| `condition` | string | Condition expression (see below) |

### 5.4 Condition expressions

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

### 5.5 Adding new achievements

1. Edit `data/achievements.json`
2. Add entry with unique `id`, `name`, `icon`, `description`, and `condition`
3. Copy to `frontend/public/data/achievements.json` (for dev server)
4. Commit and push

### 5.6 Weight class boundaries

For weight-class achievements, mechs are classified as:

| Class | Tonnage Range |
|-------|---------------|
| Light | 20-35 tons |
| Medium | 40-55 tons |
| Heavy | 60-75 tons |
| Assault | 80-100 tons |

### 5.7 How achievements work

1. During mission completion, kills/assists are logged per pilot
2. `lib/achievements.js` computes stats from `pilot.combatRecord`
3. Each achievement condition is evaluated against stats
4. New achievements trigger a popup dialog
5. Achievements stored in `pilot.achievements[]` array
6. Displayed as emoji badges in Pilot Roster (hover for details)
7. PDF export shows achievement names (no emoji – PDF limitation)

---

## 6. Frontend Structure & Key Modules

### 6.1 Top level

- `src/App.js`
  - Header with force selector, export actions and PDF button.
  - Force banner showing current Warchest, counts, special abilities, and optional image.
  - Tabbed content for Mechs, Elementals, Pilots, Missions, Downtime, Notes, Data Editor.

- `src/hooks/useForceManager.js`
  - Loads `data/forces/manifest.json` and each listed force JSON.
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

A typical force JSON under `data/forces/*.json` contains:

- `id`, `name`, `description`, optional `image`.
- `startingWarchest`, `currentWarchest`, optional `wpMultiplier`.
- `currentDate` – in-universe campaign date (YYYY-MM-DD format).
- `specialAbilities[]` – optional array of `{ title, description }`.
- Arrays: `mechs[]`, `pilots[]`, `elementals[]`, `missions[]`.
- `snapshots[]`, `fullSnapshots[]` – campaign state history.

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

`data/downtime-actions.json` structure remains unchanged. See README.md for details.

### 7.5 Mech catalog

The mech catalog (`data/mek_catalog.csv`) provides autocomplete for adding mechs and logging kills. Sourced from [MekBay](https://next.mekbay.com).

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

- **Runtime:** Static HTML + JS + CSS.
- **Framework:** React 18 (bundled).
- **Styling:** Tailwind CSS.
- **Icons:** `lucide-react`.
- **PDFs:** `@react-pdf/renderer`.
- **State & data:** Local React state + JSON files.

---

## 10. Testing

Core game logic is covered by unit tests in `frontend/src/lib/*.test.js`.

### Running tests

```bash
cd frontend
yarn install
yarn test              # interactive watch mode
yarn test --watch=false  # single run (CI)
```

### Test files

- `downtime.test.js` – downtime expression parser
- `missions.test.js` – mission lifecycle, BV calculation
- `mechs.test.js` – pilot-mech relationships, BV multipliers
- `ledger.test.js` – financial ledger construction
- `snapshots.test.js` – snapshot creation and restoration

---

## 11. Development Workflow

1. Edit React code under `frontend/src`.
2. Run `yarn start` while iterating on UI/logic.
3. When ready:
   - `yarn build` inside `frontend/`.
   - Copy `build/static/js/main*.js` to `static/js/main.js`.
   - Copy `build/static/css/main*.css` to `static/css/main.css`.
4. Optionally serve `/app` with `python3 -m http.server` and sanity-check.
5. Commit `frontend/src/**`, `static/js/main.js`, `static/css/main.css`, plus any `data/` changes.

This keeps GitHub Pages deployment simple while letting you evolve the app with a normal React workflow.
