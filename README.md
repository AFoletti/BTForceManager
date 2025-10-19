# BattleTech Forces Manager

![BattleTech Forces Manager](https://img.shields.io/badge/BattleTech-Forces%20Manager-orange)

A comprehensive static web application for managing BattleTech Classic forces, mechs, pilots, missions, and repairs using the Warchest system.

## ✨ Features

### 🤖 Mech Management
- Track mechs with status, pilot assignment, BV (Battle Value), and weight
- View mech roster with images and detailed information
- Monitor mech activity logs for repair and mission history
- Support for multiple mech statuses (Operational, Damaged, Unavailable, etc.)

### 👤 Pilot Management
- Manage pilots with gunnery and piloting skills
- Track pilot injuries (0-5 scale) with +/- buttons
- View injury status with color-coded badges
- Activity logging for each pilot

### 🎯 Mission System
- Create named missions with descriptions and objectives
- Warchest-based mission costing system
- Mission cost deducted before mission starts
- Warchest rewards added after mission completion
- Write mission recaps and track outcomes
- Mission history with status badges (Active/Complete)

### 🔧 Repair Bay
- Customizable repair actions with formula-based costs
- Formulas use mech weight for dynamic pricing
- Example: `Repair Armor: (weight/5)`, `Reconfigure Omni: (weight*20)/5`
- Visual indicators for actions that make mechs unavailable
- Real-time cost calculation based on selected mech weight
- Warchest validation before repairs

### 📊 Data Management
- **Multiple Forces**: Switch between different mercenary units
- **JSON Editor**: Direct JSON editing for all data (mechs, pilots, repair actions, force info)
- **Export/Import**: Download and upload force data as JSON files
- **LocalStorage**: All data persists in browser localStorage
- **Activity Logging**: Complete history of actions per mech and pilot

### 🎨 Design
- **Dark Military Theme**: Tactical interface with aerospace orange accents
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Professional UI**: Data tables, status badges, and organized panels
- **Military Aesthetics**: Inspired by tactical command interfaces

## 🚀 Quick Start

### Local Development

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
yarn install

# Start development server
yarn start

# App will open at http://localhost:3000
```

### Build for Production

```bash
cd frontend
yarn build

# Build output in frontend/build/
```

## 📁 Data Structure

### Force
```json
{
  "id": "force-1",
  "name": "Gray Death Legion",
  "description": "Elite mercenary unit",
  "image": "https://example.com/image.jpg",
  "startingWarchest": 1000,
  "currentWarchest": 850,
  "mechs": [...],
  "pilots": [...],
  "missions": [...],
  "repairActions": [...]
}
```

### Mech
```json
{
  "id": "mech-1",
  "name": "Atlas AS7-D",
  "status": "Operational",
  "pilot": "Grayson Carlyle",
  "bv": 1897,
  "weight": 100,
  "image": "https://example.com/mech.jpg",
  "activityLog": []
}
```

### Pilot
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

### Repair Action
```json
{
  "id": "repair-1",
  "name": "Repair Armor",
  "formula": "(weight/5)",
  "makesUnavailable": false
}
```

### Mission
```json
{
  "id": "mission-1",
  "name": "Assault on Highland Base",
  "cost": 100,
  "description": "Mission briefing...",
  "objectives": "Primary objectives...",
  "recap": "What happened...",
  "warchestGained": 250,
  "completed": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 Repair Formulas

Formulas support JavaScript expressions with the `weight` variable:

- **Simple**: `weight/5`, `weight*2`
- **Complex**: `(weight*20)/5`, `weight/3 + 10`
- **Mathematical**: Any valid JavaScript math expression

Examples:
- `Repair Armor: (weight/5)` → 100-ton mech = 20 WP
- `Reconfigure Omni: (weight*20)/5` → 75-ton mech = 300 WP
- `Replace Structure: (weight/3)` → 100-ton mech = 33.3 WP

## 🎮 Workflow Example

1. **Setup Force**: Create your mercenary unit via Data Editor
2. **Add Mechs & Pilots**: Input your force composition with JSON
3. **Create Mission**: Define mission with warchest cost and objectives
4. **Track Injuries**: Update pilot injuries after battles using +/- buttons
5. **Perform Repairs**: Select mech and repair action, pay warchest cost
6. **Complete Mission**: Add recap and receive warchest rewards
7. **Export Data**: Download JSON backup of your campaign

## 📦 Tech Stack

- **React** 18.2 - UI framework
- **Tailwind CSS** 3.3 - Styling
- **Lucide React** - Icons
- **LocalStorage** - Data persistence
- **Create React App** - Build tooling

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed GitHub Pages deployment instructions.

Quick deploy:
```bash
cd frontend
yarn build
# Upload build/ folder to your web host or GitHub Pages
```

## 📝 Usage Tips

### Managing Multiple Forces
- Use the dropdown in header to switch between forces
- Each force has independent warchest and roster
- Export each force separately for backups

### Data Editing
- Use **Data Editor** tab for quick JSON edits
- Make sure JSON is valid before saving
- Use Reset button to undo changes
- Keep backups via Export function

### Warchest Management
- Mission costs are deducted when created
- Mission rewards added when marked complete
- Repair costs deducted immediately when performed
- Track current vs starting warchest in force banner

### Activity Logging
- Every action is automatically logged with timestamp
- Logs include mission context when applicable
- View recent activity in roster tables
- Complete history available in JSON editor

## 🤝 Contributing

This is a static frontend application designed for GitHub Pages deployment. Feel free to:
- Fork and customize for your campaign
- Add new features via data editor
- Modify repair formulas for your rules
- Customize the military theme styling

## 📄 License

MIT License - Feel free to use for your BattleTech campaigns!

## 🎯 Future Ideas

- Add pilot skill progression system
- Mission templates library
- Combat damage calculator
- Force comparison tools
- Campaign statistics dashboard
- Print-friendly force roster view

---

**Note**: This is a frontend-only application. All data is stored locally in your browser. Remember to export your data regularly for backups!
