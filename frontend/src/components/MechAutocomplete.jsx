import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './ui/input';
import { Search, X } from 'lucide-react';
import { searchMechCatalog, getMechCatalogImportStatus } from '../lib/api';

/**
 * Parse a CSV line handling quoted fields (which may contain commas).
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV text into an array of mech objects.
 * Extracts all relevant mech data including movement, heat, and components.
 */
function parseMechCatalogCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Parse header (handle BOM if present)
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().toLowerCase());
  
  // Build column index map
  const colIdx = {};
  header.forEach((col, idx) => { colIdx[col] = idx; });

  if (colIdx['chassis'] === undefined) {
    console.warn('CSV missing required "chassis" column');
    return [];
  }

  const mechs = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const chassis = cols[colIdx['chassis']]?.trim() || '';
    if (!chassis) continue;

    const model = cols[colIdx['model']]?.trim() || '';
    const name = model ? `${chassis} ${model}` : chassis;
    
    // Basic info
    const bv = parseInt(cols[colIdx['bv']], 10) || 0;
    const tonnage = parseInt(cols[colIdx['tonnage']], 10) || 0;
    const mulId = parseInt(cols[colIdx['mul_id']], 10) || null;
    const year = parseInt(cols[colIdx['year']], 10) || null;
    const techbase = cols[colIdx['techbase']]?.trim() || null;
    const role = cols[colIdx['role']]?.trim() || null;
    
    // Movement
    const walk = parseInt(cols[colIdx['walk']], 10) || 0;
    const maxWalk = parseInt(cols[colIdx['maxwalk']], 10) || walk;
    const jump = parseInt(cols[colIdx['jump']], 10) || 0;
    const maxJump = parseInt(cols[colIdx['maxjump']], 10) || jump;
    
    // Heat
    const heat = parseInt(cols[colIdx['heat']], 10) || 0;
    const dissipation = parseInt(cols[colIdx['dissipation']], 10) || 0;
    const dissipationEfficiency = parseInt(cols[colIdx['dissipationefficiency']], 10) || 0;
    
    // Components (equipment/weapons)
    const componentsRaw = cols[colIdx['components']]?.trim() || '';
    
    mechs.push({
      name, chassis, model, bv, tonnage, mulId, year, techbase, role,
      walk, maxWalk, jump, maxJump,
      heat, dissipation, dissipationEfficiency,
      components: componentsRaw
    });
  }

  return mechs;
}

// Cached catalog for reuse
let cachedCatalog = null;
let catalogPromise = null;

/**
 * Load the mech catalog from CSV (cached)
 */
export async function loadMechCatalog() {
  if (cachedCatalog) return cachedCatalog;
  if (catalogPromise) return catalogPromise;
  
  catalogPromise = (async () => {
    const paths = [
      './data/mek_catalog.csv',
      '/data/mek_catalog.csv',
      `${process.env.PUBLIC_URL}/data/mek_catalog.csv`,
    ];
    
    for (const path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const csvText = await response.text();
          cachedCatalog = parseMechCatalogCSV(csvText);
          return cachedCatalog;
        }
      } catch {
        // Try next path
      }
    }
    console.warn('Could not load mech catalog from any path');
    return [];
  })();
  
  return catalogPromise;
}

/**
 * Look up a mech in the catalog by name (exact match)
 */
export function lookupMechInCatalog(catalog, mechName) {
  if (!catalog || !mechName) return null;
  const nameLower = mechName.toLowerCase().trim();
  return catalog.find(m => m.name.toLowerCase() === nameLower) || null;
}

// Watcher timestamps look like "20260810T062812123456" (from
// datetime.strftime("%Y%m%dT%H%M%S%f")) - format into a readable local time.
function formatWatcherTimestamp(ts) {
  if (!ts || ts.length < 15) return ts || '';
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString();
}

const IMPORT_STATUS_POLL_INTERVAL_MS = 8000;

/**
 * MechAutocomplete - A searchable dropdown for selecting mechs from the catalog
 * 
 * @param {string} value - Current input value
 * @param {function} onChange - Called with the input value when typing
 * @param {function} onSelect - Called with full mech data when a mech is selected from the list
 * @param {string} placeholder - Input placeholder text
 */
