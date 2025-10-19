import React from 'react';
import { Badge } from './ui/badge';
import { Shield } from 'lucide-react';
import { formatNumber } from '../lib/utils';

export default function MechRoster({ force }) {
  const getStatusColor = (status) => {
    const statusMap = {
      'Operational': 'operational',
      'Damaged': 'damaged',
      'Disabled': 'disabled',
      'Repairing': 'repairing',
      'Unavailable': 'disabled'
    };
    return statusMap[status] || 'default';
  };

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Mech Roster
          </h3>
          <span className="text-xs text-muted-foreground">{force.mechs.length} Units</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mech</th>
              <th>Status</th>
              <th>Pilot</th>
              <th className="text-right">BV</th>
              <th className="text-right">Weight</th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {force.mechs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-muted-foreground">
                  No mechs in roster. Add mechs via Data Editor.
                </td>
              </tr>
            ) : (
              force.mechs.map(mech => (
                <tr key={mech.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {mech.image && (
                        <img src={mech.image} alt={mech.name} className="w-10 h-10 rounded object-cover" />
                      )}
                      <span className="font-medium">{mech.name}</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={getStatusColor(mech.status)}>
                      {mech.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">{mech.pilot || 'Unassigned'}</td>
                  <td className="text-right font-mono">{formatNumber(mech.bv)}</td>
                  <td className="text-right font-mono">{mech.weight}t</td>
                  <td className="text-xs text-muted-foreground">
                    {mech.activityLog && mech.activityLog.length > 0 ? (
                      <div className="max-w-xs truncate">
                        {mech.activityLog[mech.activityLog.length - 1].action}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">No activity</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
