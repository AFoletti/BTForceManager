# Pilot-Mech Relationship Migration

## Problem Fixed
Previously, mechs stored pilots by **name** (`pilot` field), which broke the pilot-mech relationship when you renamed a pilot. This has been fixed to use **pilot IDs** instead.

## Changes Made

### 1. Core Library (`/app/frontend/src/lib/mechs.js`)
- **`findPilotForMech()`**: Now looks up pilots by `pilotId` first, with fallback to legacy `pilot` name for backward compatibility
- **`findMechForPilot()`**: Checks both `pilotId` and legacy `pilot` name
- **`getAvailablePilotsForMech()`**: Filters based on both ID and name assignments

### 2. Mech Roster Component (`/app/frontend/src/components/MechRoster.jsx`)
- Changed form data to use `pilotId` instead of `pilot`
- Dropdown now stores pilot **ID** instead of name
- When saving, mechs now have `pilotId` field and remove legacy `pilot` field
- Backward compatibility: When editing existing mechs with `pilot` field, it's converted to `pilotId`

### 3. Data Migration (`/app/data/forces/19th-great-white.json`)
- All 14 mechs updated with `pilotId` field
- Legacy `pilot` field kept temporarily for compatibility
- Fuzzy matching used to handle pilot names with titles (e.g., "Baber" → "Star Captain Baber")

### 4. Mission Manager
- No changes needed! Already uses `findPilotForMech()` which now works with IDs
- Mission availability checks work correctly with the new system

## How It Works Now

### Before (Broken):
```json
{
  "id": "mech-123",
  "name": "Atlas",
  "pilot": "John Smith",  // ← String name
  ...
}
```
If you renamed "John Smith" to "John T. Smith", the mech would lose its pilot.

### After (Fixed):
```json
{
  "id": "mech-123",
  "name": "Atlas",
  "pilotId": "pilot-456",  // ← ID reference
  ...
}
```
Now you can rename the pilot freely and the mech stays linked via ID!

## Backward Compatibility

The system supports both old and new data formats:
- ✅ New mechs: Use `pilotId`
- ✅ Old mechs: Still work with `pilot` name (legacy support)
- ✅ Editing old mechs: Automatically migrates to `pilotId`

## Testing Instructions

1. **Open the app** and select a force
2. **Go to Pilot Roster** tab
3. **Rename a pilot** (e.g., change "Aidan" to "Aidan Pryde")
4. **Go to Mech Roster** tab
5. **Verify** the pilot is still correctly shown for their assigned mech
6. **Go to Mission Manager** tab
7. **Create a mission** and verify the pilot shows correctly in the assignment list

## Future Notes

- The legacy `pilot` field will gradually phase out as users edit mechs
- New mechs created will only use `pilotId`
- All helper functions handle both formats transparently
