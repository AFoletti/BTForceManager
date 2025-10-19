# Changelog

All notable changes to the BattleTech Forces Manager will be documented in this file.

## [Latest] - 2025-01-19

### Added
- **Edit Unit Functionality**: Click on any Mech, Pilot, or Elemental in their roster tables to edit their information
  - Pre-populated dialogs with current unit data
  - Visual hover effects indicate clickable rows
  - Smart click detection prevents opening dialog when clicking action buttons
  - Dynamic dialog titles and button text (Add vs Edit/Update)

- **PDF Export Feature**: Generate professional, print-ready force reports
  - Military-themed design with tactical borders and decorative elements
  - Printer-friendly black/gray on white paper
  - Complete force data in organized sections:
    - Force Information header with key stats
    - Pilot Roster with skills, injuries, and history
    - Elemental Roster with commander, suits status, and BV
    - Mech Information with pilot assignments and specifications
    - Mission Log with complete details and after-action reports
  - Automatic page breaks for clean printing
  - Professional typography with apostrophe number separators (1'897)
  - Dynamic filename based on force name
  - Client-side generation (works with GitHub Pages)
  - Error handling with user feedback

- **History Field**: Added free-text history field to all unit types (Mechs, Pilots, Elementals)
  - Capture unit background, notable battles, and service records
  - Displayed in unit cards in PDF exports

### Changed
- Improved component organization with consistent dialog patterns
- Enhanced user experience with visual feedback on clickable elements
- Updated button styling to match military-tactical theme

### Technical
- Added `@react-pdf/renderer` v4.3.1 for PDF generation
- Implemented manual PDF generation using `pdf().toBlob()` for better reliability
- Added null checks and safe defaults throughout PDF component
- Fixed ESLint warnings (removed unused Badge import)

### Dependencies
- Added: `@react-pdf/renderer` ^4.3.1
- All other dependencies maintained at current versions

## Previous Updates

### Data Management Refactor
- Migrated from localStorage to static JSON files
- Implemented force manifest system
- Separated downtime actions into shared JSON file
- Added force-level WP multiplier

### Elemental System
- Added Elemental infantry unit type
- Suit damage tracking (destroyed 0-4, damaged 0-5)
- Commander assignment
- Antimech skill tracking

### Mission System Enhancement
- Unit assignment to missions
- Total BV calculation
- Comprehensive mission logging

### Downtime Operations
- Renamed from "Repair Bay"
- Added formula-based cost calculations
- Implemented WP rounding up
- Other action option for custom operations
