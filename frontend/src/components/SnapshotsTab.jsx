import React, { useState } from 'react';
import { formatNumber } from '../lib/utils';
import { UNIT_STATUS } from '../lib/constants';
import { hasFullSnapshot, rollbackToSnapshot, MAX_FULL_SNAPSHOTS } from '../lib/snapshots';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { RotateCcw, AlertTriangle } from 'lucide-react';

const STATUS_ORDER = [
  UNIT_STATUS.OPERATIONAL,
  UNIT_STATUS.DAMAGED,
  UNIT_STATUS.DISABLED,
  UNIT_STATUS.REPAIRING,
  UNIT_STATUS.UNAVAILABLE,
  UNIT_STATUS.DESTROYED,
];

const STATUS_LABELS = {
  [UNIT_STATUS.OPERATIONAL]: 'OP',
  [UNIT_STATUS.DAMAGED]: 'DMG',
  [UNIT_STATUS.DISABLED]: 'DSBL',
  [UNIT_STATUS.REPAIRING]: 'REP',
  [UNIT_STATUS.UNAVAILABLE]: 'UNAV',
  [UNIT_STATUS.DESTROYED]: 'DEST',
};

export default function SnapshotsTab({ force, onUpdate }) {
  const [confirmRollback, setConfirmRollback] = useState(null);
  const snapshots = force?.snapshots || [];
  const fullSnapshots = force?.fullSnapshots || [];

  if (!force) return null;

  const handleRollback = (snapshotId) => {
    const restoredForce = rollbackToSnapshot(force, snapshotId);
    if (restoredForce) {
      onUpdate(restoredForce);
      setConfirmRollback(null);
    }
  };

  const snapshotToRollback = confirmRollback 
    ? snapshots.find(s => s.id === confirmRollback) 
    : null;

  return (
    <div className="tactical-panel" data-testid="snapshots-panel">
      <div className="tactical-header flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Campaign Snapshots</h3>
        <p className="text-xs text-muted-foreground">
          Snapshots are automatically created after missions and downtime cycles.
          The 2 most recent can be rolled back to.
        </p>
      </div>

      {snapshots.length === 0 ? (
        <div
          className="p-6 text-sm text-muted-foreground text-center"
          data-testid="snapshots-empty-state"
        >
          No snapshots yet. Complete missions to automatically create post-mission snapshots.
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <table className="data-table" data-testid="snapshots-table">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Label</th>
                <th className="text-left">Type</th>
                <th className="text-left">Status (M/E)</th>
                <th className="text-left">Missions</th>
                <th className="text-right">Warchest</th>
                <th className="text-right">Net Δ WP</th>
                <th className="text-center">Rollback</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap, index) => {
                const isLastSnapshot = index === snapshots.length - 1;
                const canRollback = !isLastSnapshot && hasFullSnapshot(snap.id, fullSnapshots);
                return (
                <tr key={snap.id} data-testid="snapshot-row">
                  <td className="font-mono text-xs">{snap.createdAt}</td>
                  <td className="text-sm font-medium">{snap.label}</td>
                  <td className="text-xs text-muted-foreground">
                    {snap.type === 'pre-mission'
                      ? 'Pre-Mission'
                      : snap.type === 'post-mission'
                        ? 'Post-Mission'
                        : 'Post-Downtime'}
                  </td>
                  <td className="text-xs align-top">
                    <table className="text-[10px]">
                      <tbody>
                        <tr data-testid="snapshot-mechs-summary">
                          <td className="pr-1 font-semibold text-muted-foreground">M:</td>
                          {STATUS_ORDER.map((status) => (
                            <td key={status} className="px-0.5 text-center">
                              <span className="block text-[9px] text-muted-foreground">
                                {STATUS_LABELS[status]}
                              </span>
                              <span
                                className={`font-bold ${
                                  status === UNIT_STATUS.OPERATIONAL
                                    ? 'text-green-600'
                                    : status === UNIT_STATUS.DAMAGED
                                      ? 'text-amber-600'
                                      : status === UNIT_STATUS.REPAIRING
                                        ? 'text-blue-600'
                                        : status === UNIT_STATUS.DESTROYED
                                          ? 'text-red-700'
                                          : 'text-red-600'
                                }`}
                                data-testid={`snapshot-mechs-${status.toLowerCase()}-count`}
                              >
                                {snap.units.mechs.byStatus[status] || 0}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr data-testid="snapshot-elementals-summary">
                          <td className="pr-1 font-semibold text-muted-foreground">E:</td>
                          {STATUS_ORDER.map((status) => (
                            <td key={status} className="px-0.5 text-center">
                              <span className="block text-[9px] text-muted-foreground">
                                {STATUS_LABELS[status]}
                              </span>
                              <span
                                className={`font-bold ${
                                  status === UNIT_STATUS.OPERATIONAL
                                    ? 'text-green-600'
                                    : status === UNIT_STATUS.DAMAGED
                                      ? 'text-amber-600'
                                      : status === UNIT_STATUS.REPAIRING
                                        ? 'text-blue-600'
                                        : status === UNIT_STATUS.DESTROYED
                                          ? 'text-red-700'
                                          : 'text-red-600'
                                }`}
                                data-testid={`snapshot-elementals-${status.toLowerCase()}-count`}
                              >
                                {snap.units.elementals.byStatus[status] || 0}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {snap.missionsCompleted} completed
                  </td>
                  <td className="text-right font-mono text-sm">
                    {formatNumber(snap.currentWarchest)}
                  </td>
                  <td
                    className={`text-right font-mono text-sm ${
                      snap.netWarchestChange >= 0
                        ? 'text-emerald-400'
                        : 'text-destructive'
                    }`}
                  >
                    {snap.netWarchestChange >= 0 ? '+' : ''}
                    {formatNumber(snap.netWarchestChange)}
                  </td>
                  <td className="text-center">
                    {canRollback ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRollback(snap.id)}
                        className="h-7 w-7 p-0"
                        title="Rollback to this snapshot"
                        data-testid={`rollback-btn-${snap.id}`}
                      >
                        <RotateCcw className="h-4 w-4 text-amber-500" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Rollback Confirmation Dialog */}
      <Dialog open={!!confirmRollback} onOpenChange={() => setConfirmRollback(null)}>
        <DialogContent onClose={() => setConfirmRollback(null)}>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Are you sure you want to rollback to this snapshot?
            </p>
            {snapshotToRollback && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p><strong>Date:</strong> {snapshotToRollback.createdAt}</p>
                <p><strong>Label:</strong> {snapshotToRollback.label}</p>
                <p><strong>Warchest:</strong> {formatNumber(snapshotToRollback.currentWarchest)} WP</p>
              </div>
            )}
            <p className="text-sm text-amber-500">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              This will restore the force to this point and delete all snapshots after it.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRollback(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleRollback(confirmRollback)}
                data-testid="confirm-rollback-btn"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
