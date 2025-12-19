import React from 'react';
import { formatNumber } from '../lib/utils';
import { UNIT_STATUS } from '../lib/constants';

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

export default function SnapshotsTab({ force }) {
  const snapshots = force?.snapshots || [];

  if (!force) return null;

  return (
    <div className="tactical-panel" data-testid="snapshots-panel">
      <div className="tactical-header flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Campaign Snapshots</h3>
        <p className="text-xs text-muted-foreground">
          Snapshots are automatically created when missions are completed (and later, after
          downtime cycles). They capture a summary of the force at that moment.
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
                <th className="text-left">Readiness (Mechs)</th>
                <th className="text-left">Readiness (Elementals)</th>
                <th className="text-left">Readiness (Pilots)</th>
                <th className="text-left">Missions</th>
                <th className="text-right">Warchest</th>
                <th className="text-right">Net Δ WP</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} data-testid="snapshot-row">
                  <td className="font-mono text-xs">{snap.createdAt}</td>
                  <td className="text-sm font-medium">{snap.label}</td>
                  <td className="text-xs text-muted-foreground">
                    {snap.type === 'post-mission' ? 'Post-Mission' : 'Post-Downtime'}
                  </td>
                  <td className="text-xs">
                    {snap.units.mechs.ready}/{snap.units.mechs.total}{' '}
                    <span className="text-muted-foreground">
                      (+{snap.units.mechs.destroyed} destroyed)
                    </span>
                  </td>
                  <td className="text-xs">
                    {snap.units.elementals.ready}/{snap.units.elementals.total}{' '}
                    <span className="text-muted-foreground">
                      (+{snap.units.elementals.destroyed} destroyed)
                    </span>
                  </td>
                  <td className="text-xs">
                    {snap.units.pilots.ready}/{snap.units.pilots.total}{' '}
                    <span className="text-muted-foreground">
                      (+{snap.units.pilots.kia} KIA)
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
