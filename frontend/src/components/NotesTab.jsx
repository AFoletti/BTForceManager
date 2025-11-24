import React from 'react';
import { Textarea } from './ui/textarea';

export default function NotesTab({ force, onUpdate }) {
  if (!force) return null;

  const handleChange = (event) => {
    onUpdate({ notes: event.target.value });
  };

  return (
    <div className="tactical-panel" data-testid="force-notes-panel">
      <div className="tactical-header">
        <h3 className="text-sm font-semibold uppercase tracking-wider">
          Campaign Notes
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground" data-testid="force-notes-help-text">
          Use this space to track narrative details, contracts, NPCs and any other campaign
          notes. Notes are stored with this force and included when you export it as JSON or
          PDF.
        </p>
        <Textarea
          data-testid="force-notes-textarea"
          rows={12}
          value={force.notes || ''}
          onChange={handleChange}
          placeholder="Write your campaign notes here..."
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
