import React from 'react';
import { Button } from './ui/button';
import { Plus, Minus, User } from 'lucide-react';
import { Badge } from './ui/badge';

export default function PilotRoster({ force, onUpdate }) {
  const updateInjuries = (pilotId, delta) => {
    const updatedPilots = force.pilots.map(pilot => {
      if (pilot.id === pilotId) {
        const newInjuries = Math.max(0, Math.min(6, pilot.injuries + delta));
        return { ...pilot, injuries: newInjuries };
      }
      return pilot;
    });
    
    onUpdate({ pilots: updatedPilots });
  };

  const getInjuryColor = (injuries) => {
    if (injuries === 6) return 'disabled'; // KIA
    if (injuries === 0) return 'operational';
    if (injuries <= 2) return 'damaged';
    return 'disabled';
  };

  const getInjuryDisplay = (injuries) => {
    if (injuries === 6) return 'KIA';
    return `${injuries}/6`;
  };

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Pilot Roster
          </h3>
          <span className="text-xs text-muted-foreground">{force.pilots.length} Pilots</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="text-center">Gunnery</th>
              <th className="text-center">Piloting</th>
              <th className="text-center">Injuries</th>
              <th className="text-center">Actions</th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {force.pilots.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-muted-foreground">
                  No pilots in roster. Add pilots via Data Editor.
                </td>
              </tr>
            ) : (
              force.pilots.map(pilot => (
                <tr key={pilot.id}>
                  <td className="font-medium">{pilot.name}</td>
                  <td className="text-center font-mono">{pilot.gunnery}</td>
                  <td className="text-center font-mono">{pilot.piloting}</td>
                  <td className="text-center">
                    <Badge variant={getInjuryColor(pilot.injuries)}>
                      {pilot.injuries}/5
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateInjuries(pilot.id, -1)}
                        disabled={pilot.injuries === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateInjuries(pilot.id, 1)}
                        disabled={pilot.injuries === 5}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {pilot.activityLog && pilot.activityLog.length > 0 ? (
                      <div className="max-w-xs truncate">
                        {pilot.activityLog[pilot.activityLog.length - 1].action}
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
