import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ShieldAlert } from 'lucide-react';

// Scaffolding only: no functional controls yet. Reserved for future global
// configuration / operational tooling, kept visually distinct from the
// normal play flows (Force Roster, Mission Manager, Downtime).
export default function AdminView({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg" data-testid="admin-view-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
            Admin
          </DialogTitle>
        </DialogHeader>

        <div
          className="border border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center rounded"
          data-testid="admin-view-placeholder"
        >
          <p className="font-heading uppercase tracking-wider text-sm text-muted-foreground">
            Admin area &ndash; work in progress
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            No configuration or operational controls are available yet.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
