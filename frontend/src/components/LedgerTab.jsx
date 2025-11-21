import React from 'react';
import { buildLedgerEntries, summariseLedger } from '../lib/ledger';
import { formatNumber } from '../lib/utils';

export default function LedgerTab({ force }) {
  const ledgerEntries = buildLedgerEntries(force);

  const { formatted } = summariseLedger(
    ledgerEntries,
    force.currentWarchest,
    force.startingWarchest,
  );

  if (!ledgerEntries.length) {
    return (
      <div className="tactical-panel">
        <div className="p-6 text-center text-muted-foreground">
          No warchest-affecting actions recorded for this force.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="tactical-panel">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Financial Ledger</h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-2 w-32">Date</th>
                <th className="text-left py-2 pr-2 w-24">Type</th>
                <th className="text-left py-2 pr-2 w-56">Unit / Mission</th>
                <th className="text-left py-2 pr-2">Description</th>
                <th className="text-right py-2 pr-2 w-20">Cost</th>
                <th className="text-right py-2 w-20">Gain</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry, idx) => (
                <tr key={`${entry.timestamp}-${entry.unitName}-${idx}`} className="border-b border-border/50">
                  <td className="py-1 pr-2 font-mono text-[11px] text-muted-foreground">
                    {entry.timestamp}
                  </td>
                  <td className="py-1 pr-2 text-[11px] text-muted-foreground">{entry.sourceType}</td>
                  <td className="py-1 pr-2 text-[11px]">{entry.unitName}</td>
                  <td className="py-1 pr-2 text-[11px] text-muted-foreground">{entry.description}</td>
                  <td className="py-1 pr-2 text-right font-mono text-[11px] text-red-400">
                    {entry.cost < 0 ? `-${formatNumber(Math.abs(entry.cost))}` : ''}
                  </td>
                  <td className="py-1 text-right font-mono text-[11px] text-emerald-400">
                    {entry.gain > 0 ? `+${formatNumber(entry.gain)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tactical-panel">
        <div className="p-4 text-xs text-muted-foreground flex flex-wrap gap-4">
          <div>
            <span className="font-semibold text-foreground">Starting Warchest:</span>{' '}
            <span className="font-mono">{formatted.starting} WP</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Total Spent:</span>{' '}
            <span className="font-mono text-red-400">{formatted.totalSpent} WP</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Total Gained:</span>{' '}
            <span className="font-mono text-emerald-400">{formatted.totalGained} WP</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Net Change:</span>{' '}
            <span className="font-mono">{formatted.net} WP</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Current Warchest:</span>{' '}
            <span className="font-mono">{formatted.current} WP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
