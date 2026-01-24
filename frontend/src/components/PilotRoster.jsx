import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Minus, User, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { findMechForPilot } from '../lib/mechs';
import { getPilotDisplayName } from '../lib/pilots';
import { computeCombatStats } from '../lib/achievements';
import { formatNumber } from '../lib/utils';

// Sort icon component (moved outside to avoid recreation on render)
function SortIcon({ sortKey, sortConfig }) {
  if (sortConfig.key !== sortKey) return null;
  return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
}

export default function PilotRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingPilot, setEditingPilot] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [achievementDefinitions, setAchievementDefinitions] = useState([]);

  // Load achievement definitions
  useEffect(() => {
    fetch('./data/achievements.json')
      .then((res) => res.json())
      .then((data) => setAchievementDefinitions(data.achievements || []))
      .catch(() => setAchievementDefinitions([]));
  }, []);

  const getAchievementById = (achievementId) => {
    return achievementDefinitions.find((a) => a.id === achievementId) || { name: achievementId, icon: '🏆', description: '' };
  };

  const [formData, setFormData] = useState({
    name: '',
    gunnery: 4,
    piloting: 5,
    injuries: 0,
    dezgra: false,
    history: '',
    warchestCost: 0,
  });

  const openDialog = (pilot = null) => {
    if (pilot) {
      setEditingPilot(pilot);
      setFormData({
        name: pilot.name,
        gunnery: pilot.gunnery,
        piloting: pilot.piloting,
        injuries: pilot.injuries,
        dezgra: Boolean(pilot.dezgra),
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
        dezgra: false,
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
          ? (() => {
              const nextDezgra = Boolean(formData.dezgra);
              const prevDezgra = Boolean(pilot.dezgra);

              const nextActivityLog = Array.isArray(pilot.activityLog) ? [...pilot.activityLog] : [];
              if (nextDezgra !== prevDezgra) {
                nextActivityLog.push({
                  timestamp: force.currentDate,
                  action: nextDezgra ? 'Marked as Dezgra' : 'Cleared Dezgra status',
                  mission: null,
                  cost: 0,
                });
              }

              return {
                ...pilot,
                name: formData.name,
                gunnery: parseInt(formData.gunnery, 10) || 4,
                piloting: parseInt(formData.piloting, 10) || 5,
                injuries: parseInt(formData.injuries, 10) || 0,
                dezgra: nextDezgra,
                history: formData.history,
                warchestCost: parseInt(formData.warchestCost, 10) || 0,
                activityLog: nextActivityLog,
              };
            })()
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
        dezgra: false,
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

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredPilots = force.pilots.filter((pilot) => {
    const assignedMech = findMechForPilot(force, pilot);
    const searchStr = filterText.toLowerCase();
    return (
      pilot.name.toLowerCase().includes(searchStr) ||
      (assignedMech && assignedMech.name.toLowerCase().includes(searchStr))
    );
  });

  const sortedPilots = [...filteredPilots].sort((a, b) => {
    const mechA = findMechForPilot(force, a);
    const mechB = findMechForPilot(force, b);
    const statsA = computeCombatStats(a.combatRecord);
    const statsB = computeCombatStats(b.combatRecord);
    
    let aValue, bValue;
    
    switch (sortConfig.key) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'mech':
        aValue = mechA ? mechA.name : '';
        bValue = mechB ? mechB.name : '';
        break;
      case 'gunnery':
        aValue = a.gunnery;
        bValue = b.gunnery;
        break;
      case 'piloting':
        aValue = a.piloting;
        bValue = b.piloting;
        break;
      case 'injuries':
        aValue = a.injuries;
        bValue = b.injuries;
        break;
      case 'kills':
        aValue = statsA.killCount;
        bValue = statsB.killCount;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Pilot Roster
          </h3>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <Input 
              placeholder="Filter by pilot or mech..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="max-w-xs h-8 text-xs"
              data-testid="pilot-filter-input"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{force.pilots.length} Pilots</span>
              <Button size="sm" onClick={() => openDialog()} data-testid="add-pilot-button">
                <Plus className="w-4 h-4" />
                Add Pilot
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Name <SortIcon sortKey="name" sortConfig={sortConfig} /></div>
              </th>
              <th onClick={() => handleSort('mech')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Mech <SortIcon sortKey="mech" sortConfig={sortConfig} /></div>
              </th>
              <th onClick={() => handleSort('gunnery')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Gunnery <SortIcon sortKey="gunnery" sortConfig={sortConfig} /></div>
              </th>
              <th onClick={() => handleSort('piloting')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Piloting <SortIcon sortKey="piloting" sortConfig={sortConfig} /></div>
              </th>
              <th onClick={() => handleSort('kills')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Kills <SortIcon sortKey="kills" sortConfig={sortConfig} /></div>
              </th>
              <th className="text-center">Achievements</th>
              <th onClick={() => handleSort('injuries')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Injuries <SortIcon sortKey="injuries" sortConfig={sortConfig} /></div>
              </th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedPilots.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-muted-foreground">
                  {force.pilots.length === 0 
                    ? "No pilots in roster. Add pilots via Data Editor." 
                    : "No pilots match your filter."}
                </td>
              </tr>
            ) : (
              sortedPilots.map((pilot) => {
                const assignedMech = findMechForPilot(force, pilot);
                const combatStats = computeCombatStats(pilot.combatRecord);
                const achievements = pilot.achievements || [];
                const kills = pilot.combatRecord?.kills || [];

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
                    <td className="font-medium" data-testid={`pilot-name-${pilot.id}`}>
                      {getPilotDisplayName(pilot)}
                    </td>
                    <td className="text-sm">
                      {assignedMech ? assignedMech.name : 'Unassigned'}
                    </td>
                    <td className="text-center font-mono">{pilot.gunnery}</td>
                    <td className="text-center font-mono">{pilot.piloting}</td>
                    <td className="text-center">
                      <div className="relative group">
                        <span className="font-mono font-bold text-primary">{combatStats.killCount}</span>
                        {kills.length > 0 && (
                          <div className="absolute z-50 hidden group-hover:block bg-popover border border-border rounded-md shadow-lg p-2 min-w-48 left-1/2 -translate-x-1/2 mt-1 text-xs">
                            <div className="font-semibold mb-1">Kill List:</div>
                            {kills.map((kill, idx) => (
                              <div key={idx} className="text-muted-foreground py-0.5">
                                • {kill.mechModel} ({kill.tonnage}t)
                              </div>
                            ))}
                            <div className="border-t border-border mt-1 pt-1 text-muted-foreground">
                              Assists: {combatStats.assists}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="relative group flex justify-center gap-0.5">
                        {achievements.length > 0 ? (
                          <>
                            {achievements.slice(0, 4).map((achId) => {
                              const ach = getAchievementById(achId);
                              return (
                                <span key={achId} className="text-sm" title={`${ach.name}: ${ach.description}`}>
                                  {ach.icon}
                                </span>
                              );
                            })}
                            {achievements.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{achievements.length - 4}</span>
                            )}
                            <div className="absolute z-50 hidden group-hover:block bg-popover border border-border rounded-md shadow-lg p-2 min-w-48 left-1/2 -translate-x-1/2 mt-1 text-xs">
                              <div className="font-semibold mb-1">Achievements:</div>
                              {achievements.map((achId) => {
                                const ach = getAchievementById(achId);
                                return (
                                  <div key={achId} className="py-0.5 flex items-center gap-2">
                                    <span>{ach.icon}</span>
                                    <span className="font-medium">{ach.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </div>
                    </td>
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
                data-testid="pilot-name-input"
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
              <label className="block text-sm font-medium mb-2">Dezgra</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(formData.dezgra)}
                  onChange={(e) => setFormData({ ...formData, dezgra: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  data-testid="pilot-dezgra-checkbox"
                />
                <span>Mark this pilot as Dezgra 🚫</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Dezgra pilots are marked with 🚫 across the UI and exports.
              </p>
            </div>

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

            <div>
              <label className="block text-sm font-medium mb-2">History</label>
              <Textarea
                value={formData.history}
                onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                placeholder="Pilot background, service record, notable achievements..."
                rows={4}
              />
            </div>

            {/* Combat Record Section - Only shown when editing existing pilot */}
            {editingPilot && (editingPilot.combatRecord?.kills?.length > 0 || editingPilot.achievements?.length > 0) && (
              <div className="border border-border rounded p-4 bg-muted/10">
                <h4 className="text-sm font-semibold mb-3">Combat Record</h4>
                
                {/* Stats Summary */}
                {(() => {
                  const stats = computeCombatStats(editingPilot.combatRecord);
                  return (
                    <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                      <div className="bg-background rounded p-2 text-center">
                        <div className="font-bold text-lg text-primary">{stats.killCount}</div>
                        <div className="text-muted-foreground">Kills</div>
                      </div>
                      <div className="bg-background rounded p-2 text-center">
                        <div className="font-bold text-lg">{stats.assists}</div>
                        <div className="text-muted-foreground">Assists</div>
                      </div>
                      <div className="bg-background rounded p-2 text-center">
                        <div className="font-bold text-lg">{stats.missionsCompleted}</div>
                        <div className="text-muted-foreground">Missions</div>
                      </div>
                      <div className="bg-background rounded p-2 text-center">
                        <div className="font-bold text-lg">{formatNumber(stats.totalTonnageDestroyed)}t</div>
                        <div className="text-muted-foreground">Tonnage</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Kill List Table */}
                {editingPilot.combatRecord?.kills?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Kill List</div>
                    <div className="max-h-32 overflow-y-auto border border-border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Mech</th>
                            <th className="text-center px-2 py-1">Tonnage</th>
                            <th className="text-left px-2 py-1">Mission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingPilot.combatRecord.kills.map((kill, idx) => (
                            <tr key={idx} className="border-t border-border/50">
                              <td className="px-2 py-1 font-medium">{kill.mechModel}</td>
                              <td className="px-2 py-1 text-center">{kill.tonnage}t</td>
                              <td className="px-2 py-1 text-muted-foreground">{kill.mission}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Achievements Table */}
                {editingPilot.achievements?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Achievements</div>
                    <div className="max-h-32 overflow-y-auto border border-border rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-center px-2 py-1 w-10">Icon</th>
                            <th className="text-left px-2 py-1">Achievement</th>
                            <th className="text-left px-2 py-1">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingPilot.achievements.map((achId) => {
                            const ach = getAchievementById(achId);
                            return (
                              <tr key={achId} className="border-t border-border/50">
                                <td className="px-2 py-1 text-center text-base">{ach.icon}</td>
                                <td className="px-2 py-1 font-medium">{ach.name}</td>
                                <td className="px-2 py-1 text-muted-foreground">{ach.description}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="pilot-dialog-cancel-button">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name} data-testid="pilot-dialog-save-button">
                {editingPilot ? 'Update Pilot' : 'Add Pilot'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
