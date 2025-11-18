# BattleTech Forces Manager

A static, single-page web app for managing Classic BattleTech forces (mechs, pilots, elementals, missions, repairs) using the Warchest system.

This repository is intentionally lean: the root contains the deployable app, plus a `frontend/` folder with the original React source if you ever want to rebuild.

---

## 1. Architecture Overview

### Runtime (what GitHub Pages serves)

These are the only pieces you need for the live app:

- `index.html` – main entry point
- `static/js/main.js` – bundled React app
- `static/css/main.css` – bundled Tailwind-based styles
- `data/` – JSON data for forces & downtime rules
  - `data/forces/manifest.json` – list of force JSON files
  - `data/forces/*.json` – individual force definitions
  - `data/downtime-actions.json` – definitions for downtime/repair actions
- `.nojekyll` – tells GitHub Pages to serve `/static` as-is

The app is entirely client-side:

- No backend, no database, no build step required for usage
- Data is loaded from the JSON files in `/data` at runtime
- Everything runs in the browser using the already-built bundle

### Source (for future changes)

The original React source code is preserved under:

- `frontend/`
  - `src/` – React components, hooks, and styles
  - `public/` – static assets used at build time
  - `package.json` – dependencies & scripts (`react-scripts`, Tailwind, etc.)

You only need `frontend/` if you intend to modify the app and rebuild `static/js/main.js` and `static/css/main.css`.

---

## 2. Features (Current App)

### 2.1 Forces & Data

- Multiple forces loaded from JSON (`data/forces/*.json`)
- Force selector in the header
- Each force includes:
  - Name, description, optional image
  - Starting and current Warchest (WP)
  - Mechs, Elementals, Pilots
  - Missions and downtime/repair actions

### 2.2 Mech Management

- Roster view with:
  - Name, status, pilot, BV, weight, counts
- Status tracking (Operational, Damaged, Disabled, Destroyed, etc.)
- History notes and activity log per mech

### 2.3 Pilot Management

- Pilot roster:
  - Name, gunnery, piloting
  - Injury tracking (0–6, with KIA at 6)
- History & activity log per pilot

### 2.4 Elemental Management

- Roster of Elemental points:
  - Commander, gunnery, antimech skill
  - Suits destroyed/damaged
  - BV, status, history

### 2.5 Missions

- Create and manage missions per force:
  - Name, description, objectives
  - Warchest cost & reward (WP)
  - Assigned mechs/elementals
  - After Action Report / recap
- Mission log for campaign tracking

### 2.6 Downtime Operations

- Force-level panel for non-combat actions:
  - Customizable actions defined in `data/downtime-actions.json`
  - Formula-based WP cost (e.g. using mech weight or suits)
  - Separate actions for mechs, elementals, or force-level
- WP calculations with rounding & validation

### 2.7 Data Editor & Export

- JSON editor tab for the currently selected force:
  - Edit the entire force JSON directly
  - Live validation: invalid JSON is ignored until fixed
- Export functions:
  - Export current force as `<force-id>.json` for backup or Git commits

### 2.8 PDF Export

- “PDF” button in the header exports the full force as a multipage report:
  - Force header with stats
  - Pilot roster
  - Elemental roster
  - Mech details
  - Mission log
- Layout optimized for printing on white paper

---

## 3. Repository Layout

At the root:

```text
/app
├── .nojekyll                 # Enable static asset serving on GitHub Pages
├── README.md                 # This file
├── index.html                # SPA entry point, loads static/js/main.js
├── package.json              # Tiny helper for local static serving (optional)
├── data/
│   ├── downtime-actions.json # Downtime/repair action definitions
│   └── forces/
│       ├── manifest.json     # List of force JSON files
│       └── *.json            # Individual forces
├── static/
│   ├── css/
│   │   └── main.css          # Compiled Tailwind-based CSS
│   └── js/
│       └── main.js           # Compiled React bundle
└── frontend/                 # Original React+Tailwind source (optional)
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

Everything outside of `index.html`, `static/`, `data/`, `.nojekyll`, `package.json`, and `frontend/` has been removed to keep the repo focused.

---

## 4. Using the App (No Build Required)

### 4.1 Open locally

You can open the app directly from the file system:

- Double-click `index.html`
- Or drag `index.html` into your browser

Because data is loaded with relative paths (`./data/...`), this works well for most browsers. If your browser blocks `file://` fetches, serve it via a simple local HTTP server.

