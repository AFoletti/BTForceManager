# BattleTech Forces Manager

BattleTech Forces Manager is a static, single-page web app for running Classic BattleTech campaigns with the Warchest system. It lets you manage forces made of mechs, elementals and pilots, track missions and downtime operations, and keep your Warchest and roster state in one place.

The app runs entirely in the browser, backed only by JSON files in the `data/` folder. You can switch between multiple forces, assign pilots to mechs, mark injuries and damage, log missions with costs and rewards, and apply configurable downtime actions that adjust Warchest and unit state over time.

---

## Battle Value (BV)

The app uses **adjusted BV** throughout, calculated from the mech's base BV and the assigned pilot's skills:

- **Base BV** is the value for a standard 4/5 (Gunnery/Piloting) pilot.
- **Adjusted BV** applies a multiplier based on the pilot's actual skills (better pilots increase BV, worse pilots decrease it).
- Mechs without an assigned pilot display their base BV.

Adjusted BV is shown in the Mech Roster, Mission Manager, and PDF Export. The standard BattleTech skill multiplier table is used (ranging from 2.42× for 0/0 elite pilots down to 0.68× for 8/8 green pilots).

---

## Adding Mechs

When adding a new mech, you can search the **mech catalog** by typing at least 2 characters. The catalog contains mech data (name, tonnage, BV) sourced from [MekBay](https://next.mekbay.com) and stored in `data/mek_catalog.csv`. Selecting a mech from the dropdown auto-fills the name, weight, and base BV fields.

You can also type a custom mech name if it's not in the catalog.

> **Copyright Notice:** This app contains MegaMek data (copyright 2025 The MegaMek Team), licensed under CC BY-NC-SA 4.0.

---

## Managing Forces & Downtime

### Adding or editing forces

Forces are defined as JSON files under `data/forces/` and listed in `data/forces/manifest.json`.

1. **Create or edit a force JSON** in `data/forces/` (e.g. `my-force.json`).
2. **Add it to the manifest** by appending its filename to `data/forces/manifest.json`:
   ```json
   {
     "forces": [
       "19th-great-white.json",
       "my-force.json"
     ]
   }
   ```
3. Commit and push. The force will appear in the app's force selector.

From inside the app you can also:

- Use the **Data Editor** tab to tweak the currently loaded force as JSON.
- Use **Export** to download the force as `<force-id>.json` and then copy that file into `data/forces/` under version control.

### Configuring downtime actions

Downtime operations (repairs, purchases, training, etc.) are defined in `data/downtime-actions.json` and are loaded at runtime by the **Downtime** tab.

- `mechActions` control actions available for mechs (often using mech weight and a WP multiplier).
- `elementalActions` control actions for elemental points (often using suits destroyed/damaged and the same multiplier).
- `pilotActions` control training/healing actions for pilots.

Each action has:

- An `id` and `name` (shown in the UI).
- A `formula` string, evaluated in a limited context using only a few variables:
  - `weight` – mech weight in tons.
  - `suitsDamaged` / `suitsDestroyed` – for elemental points.
  - `wpMultiplier` – the Warchest multiplier configured in the Downtime tab.
- Optional flags (e.g. `makesUnavailable`) that change unit state after the action.

> Formulas are **not** executed with `eval`. They go through a small, safe arithmetic parser that only understands numbers, `+`, `-`, `*`, `/` and parentheses. Anything outside of that will be ignored and treated as `0`.

To change downtime behaviour or add a new action:

1. Edit `data/downtime-actions.json` with new or adjusted actions.
2. Make sure each action has a unique `id`. Some IDs are treated specially by the app (e.g. `repair-elemental`, `purchase-elemental`, `train-gunnery`, `train-piloting`, `heal-injury`) to reset damage or change pilot skills.
3. Commit and push. The next page load will use the updated rules.

For deeper technical details (code structure, build & deploy, data contracts, etc.), see **TECHNICAL_README.md** in this repository.

---

## Updating the Mech Catalog

The mech catalog (`data/mek_catalog.csv`) provides autocomplete data for adding mechs. It is sourced from [MekBay](https://next.mekbay.com) and contains all necessary mech information: chassis, model, BV, tonnage, year, techbase, role, and MUL ID.

To refresh the mech list:

1. Visit [MekBay](https://next.mekbay.com/?filters=type:Mek%7Csubtype:BattleMek,BattleMek%2520Omni%7CweightClass:Medium,Heavy,Assault,Light&expanded=true).
2. Export as CSV and save to `data/mek_catalog.csv`.
3. Commit and push. The app reads the CSV directly at runtime.
