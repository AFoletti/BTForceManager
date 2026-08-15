# BattleTech Forces Manager

BattleTech Forces Manager is a web app for running Classic BattleTech campaigns with the Warchest system. It lets you manage forces made of mechs, elementals and pilots, track missions and downtime operations, and keep your Warchest and roster state in one place.

The app is a React frontend backed by a FastAPI + SQLite backend. All campaign data (forces, mechs, pilots, achievements, SP choices, downtime actions, the mech catalog) lives in a single database file, `data/btforce.db` - there are no JSON/CSV files to edit for day-to-day use.

---

## Key Features

- **Force Management**: Track mechs, pilots, and elementals, each with an optional portrait/image and full status tracking.
- **Mission Manager**: Create missions, assign units, track objectives, SP purchases and rewards.
- **Pilot Kill Board & Achievements**: Track pilot combat records with kills, assists, and unlockable achievements.
- **Support Points (SP)**: Configure SP purchases for missions from a customizable catalog.
- **Downtime Operations**: Apply repairs, training, and healing with formula-based costs.
- **Financial Ledger**: A running, auto-built log of every Warchest-affecting event (mission costs/rewards, downtime spend, SP purchases) for a force.
- **Snapshots**: Automatic point-in-time backups of a force's full state at key campaign moments (missions, downtime cycles), with rollback.
- **PDF Export**: Generate comprehensive force reports.
- **Admin panel**: Manage all global/app-wide configuration and force-level setup from one place in the app.

---

## Battle Value (BV)

The app uses **adjusted BV** throughout, calculated from the mech's base BV and the assigned pilot's skills:

- **Base BV** is the value for a standard 4/5 (Gunnery/Piloting) pilot.
- **Adjusted BV** applies a multiplier based on the pilot's actual skills (better pilots increase BV, worse pilots decrease it).
- Mechs without an assigned pilot display their base BV.

Adjusted BV is shown in the Mech Roster, Mission Manager, and PDF Export. The standard BattleTech skill multiplier table is used (ranging from 2.42× for 0/0 elite pilots down to 0.68× for 8/8 green pilots).

---

## Adding Mechs