#### Option: simple local server

If you have Python 3 installed:

```bash
cd /app
python3 -m http.server 8080
```

Then open:

- http://localhost:8080/

### 4.2 Deploy on GitHub Pages

1. Push this folder to a GitHub repo (e.g. as `main` branch).
2. In **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
3. Save and wait for Pages to build.

Your app will then be served from:

```text
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

No additional build step is necessary for deployment because the bundle is already present in `static/`.

---

## 5. Editing Data

### 5.1 Forces

- `data/forces/manifest.json` controls which force files are loaded:

```json
{
  "forces": [
    "19th-great-white.json"
  ]
}
```

- Each entry refers to a file under `data/forces/`.
- To add a new persistent force:
  1. Create a new JSON file in `data/forces/` (e.g. `my-force.json`).
  2. Add its filename to `manifest.json`.
  3. Commit and push.

### 5.2 Downtime Actions

- `data/downtime-actions.json` defines actions for the Downtime tab.
- Actions can use formulas based on mech weight / suits, etc.

When experimenting, it’s safest to:

- Use the in-app JSON editor for temporary changes.
- Once happy, export the force and copy that JSON back into `data/forces/*.json` under version control.

---

## 6. Working on the Source (Optional)

You only need this if you want to change React components or styling.

### 6.1 Install & run dev server

```bash
cd frontend
yarn install
yarn start
```

This starts the development server at `http://localhost:3000`.

### 6.2 Build new production bundle

```bash
cd frontend
yarn build

# Copy the build output into the root for deployment
cp -r build/static ../static
cp build/index.html ../index.html
```

After this, `index.html` and `static/` at the root will contain the new bundle.

> Note: The root `package.json` is only used for optional local static serving and is not part of the React build chain.

---

## 7. Developer Notes (Frontend Source)

This section is for anyone touching the `frontend/` React app.

### 7.1 Component & module naming

The source is organized by feature rather than by layer:

- `src/App.js` – top-level layout: header, force banner, tabs.
- `src/hooks/useForceManager.js` – loads forces from `data/forces/manifest.json` and individual JSON files, manages selected force and updates.
- `src/lib/utils.js` – generic utilities:
  - `cn()` – Tailwind/clsx class merging
  - `formatNumber()` – apostrophe-separated thousands
  - `evaluateFormula()` – simple `weight`-based formula evaluation (used in older Repair Bay)
  - `formatDate()` – pretty timestamps
  - `downloadJSON()` – generic JSON download helper
- `src/components/` – feature components:
  - `MechRoster.jsx`, `PilotRoster.jsx`, `ElementalRoster.jsx`
  - `MissionManager.jsx`
  - `DowntimeOperations.jsx` (current downtime implementation)
  - `DataEditor.jsx`, `AddForceDialog.jsx`
  - `PDFExport.jsx`
- `src/components/ui/` – small presentational primitives (button, select, input, dialog, tabs, etc.).

**Note on `RepairBay.jsx`:**

- `RepairBay.jsx` is an older, mech-only repair panel that predates the current `DowntimeOperations` component.
- It is **not used** by `App.js` anymore but is left in place as a reference implementation for formula-based repair actions.
- If you don’t plan to use it as a reference, it can safely be deleted.

### 7.2 Data contract (frontend ↔ static JSON)

The runtime bundle expects the same JSON structure used in `data/`:

- Forces are loaded from `./data/forces/manifest.json` and `./data/forces/*.json`.
- Downtime actions are loaded from `./data/downtime-actions.json`.

When editing the source, keep those relative paths and shapes consistent with the `data/` folder in the root. The root `data/` folder and the `frontend` dev server should both serve the same files when you test.

### 7.3 Rebuilding after code changes

After you change anything in `frontend/src`, rebuild and copy outputs as described in section **6.2** so the root `index.html` and `static/` stay in sync with your code.

> Tip: It is often easiest to rebuild, test locally with `python3 -m http.server`, and then commit.

---

## 8. Tech Stack

- **Runtime:** plain HTML + JS bundle + CSS bundle
- **UI framework:** React 18 (bundled in `static/js/main.js`)
- **Styling:** Tailwind CSS (compiled to `static/css/main.css`)
- **Icons:** Lucide icons (bundled)
- **PDF generation:** `@react-pdf/renderer` (bundled)
- **Data:** simple JSON files under `/data`

---

## 9. License

MIT – use and modify freely for your own BattleTech campaigns.
