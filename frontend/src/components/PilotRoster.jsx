import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Minus, User } from 'lucide-react';
import { Badge } from './ui/badge';
import { findMechForPilot } from '../lib/mechs';

export default function PilotRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingPilot, setEditingPilot] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gunnery: 4,
    piloting: 5,
    injuries: 0,
    history: '',
    warchestCost: 0,
  });
  const [nameFilter, setNameFilter] = useState('');
  const [sortBy, setSortBy] = useState(null); // null = JSON order
  const [sortDirection, setSortDirection] = useState('asc');

  const openDialog = (pilot = null) => {
    if (pilot) {
      setEditingPilot(pilot);
      setFormData({
        name: pilot.name,
        gunnery: pilot.gunnery,
        piloting: pilot.piloting,
        injuries: pilot.injuries,
        history: pilot.history || '',
        warchestCost: pilot.warchestCost || 0,
      });
    } else {
      setEditingPilot(null);
      setFormData({
        name: '',
        gunnery: 4,
        piloting: 5,
        injuries: 0,
        history: '',
        warchestCost: 0,
      });
    }
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      // eslint-disable-next-line no-alert
      alert('Name is required');
      return;
    }

    if (editingPilot) {
      // Update existing pilot
      const updatedPilots = force.pilots.map((pilot) =>
        pilot.id === editingPilot.id
          ? {
              ...pilot,
              name: formData.name,
              gunnery: parseInt(formData.gunnery, 10) || 4,
              piloting: parseInt(formData.piloting, 10) || 5,
              injuries: parseInt(formData.injuries, 10) || 0,
              history: formData.history,
              warchestCost: parseInt(formData.warchestCost, 10) || 0,
            }
          : pilot,
      );
      const prevCost = editingPilot.warchestCost || 0;
      const newCost = parseInt(formData.warchestCost, 10) || 0;
      const delta = newCost - prevCost;
      const currentWarchest = force.currentWarchest - delta;
      onUpdate({ pilots: updatedPilots, currentWarchest });
    } else {
      // Add new pilot
      const warchestCost = parseInt(formData.warchestCost, 10) || 0;
      const timestamp = force.currentDate;
      const newPilot = {
        id: `pilot-${Date.now()}`,
        name: formData.name,
        gunnery: parseInt(formData.gunnery, 10) || 4,
        piloting: parseInt(formData.piloting, 10) || 5,
        injuries: 0,
        history: formData.history,
        warchestCost,
        activityLog: [
          {
            timestamp,
            action: `Hired pilot for ${warchestCost} WP`,
            mission: null,
            cost: warchestCost,
          },
        ],
      };

      const updatedPilots = [...force.pilots, newPilot];
      const currentWarchest = force.currentWarchest - warchestCost;
      onUpdate({ pilots: updatedPilots, currentWarchest });
    }

    setShowDialog(false);
  };

  const updateInjuries = (pilotId, delta) => {
    const updatedPilots = force.pilots.map((pilot) => {
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

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedPilots = React.useMemo(() => {
    const filtered = force.pilots.filter((pilot) =>
      pilot.name.toLowerCase().includes(nameFilter.toLowerCase()),
    );

    if (!sortBy) return filtered; // Default JSON order

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
      }

      return 0;
    });

    return sorted;
  }, [force.pilots, nameFilter, sortBy, sortDirection]);

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Pilot Roster
          </h3>
          <div className="flex items-center gap-2">
            <Input
              data-testid="pilot-name-filter"
              className="h-8 w-40"
              placeholder="Filter by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {filteredAndSortedPilots.length}/{force.pilots.length} Pilots
            </span>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="w-4 h-4" />
              Add Pilot
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  data-testid="pilot-sort-name"
                  className="flex items-center gap-1"
                  onClick={() => handleSortChange('name')}
                >
                  Name
                  {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>Mech</th>
              <th className="text-center">Gunnery</th>
              <th className="text-center">Piloting</th>
              <th className="text-center">Injuries</th>
              <th className="text-center">Actions</th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPilots.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-muted-foreground">
                  No pilots match the current filters.
                </td>
              </tr>
            ) : (
              filteredAndSortedPilots.map((pilot) => {
                const assignedMech = findMechForPilot(force, pilot);

                return (
                  <tr
                    key={pilot.id}
                    onClick={(e) => {
                      // Don't open dialog if clicking on injury buttons
                      if (!e.target.closest('button')) {
                        openDialog(pilot);
                      }
                    }}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="font-medium">{pilot.name}</td>
                    <td className="text-sm">
                      {assignedMech ? assignedMech.name : 'Unassigned'}
                    </td>
                    <td className="text-center font-mono">{pilot.gunnery}</td>
                    <td className="text-center font-mono">{pilot.piloting}</td>
                    <td className="text-center">
                      <Badge variant={getInjuryColor(pilot.injuries)}>
                        {getInjuryDisplay(pilot.injuries)}
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
                          disabled={pilot.injuries === 6}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Pilot Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPilot ? 'Edit Pilot' : 'Add New Pilot'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Pilot Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Natasha Kerensky"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Gunnery</label>
                <Input
                  type="number"
                  value={formData.gunnery}
                  onChange={(e) => setFormData({ ...formData, gunnery: e.target.value })}
                  placeholder="4"
                  min="0"
                  max="8"
                />
                <p className="text-xs text-muted-foreground mt-1">0-8 (lower is better)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Piloting</label>
            <div>
              <label className="block text-sm font-medium mb-2">Warchest Cost (WP)</label>
              <Input
                type="number"
                value={formData.warchestCost}
                onChange={(e) => setFormData({ ...formData, warchestCost: e.target.value })}
                placeholder="0"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cost in WP to recruit this pilot. This will be subtracted from the current Warchest.
              </p>
            </div>

                <Input
                  type="number"
                  value={formData.piloting}
                  onChange={(e) => setFormData({ ...formData, piloting: e.target.value })}
                  placeholder="5"
                  min="0"
                  max="8"
                />
                <p className="text-xs text-muted-foreground mt-1">0-8 (lower is better)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">History</label>
              <Textarea
                value={formData.history}
                onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                placeholder="Pilot background, service record, notable achievements..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name}>
                {editingPilot ? 'Update Pilot' : 'Add Pilot'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
