import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './ui/input';
import { Search } from 'lucide-react';

/**
 * MechAutocomplete - A searchable dropdown for selecting mechs from the catalog
 * 
 * @param {string} value - Current input value
 * @param {function} onChange - Called with the input value when typing
 * @param {function} onSelect - Called with full mech data when a mech is selected from the list
 * @param {string} placeholder - Input placeholder text
 */
export default function MechAutocomplete({ value, onChange, onSelect, placeholder = "Search mechs..." }) {
  const [catalog, setCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  // Load mech catalog on mount
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/data/mech-catalog.json`);
        if (response.ok) {
          const data = await response.json();
          setCatalog(data.mechs || []);
        }
      } catch (error) {
        console.warn('Could not load mech catalog:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCatalog();
  }, []);

  // Filter mechs based on search input
  const filteredMechs = catalog.filter((mech) => {
    if (!value || value.length < 2) return false;
    const searchLower = value.toLowerCase();
    return (
      mech.name?.toLowerCase().includes(searchLower) ||
      mech.chassis?.toLowerCase().includes(searchLower) ||
      mech.model?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 50); // Limit results for performance

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

      {showDropdown && (
        <div 
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-md shadow-lg"
        >
          {filteredMechs.map((mech, index) => (
            <button
              key={mech.sourceFile || `${mech.name}-${index}`}
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
          Loading mech catalog...
        </div>
      )}
    </div>
  );
}
