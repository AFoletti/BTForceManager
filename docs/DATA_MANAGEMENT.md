# 📊 Data Management Guide

## How Data Works

Your BattleTech Forces Manager uses **static JSON files** stored in the repository. This allows you to version control your campaign data with Git!

## File Structure

```
/
├── data/
│   └── forces.json     ← Your forces data (EDIT THIS!)
├── index.html
├── static/
└── frontend/           ← Source code
    └── public/data/
        └── forces.json ← Development copy
```

## Editing Your Forces

### Method 1: Direct File Editing (Recommended)

1. Open `data/forces.json` in your text editor
2. Edit the JSON directly
3. Commit and push:
   ```bash
   git add data/forces.json
   git commit -m "Update Gray Death Legion roster"
   git push
   ```
4. GitHub Pages automatically updates (wait 1-2 minutes)

### Method 2: Using the App

1. Make changes in the app (add missions, track repairs, etc.)
2. Click **Export** button in the header
3. Save the downloaded JSON file
4. Replace `data/forces.json` with the exported file
5. Commit and push to GitHub

## JSON Structure

### Complete Example

```json
{
  "forces": [
    {
      "id": "force-1",
      "name": "Your Force Name",
      "description": "Force description",
      "image": "https://optional-image-url.jpg",
      "startingWarchest": 1000,
      "currentWarchest": 850,
      "mechs": [ ... ],
      "pilots": [ ... ],
      "missions": [ ... ],
      "repairActions": [ ... ]
    }
  ]
}
```

### Adding a New Force

```json
{
  "forces": [
    {
      "id": "force-1",
      "name": "Gray Death Legion",
      ...
    },
    {
      "id": "force-2",
      "name": "Wolf's Dragoons",
      "description": "Elite mercenary company",
      "image": "",
      "startingWarchest": 2000,
      "currentWarchest": 2000,
      "mechs": [],
      "pilots": [],
      "missions": [],
      "repairActions": []
    }
  ]
}
```

### Adding Mechs

```json
"mechs": [
  {
    "id": "mech-3",
    "name": "Timber Wolf Prime",
    "status": "Operational",
    "pilot": "Natasha Kerensky",
    "bv": 2620,
    "weight": 75,
    "image": "https://optional-image.jpg",
    "activityLog": []
  }
]
```

**Status options:** `Operational`, `Damaged`, `Disabled`, `Destroyed`, `Repairing`, `Unavailable`

### Adding Pilots

```json
"pilots": [
  {
    "id": "pilot-3",
    "name": "Natasha Kerensky",
    "gunnery": 2,
    "piloting": 2,
    "injuries": 0,
    "activityLog": []
  }
]
```

**Skills:** 0-7 (lower is better)  
**Injuries:** 0-5

### Adding Repair Actions

```json
"repairActions": [
  {
    "id": "repair-4",
    "name": "Reload Ammo",
    "formula": "(weight/10)",
    "makesUnavailable": false
  }
]
```

**Formula examples:**
- Simple: `weight/5`, `weight*2`, `10`
- Complex: `(weight*20)/5`, `weight/3 + 10`
- The variable `weight` is replaced with the mech's weight

### Adding Missions

Missions are typically added through the app, but you can add them manually:

```json
"missions": [
  {
    "id": "mission-1",
    "name": "Assault on Highland Base",
    "cost": 100,
    "description": "Attack enemy stronghold",
    "objectives": "1. Destroy command center\n2. Capture supplies",
    "recap": "Mission successful, heavy casualties",
    "warchestGained": 250,
    "completed": true,
    "createdAt": "2024-10-19T12:00:00.000Z",
    "completedAt": "2024-10-19T15:00:00.000Z"
  }
]
```

## Activity Logs

The app automatically tracks activities. You can view them in the JSON:

```json
"activityLog": [
  {
    "timestamp": "2024-10-19T12:00:00.000Z",
    "action": "Repair Armor performed (20 WP)",
    "mission": "Assault on Highland Base"
  }
]
```

## Workflow

### Starting a Campaign

1. Edit `data/forces.json` with your initial force setup
2. Commit and push to GitHub
3. Open your GitHub Pages URL
4. The app loads your force data

### During Campaign

1. Use the app to:
   - Track pilot injuries with +/- buttons
   - Create and complete missions
   - Perform repairs
   - View all your data

2. When done, click **Export**
3. Replace `data/forces.json` with exported file
4. Commit and push

### Between Sessions

All changes persist in the static JSON file. Just git pull to get latest data!

## Multiple Forces

You can manage multiple forces in one JSON file. The app has a dropdown to switch between them.

Example:
```json
{
  "forces": [
    {
      "id": "force-1",
      "name": "Gray Death Legion",
      ...
    },
    {
      "id": "force-2",
      "name": "Wolf's Dragoons",
      ...
    },
    {
      "id": "force-3",
      "name": "Kell Hounds",
      ...
    }
  ]
}
```

## Tips

### Backup Your Data

Always keep backups:
```bash
# Backup
cp data/forces.json data/forces-backup-2024-10-19.json

# Use git history
git log -- data/forces.json
git show HEAD~1:data/forces.json > forces-previous.json
```

### Validate JSON

Before committing, validate your JSON:
- Use an online validator (jsonlint.com)
- Or use the app - it will show errors if JSON is invalid

### Version Control

Use meaningful commit messages:
```bash
git commit -m "Mission 5 complete: +250 WP, Atlas needs repairs"
git commit -m "New pilot: Natasha Kerensky (2/2)"
git commit -m "End of session 3: 3 mechs operational"
```

## Troubleshooting

**App shows "Failed to load forces data"**
- Check that `data/forces.json` exists
- Validate JSON syntax
- Check browser console for errors

**Changes not showing**
- Did you commit and push?
- Wait 1-2 minutes for GitHub Pages to update
- Try hard refresh (Ctrl+Shift+R)

**Lost your data**
- Check git history: `git log -- data/forces.json`
- Restore from backup
- Use GitHub's file history on the web interface

## Example: Complete Force

See `data/forces.json` for a complete working example with:
- 1 force (Gray Death Legion)
- 2 mechs (Atlas, Marauder)
- 2 pilots (Grayson Carlyle, Lori Kalmar)
- 3 repair actions
- Starting warchest of 1000 WP

Copy and modify this structure for your own forces!
