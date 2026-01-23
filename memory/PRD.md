# BattleTech Forces Manager - PRD

## Original Problem Statement
Implement enhancements from GitHub Issue #55 for the BattleTech Forces Manager app:
1. Add Special Abilities display to force banner
2. Add SP (Support Points) purchases to mission setup
3. Add tonnage total to mission summary

## Architecture
- **Type**: Static single-page web app (React + Tailwind CSS)
- **Backend**: None - all data stored in JSON files
- **Data**: `/app/data/` folder with forces, downtime actions, mech catalog
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
- **Files**: `App.js`, `PDFExport.jsx`, force JSON files
- **Feature**: Force `specialAbilities` array (title + description) displayed as table in banner
- **Location**: Between force image and main content area
- **PDF**: Special Abilities section added to PDF export

#### Enhancement 2: SP (Support Points) Purchases  
- **Files**: `MissionManager.jsx`, `missions.js`, `sp-choices.json`
- **Feature**: 
  - SP Budget field in mission dialog
  - Dropdown picker loading choices from `/data/sp-choices.json`
  - Items too expensive are disabled in dropdown
  - Purchased items shown with remove button
  - Remaining SP calculated and displayed
  - SP purchases stored in mission data and shown in PDF

#### Enhancement 3: Tonnage Total
- **Files**: `MissionManager.jsx`, `missions.js`, `PDFExport.jsx`
- **Feature**:
  - `calculateMissionTotalTonnage()` function added
  - Tonnage shown next to "Assign Mechs to Mission"
  - Updates dynamically when mechs assigned/unassigned
  - Stored in mission data as `totalTonnage`
  - Combined Force section shows tonnage + BV
  - PDF export includes tonnage in mission details

### Data Files Created
- `/app/data/sp-choices.json` - SP purchase options (name + cost)
- `/app/frontend/public/data/sp-choices.json` - Dev server copy

### Sample Special Abilities Added
- 19th Great White force: Zellbrigen, Blood Fury abilities

## Prioritized Backlog

### P0 (Critical)
- None - core features complete

### P1 (High)
- Campaign Timeline View (transformative enhancement discussed)
- Snapshot comparison mode

### P2 (Medium)
- Pilot callsign support
- More SP choice categories
- Activity log filtering

## Next Tasks
1. Campaign Timeline View implementation
2. Snapshot comparison feature
3. Additional SP choice customization options
