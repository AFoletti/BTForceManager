# BattleTech Forces Manager

A static web application for managing BattleTech Classic forces, mechs, pilots, missions, and repairs.

## Features

- **Multiple Forces Management**: Switch between different mercenary units
- **Mech Roster**: Track mechs with status, pilot assignment, BV, and weight
- **Pilot Roster**: Manage pilots with gunnery, piloting, and injury tracking
- **Mission System**: Create missions with warchest costs and rewards
- **Repair Bay**: Perform repairs using customizable formulas
- **Activity Logging**: Track all actions per mech and pilot
- **JSON Data Editor**: Edit all data directly via JSON
- **Export/Import**: Save and load force data

## GitHub Pages Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy the `build` folder to GitHub Pages

3. Your app will be available at: `https://<username>.github.io/<repository>/`

## Data Structure

All data is stored in browser localStorage and can be exported/imported as JSON.

### Force Structure
```json
{
  "id": "force-1",
  "name": "Gray Death Legion",
  "description": "Elite mercenary unit",
  "image": "url-to-image",
  "startingWarchest": 1000,
  "currentWarchest": 850,
  "mechs": [...],
  "pilots": [...],
  "missions": [...],
  "repairActions": [...]
}
```

### Mech Structure
```json
{
  "id": "mech-1",
  "name": "Atlas AS7-D",
  "status": "Operational",
  "pilot": "Grayson Carlyle",
  "bv": 1897,
  "weight": 100,
  "image": "url-to-image",
  "activityLog": []
}
```

### Pilot Structure
```json
{
  "id": "pilot-1",
  "name": "Grayson Carlyle",
  "gunnery": 3,
  "piloting": 4,
  "injuries": 0,
  "activityLog": []
}
```

### Repair Action Structure
```json
{
  "id": "repair-1",
  "name": "Repair Armor",
  "formula": "(weight/5)",
  "makesUnavailable": false
}
```

## Repair Formulas

Formulas use JavaScript expressions with the `weight` variable:
- Simple: `weight/5` or `weight*2`
- Complex: `(weight*20)/5` or `weight/3 + 10`

## License

MIT
