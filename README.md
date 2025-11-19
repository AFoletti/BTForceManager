# BattleTech Forces Manager

BattleTech Forces Manager is a static, single-page web app for running Classic BattleTech campaigns with the Warchest system. It lets you manage forces made of mechs, elementals and pilots, track missions and downtime operations, and keep your Warchest and roster state in one place.

The app runs entirely in the browser, backed only by JSON files in the `data/` folder. You can switch between multiple forces, assign pilots to mechs, mark injuries and damage, log missions with costs and rewards, and apply configurable downtime actions that adjust Warchest and unit state over time.

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

Each action has:

- An `id` and `name` (shown in the UI).
- A `formula` string, evaluated in a limited context (e.g. `weight * wpMultiplier`).
- Optional flags (e.g. `makesUnavailable`) that change unit state after the action.

To change downtime behaviour:

1. Edit `data/downtime-actions.json` with new or adjusted actions.
2. Commit and push. The next page load will use the updated rules.

For deeper technical details (code structure, build & deploy, data contracts, etc.), see **TECHNICAL_README.md** in this repository.