When adding a new mech, you can search the **mech catalog** by typing at least 2 characters. The catalog contains mech data (name, tonnage, BV, movement, heat, components) sourced from [MekBay](https://next.mekbay.com) and stored in the backend's `mech_catalog` table. Selecting a mech from the dropdown auto-fills the name, weight, and base BV fields.

You can also type a custom mech name if it's not in the catalog. Mechs, elementals, and forces can each have an image/portrait uploaded (PNG, JPEG, WEBP or GIF, up to 5MB), stored directly in the database.

> **Copyright Notice:** This app contains MegaMek data (copyright 2025 The MegaMek Team), licensed under CC BY-NC-SA 4.0.

---

## Pilot Kill Board & Achievements

### Combat Records

Each pilot tracks their combat performance:

- **Kills**: Detailed list of destroyed enemy mechs (model, tonnage, mission, date).
- **Assists**: Count of assisted kills.
- **Missions Completed**: Total missions participated in.
- **Tonnage Destroyed**: Cumulative tonnage of all kills.

During mission completion, you can log kills for each deployed pilot using the mech catalog dropdown (same autocomplete as adding mechs).

### Achievements

Pilots automatically earn achievements based on their combat records. Achievements are displayed as badges in the Pilot Roster and detailed in the pilot edit dialog. New achievements trigger a popup after mission completion.

Achievement definitions are a global, app-wide catalog, managed from **Admin > Achievements**, and served via `GET /api/achievement-definitions`.

---

## Support Points (SP)

Missions can include a Support Point budget for purchasing tactical support:

1. Set an SP Budget when creating a mission.
2. Select items from the dropdown (items exceeding remaining budget are disabled).
3. SP purchases are stored with the mission and appear in PDF exports.

SP choices are a global, app-wide catalog, managed from **Admin > SP Purchases**, and served via `GET /api/sp-choices`. See TECHNICAL_README.md for the data model.

---

## Special Abilities

Forces can have special abilities displayed in the force banner, managed via the `special_abilities` pool and linked per-force through the app itself (no manual file editing required).

---

## Managing Forces, Roster & Downtime

### Adding or editing forces

Forces are created, edited, and deleted from **Admin > Forces**, backed by the `POST/PUT/DELETE /api/forces` endpoints. There's no manifest file to hand-edit. This is also where you configure each force's Warchest setup: starting/current Warchest, campaign start date, and the WP-to-Support-Point conversion rate used by the Downtime tab.

From inside the app you can also:

- Use the **Admin** panel to manage global configuration (SP purchases, downtime actions, achievement definitions, mech catalog CSV import) as well as force creation/edit/delete.
- Use the **Mechs / Elementals / Pilots** tabs to add, edit, and delete any unit in the roster directly, including uploading an image per unit.
- Use **Export** to download the force as `<force-id>.json` for backup/sharing purposes (this is just an export format, not something the app reads back in as a data source).
- Use the **Snapshots** tab to see the automatic history of full-state backups for the force and roll back to an earlier one.
- Use the **Ledger** tab to see a running log of every Warchest-affecting transaction for the force.

### Downtime actions

Downtime operations (repairs, purchases, training, etc.) are a global, app-wide catalog, managed from **Admin > Downtime**, and served via `GET /api/downtime-actions` at runtime by the **Downtime** tab.

- `mechActions` control actions available for mechs (often using mech weight and a WP multiplier).
- `elementalActions` control actions for elemental points (often using suits destroyed/damaged and the same multiplier).
- `pilotActions` control training/healing actions for pilots.

Each action has:

- An `id` and `name` (shown in the UI).
- A `formula` string, evaluated in a limited context using only a few variables:
  - `weight` – mech weight in tons.
  - `suitsDamaged` / `suitsDestroyed` – for elemental points.
  - `wpMultiplier` – the Warchest-to-SP conversion rate configured for the force in Admin.
- Optional flags (e.g. `makesUnavailable`) that change unit state after the action.

> Formulas are **not** executed with `eval`. They go through a small, safe arithmetic parser that only understands numbers, `+`, `-`, `*`, `/` and parentheses. Anything outside of that will be ignored and treated as `0`.

For deeper technical details (code structure, build & deploy, data contracts, etc.), see **TECHNICAL_README.md** in this repository.

---

## Snapshots

Every mission (on creation and completion) and every downtime cycle automatically creates a full-state snapshot of the force. Consecutive downtime-cycle snapshots merge into one (a mission always breaks the merge chain), and only the 3 most recent snapshots are kept. Open the **Snapshots** tab to see the history and use **Rollback** on any snapshot except the most recent one to restore the force to that point in time.

---

## Updating the Mech Catalog

The mech catalog provides autocomplete data for adding mechs and logging kills. It is sourced from [MekBay](https://next.mekbay.com) and contains all necessary mech information: chassis, model, BV, tonnage, year, techbase, role, and MUL ID. The initial catalog already ships inside `data/btforce.db` - no setup needed.

To add or refresh mechs later, without touching the repo:

1. Visit [MekBay](https://next.mekbay.com/?filters=type:Mek%7Csubtype:BattleMek,BattleMek%2520Omni%7CweightClass:Medium,Heavy,Assault,Light&expanded=true) and export as CSV.
2. Upload the CSV directly from **Admin > Mech Catalog** (primary path - no filesystem access needed), or drop it into the watched folder (`MECH_CATALOG_WATCH_HOST_DIR` in Docker deployments - see DEPLOYMENT.md), which the backend picks up automatically within a few seconds. Both paths upsert rows by MUL ID and are shown in the Admin panel's watcher status.
3. Alternatively, run the bundled operational tool directly: `python backend/import_mech_catalog.py /path/to/mechs.csv`.
