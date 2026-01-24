# BattleTech Forces Manager - PRD

## Original Problem Statement
Implement enhancements for the BattleTech Forces Manager app including:
1. Special Abilities display in force banner
2. SP (Support Points) purchases in mission setup
3. Tonnage total in mission summary
4. Pilot Kill Board & Achievements system

## Architecture
- **Type**: Static single-page web app (React + Tailwind CSS)
- **Backend**: None - all data stored in JSON files
- **Data**: `/app/data/` folder with forces, downtime actions, mech catalog, achievements
- **Build**: React source in `/app/frontend/` compiles to `/app/static/`

## User Personas
- BattleTech tabletop gamers managing campaign forces
- Players using the Warchest campaign system
- Game masters tracking multi-session campaigns

## Core Requirements (Static)
- Force management (mechs, pilots, elementals)
- Mission creation and tracking
- Downtime operations with formula-based costs
- Warchest/financial tracking
- PDF export of force data

## What's Been Implemented

### Session: January 23, 2026

#### Enhancement 1: Special Abilities Display
- Force `specialAbilities` array (title + description) displayed as table in banner
- Positioned between force image and main content area
- Included in PDF export

#### Enhancement 2: SP (Support Points) Purchases  
- SP Budget field in mission dialog
- Dropdown picker loading choices from `/data/sp-choices.json`
- Items too expensive are disabled in dropdown
- Purchased items shown with remove button, remaining SP calculated
- Stored in mission data and shown in PDF

#### Enhancement 3: Tonnage Total
- `calculateMissionTotalTonnage()` function added
- Tonnage shown in mission dialog and mission cards
- Stored in mission data as `totalTonnage`
- Included in PDF export

#### Enhancement 4: Pilot Kill Board & Achievements
- **Combat Record** tracking per pilot:
  - Kills (with mech model, tonnage, mission, date)
  - Assists (simple counter)
  - Missions completed, missions without injury
- **Kill Entry** via MechAutocomplete dropdown in mission completion dialog
- **15 Achievements** defined in `/data/achievements.json`:
  - Kill-based: First Blood, Ace (5), Double Ace (10), Legend (20)
  - Weight class: Light/Medium/Heavy/Assault Hunter (5 each)
  - Tonnage Master (1000t total), Giant Slayer (100t kill)
  - Team Player (5 assists), Survivor, Veteran, Battle Hardened, Iron Will
- **Achievements Popup** shown after mission completion when new achievements earned
- **Pilot Roster** updated with Kills column (sortable) + Achievements badges (with tooltips)
- **PDF Export** includes combat records and achievements

### Files Created
- `/app/data/achievements.json` - Achievement definitions
- `/app/data/sp-choices.json` - SP purchase options
- `/app/frontend/src/lib/achievements.js` - Achievement checking logic

### Files Modified
- `MissionManager.jsx` - SP purchases, tonnage, kill/assist tracking, achievements popup
- `PilotRoster.jsx` - Kills column, achievements badges with tooltips
- `PDFExport.jsx` - Combat records, achievements, SP purchases, tonnage
- `missions.js` - Tonnage calculation function
- `App.js` - Special abilities display

## Prioritized Backlog

### P0 (Critical)
- None - core features complete

### P1 (High)
- Salvage & Procurement System
- Opposing Force (OpFor) Tracker

### P2 (Medium)
- Campaign Timeline View
- Snapshot comparison mode

## Next Tasks
1. User testing of Kill Board & Achievements
2. Consider Salvage system implementation
3. OpFor tracking for campaign narrative