export default function MechAutocomplete({ value, onChange, onSelect, placeholder = "Search mechs..." }) {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const [importStatus, setImportStatus] = useState(null);
  const [dismissedImportKey, setDismissedImportKey] = useState(null);

  // Poll the watched-folder mech catalog import status while this component
  // is mounted, so dropping a CSV into the NAS watch folder is visible in
  // the UI without a page reload. Local to this component (no global state).
  useEffect(() => {
    let active = true;
    const poll = () => {
      getMechCatalogImportStatus()
        .then((data) => {
          if (active) setImportStatus(data);
        })
        .catch(() => {
          // Silently ignore - the badge just stays hidden/stale until the
          // next successful poll.
        });
    };
    poll();
    const interval = setInterval(poll, IMPORT_STATUS_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Debounced search against the backend mech catalog API
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.length < 2) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      searchMechCatalog(value)
        .then((results) => {
          if (requestIdRef.current === requestId) {
            setSearchResults(results);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('Mech catalog search failed:', err);
          if (requestIdRef.current === requestId) {
            setSearchResults([]);
            setIsLoading(false);
          }
        });
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const filteredMechs = searchResults;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredMechs.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedEl = listRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback((mech) => {
    onSelect({
      name: mech.name,
      bv: mech.bv || 0,
      weight: mech.tonnage || 0,
      // Movement data
      walk: mech.walk || 0,
      maxWalk: mech.maxWalk || mech.walk || 0,
      jump: mech.jump || 0,
      maxJump: mech.maxJump || mech.jump || 0,
      // Heat data
      heat: mech.heat || 0,
      dissipation: mech.dissipation || 0,
      dissipationEfficiency: mech.dissipationEfficiency || 0,
      // Components
      components: mech.components || '',
    });
    setIsOpen(false);
  }, [onSelect]);

  const handleKeyDown = (e) => {
    if (!isOpen || filteredMechs.length === 0) {
      if (e.key === 'ArrowDown' && filteredMechs.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < filteredMechs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMechs[highlightedIndex]) {
          handleSelect(filteredMechs[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.length >= 2);
  };

  const showDropdown = isOpen && filteredMechs.length > 0;

  const latestImport = importStatus?.recentImports?.[0] || null;
  const latestImportKey = latestImport ? `${latestImport.timestamp}-${latestImport.filename}` : 'idle';
  const showImportBadge = Boolean(importStatus?.enabled) && dismissedImportKey !== latestImportKey;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {showImportBadge && (
        <div
          data-testid="mech-catalog-import-status"
          className={`mt-1 flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs ${
            latestImport?.status === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}
        >
          {latestImport ? (
            latestImport.status === 'error' ? (
              <span data-testid="mech-catalog-import-status-error">
                Catalog import failed ({formatWatcherTimestamp(latestImport.timestamp)}): {latestImport.reason}
              </span>
            ) : (
              <span data-testid="mech-catalog-import-status-success">
                Last catalog import {formatWatcherTimestamp(latestImport.timestamp)} - {latestImport.created} new,{' '}
                {latestImport.updated} updated
                {latestImport.skipped ? `, ${latestImport.skipped} skipped` : ''}
              </span>
            )
          ) : (
            <span data-testid="mech-catalog-import-status-idle">Watching for catalog CSV drops...</span>
          )}
          <button
            type="button"
            data-testid="mech-catalog-import-status-dismiss"
            onClick={() => setDismissedImportKey(latestImportKey)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss import status"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {showDropdown && (
        <div 
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-md shadow-lg"
        >
          {filteredMechs.map((mech, index) => (
            <button
              key={mech.id ?? `${mech.name}-${index}`}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex justify-between items-center ${
                index === highlightedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => handleSelect(mech)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="font-medium truncate flex-1">{mech.name}</span>
              <span className="text-muted-foreground text-xs ml-2 whitespace-nowrap">
                {mech.tonnage ? `${mech.tonnage}t` : ''}
                {mech.tonnage && mech.bv ? ' · ' : ''}
                {mech.bv ? `BV ${mech.bv}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && value.length >= 2 && filteredMechs.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-popover border border-border rounded-md shadow-lg text-sm text-muted-foreground">
          No mechs found. You can still enter a custom name.
        </div>
      )}

      {isLoading && value.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-popover border border-border rounded-md shadow-lg text-sm text-muted-foreground">
          Searching catalog...
        </div>
      )}
    </div>
  );
}
