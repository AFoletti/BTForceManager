# BattleTech Forces Manager

BattleTech Forces Manager is a static, single-page web app for running Classic BattleTech campaigns with the Warchest system. It lets you manage forces made of mechs, elementals and pilots, track missions and downtime operations, and keep your Warchest and roster state in one place.

The app runs entirely in the browser, backed only by JSON files in the `data/` folder. You can switch between multiple forces, assign pilots to mechs, mark injuries and damage, log missions with costs and rewards, and apply configurable downtime actions that adjust Warchest and unit state over time.

---

## Key Features

- **Force Management**: Track mechs, pilots, and elementals with full status tracking
- **Mission Manager**: Create missions, assign units, track objectives and rewards
- **Pilot Kill Board & Achievements**: Track pilot combat records with kills, assists, and unlockable achievements
- **Support Points (SP)**: Configure SP purchases for missions from a customizable catalog
- **Downtime Operations**: Apply repairs, training, and healing with formula-based costs
- **Snapshots**: Save and restore force states at key campaign moments
- **PDF Export**: Generate comprehensive force reports

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

## Pilot Kill Board & Achievements

### Combat Records

Each pilot tracks their combat performance:

- **Kills**: Detailed list of destroyed enemy mechs (model, tonnage, mission, date)
- **Assists**: Count of assisted kills
- **Missions Completed**: Total missions participated in
- **Tonnage Destroyed**: Cumulative tonnage of all kills

During mission completion, you can log kills for each deployed pilot using the mech catalog dropdown (same autocomplete as adding mechs).

### Achievements

Pilots automatically earn achievements based on their combat records:

| Achievement | Requirement |
|-------------|-------------|
| First Blood | 1 kill |
| Ace | 5 kills |
| Double Ace | 10 kills |
| Legend | 20 kills |
| Light Hunter | 5 light mech kills (20-35t) |
| Medium Hunter | 5 medium mech kills (40-55t) |
| Heavy Hunter | 5 heavy mech kills (60-75t) |
| Assault Hunter | 5 assault mech kills (80-100t) |
| Tonnage Master | 1000 tons destroyed |
| Giant Slayer | Destroyed a 100-ton mech |
| Team Player | 5 assists |
| Survivor | 3 consecutive missions without injury |
| Veteran | 5 missions completed |
| Battle Hardened | 10 missions completed |
| Iron Will | Recovered from 5 injuries |

Achievements are displayed as emoji badges in the Pilot Roster and detailed in the pilot edit dialog. New achievements trigger a popup after mission completion.

See `data/achievements.json` to customize achievements.

---

## Support Points (SP)

Missions can include a Support Point budget for purchasing tactical support:

1. Set an SP Budget when creating a mission
2. Select items from the dropdown (items exceeding remaining budget are disabled)
3. SP purchases are stored with the mission and appear in PDF exports

SP choices are defined in `data/sp-choices.json`. See TECHNICAL_README.md for customization.

---

## Special Abilities

Forces can have special abilities displayed in the force banner. Add a `specialAbilities` array to your force JSON:

```json
{
  "specialAbilities": [
    { "title": "Zellbrigen", "description": "Clan Honor Dueling Protocols" },
    { "title": "Blood Fury", "description": "+1 Initiative when outnumbered" }
  ]
}
```

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

The mech catalog (`data/mek_catalog.csv`) provides autocomplete data for adding mechs and logging kills. It is sourced from [MekBay](https://next.mekbay.com) and contains all necessary mech information: chassis, model, BV, tonnage, year, techbase, role, and MUL ID.

To refresh the mech list:

1. Visit [MekBay](https://next.mekbay.com/?filters=type:Mek%7Csubtype:BattleMek,BattleMek%2520Omni%7CweightClass:Medium,Heavy,Assault,Light&expanded=true).
2. Export as CSV and save to `data/mek_catalog.csv`.
3. Commit and push. The app reads the CSV directly at runtime.
