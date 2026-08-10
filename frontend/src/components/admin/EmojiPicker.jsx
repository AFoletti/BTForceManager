import React, { useEffect, useRef, useState } from 'react';

// Curated set of standard emojis fitting a BattleTech achievements context
// (medals, combat, callsigns) - kept short and thematic rather than a full
// emoji keyboard.
const EMOJI_OPTIONS = [
  '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '⭐', '🌟', '💫', '✨',
  '🔥', '💥', '☄️', '⚔️', '🛡️', '🗡️', '🔫', '💣', '🚀', '🎯',
  '💀', '☠️', '🦾', '🤖', '🚁', '✈️', '🛰️', '🌋', '⚡', '🌪️',
  '👑', '🦁', '🐺', '🐉', '🦂', '🦅', '🐍', '🦇', '🐻', '🦍',
  '💪', '🧠', '👁️', '🩸', '⚰️', '🚩', '🏴', '🎗️', '📯', '🔱',
];

export default function EmojiPicker({ value, onChange, testIdPrefix = 'emoji-picker' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 flex items-center justify-center border border-border/60 rounded bg-background hover:border-amber-500/50 text-xl leading-none"
        data-testid={`${testIdPrefix}-toggle-btn`}
      >
        {value || <span className="text-muted-foreground text-xs">?</span>}
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-64 max-h-56 overflow-y-auto grid grid-cols-8 gap-1 p-2 border border-amber-500/30 bg-card rounded shadow-lg"
          data-testid={`${testIdPrefix}-panel`}
        >
          {value && (
            <button
              type="button"
              className="col-span-8 text-xs text-left text-muted-foreground hover:text-destructive px-1 py-1"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              data-testid={`${testIdPrefix}-clear-btn`}
            >
              Clear icon
            </button>
          )}
          {EMOJI_OPTIONS.map((emoji, index) => (
            <button
              type="button"
              key={emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className="text-lg hover:bg-amber-500/20 rounded p-1 leading-none"
              data-testid={`${testIdPrefix}-option-${index}`}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
