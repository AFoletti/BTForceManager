import React from 'react';
import { Button } from './ui/button';
import { Plus, Minus, Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatNumber } from '../lib/utils';

export default function ElementalRoster({ force, onUpdate }) {
  const updateCounter = (elementalId, field, delta) => {
    const updatedElementals = force.elementals.map(elemental => {
      if (elemental.id === elementalId) {
        const maxValue = field === 'suitsDestroyed' ? 4 : 5;
        const currentValue = elemental[field];
        const newValue = Math.max(0, Math.min(maxValue, currentValue + delta));
        
        return { ...elemental, [field]: newValue };
      }
      return elemental;
    });
    
    onUpdate({ elementals: updatedElementals });
  };

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

  const getSuitStatusColor = (destroyed, damaged) => {
    if (destroyed >= 3) return 'disabled';
    if (destroyed >= 1 || damaged >= 3) return 'damaged';
    return 'operational';
  };

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Elemental Roster
          </h3>
          <span className="text-xs text-muted-foreground">
            {force.elementals?.length || 0} Points
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Point</th>
              <th>Status</th>
              <th>Commander</th>
              <th className="text-center">Gunnery</th>
              <th className="text-center">Antimech</th>
              <th className="text-center">Suits Destroyed</th>
              <th className="text-center">Suits Damaged</th>
              <th className="text-right">BV</th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {(!force.elementals || force.elementals.length === 0) ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted-foreground">
                  No elementals in roster. Add elementals via Data Editor.
                </td>
              </tr>
            ) : (
              force.elementals.map(elemental => (
                <tr key={elemental.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {elemental.image && (
                        <img src={elemental.image} alt={elemental.name} className="w-10 h-10 rounded object-cover" />
                      )}
                      <span className="font-medium">{elemental.name}</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={getStatusColor(elemental.status)}>
                      {elemental.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">{elemental.commander || 'Unassigned'}</td>
                  <td className="text-center font-mono">{elemental.gunnery}</td>
                  <td className="text-center font-mono">{elemental.antimech}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateCounter(elemental.id, 'suitsDestroyed', -1)}
                        disabled={elemental.suitsDestroyed === 0}
                        className="h-7 w-7"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Badge variant={getSuitStatusColor(elemental.suitsDestroyed, elemental.suitsDamaged)}>
                        {elemental.suitsDestroyed}/4
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateCounter(elemental.id, 'suitsDestroyed', 1)}
                        disabled={elemental.suitsDestroyed === 4}
                        className="h-7 w-7"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateCounter(elemental.id, 'suitsDamaged', -1)}
                        disabled={elemental.suitsDamaged === 0}
                        className="h-7 w-7"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Badge variant={getSuitStatusColor(elemental.suitsDestroyed, elemental.suitsDamaged)}>
                        {elemental.suitsDamaged}/5
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateCounter(elemental.id, 'suitsDamaged', 1)}
                        disabled={elemental.suitsDamaged === 5}
                        className="h-7 w-7"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="text-right font-mono">{formatNumber(elemental.bv)}</td>
                  <td className="text-xs text-muted-foreground">
                    {elemental.activityLog && elemental.activityLog.length > 0 ? (
                      <div className="max-w-xs truncate">
                        {elemental.activityLog[elemental.activityLog.length - 1].action}
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
