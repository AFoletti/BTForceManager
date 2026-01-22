import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Shield, Plus, ArrowUp, ArrowDown, Move, Flame, Crosshair } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { findPilotForMech, getAvailablePilotsForMech, getMechAdjustedBV } from '../lib/mechs';
import { getPilotDisplayName } from '../lib/pilots';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';
import MechAutocomplete from './MechAutocomplete';

/**
 * Parse components string into categorized equipment arrays
 */
function parseComponents(componentsStr) {
  if (!componentsStr) return { weapons: [], equipment: [] };
  
  const items = componentsStr.split(',').map(s => s.trim()).filter(Boolean);
  const weapons = [];
  const equipment = [];
  
  // Skip patterns - internal components and ammo
  const skipPatterns = [
    /armor/i, /structure/i, /engine/i, /gyro/i, /cockpit/i,
    /\bammo\b/i, /ferro.*fibrous/i, /endo.*steel/i, /endo.*composite/i
  ];
  
  // Equipment types that are not weapons
  const equipmentPatterns = [
    /ecm/i, /bap/i, /\bc3\b/i, /\btag\b/i, /\bnarc\b/i, /\bams\b/i,
    /\bcase\b/i, /targeting/i, /probe/i, /supercharger/i,
    /\btsm\b/i, /\bmasc\b/i, /jump jet/i, /partial wing/i,
    /void signature/i, /stealth/i, /heat sink/i,
    /capacitor/i, /apollo/i, /artemis/i, /streak/i
  ];
  
  // Weapon patterns
  const weaponPatterns = [
    /laser/i, /ppc/i, /\bac[\s/-]*\d/i, /autocannon/i, /gauss/i,
    /\blrm/i, /\bsrm/i, /\bmrm/i, /\batm\b/i,
    /machine gun/i, /\bmg\b/i, /flamer/i, /plasma/i,
    /\bhag\b/i, /lb.*ac/i, /\bultra\b/i, /rotary/i,
    /thunderbolt/i, /arrow/i, /\bmml/i, /rocket/i
  ];
  
  for (const item of items) {
    // Extract count and name (format: "2xER Medium Laser:LA")
    const match = item.match(/^(\d+)x(.+?)(?::(.+))?$/);
    if (!match) continue;
    
    const count = parseInt(match[1], 10);
    const name = match[2].trim();
    const location = match[3]?.trim() || '';
    
    // Skip internal components
    if (['Armor', 'Structure', 'Engine'].includes(location)) continue;
    if (skipPatterns.some(p => p.test(name))) continue;
    
    const isEquipment = equipmentPatterns.some(p => p.test(name));
    const isWeapon = weaponPatterns.some(p => p.test(name));
    
    const entry = { count, name, location };
    
    if (isWeapon && !isEquipment) {
      weapons.push(entry);
    } else {
      equipment.push(entry);
    }
  }
  
  return { weapons, equipment };
}

/**
 * Get color class for equipment type (similar to MekBay)
 */
function getEquipmentColor(name) {
  const nameLower = name.toLowerCase();
  
  // Energy weapons - blue
  if (/laser|ppc|plasma|flamer/i.test(nameLower)) {
    return 'border-blue-500 bg-blue-500/10';
  }
  // Ballistic - purple
  if (/ac|autocannon|gauss|machine gun|mg|lb.*x|ultra|rotary|hag/i.test(nameLower)) {
    return 'border-purple-500 bg-purple-500/10';
  }
  // Missile - green
  if (/lrm|srm|mrm|atm|streak|mml|rocket|thunderbolt|arrow/i.test(nameLower)) {
    return 'border-green-500 bg-green-500/10';
  }
  // Equipment - yellow/gold
  return 'border-yellow-600 bg-yellow-600/10';
}

export default function MechRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMech, setEditingMech] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Catalog info from CSV (movement, heat, components)
  const [catalogInfo, setCatalogInfo] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    status: UNIT_STATUS.OPERATIONAL,
    pilotId: '',
    bv: 0,
    weight: 0,
    image: '',
    history: '',
    warchestCost: 0,
  });

  const openDialog = (mech = null) => {
    if (mech) {
      setEditingMech(mech);
      setFormData({
        name: mech.name,
        status: mech.status || UNIT_STATUS.OPERATIONAL,
        pilotId: mech.pilotId || '',
        bv: mech.bv,
        weight: mech.weight,
        image: mech.image || '',
        history: mech.history || '',
        warchestCost: mech.warchestCost || 0,
      });
      setCatalogInfo(null); // Clear catalog info when editing existing mech
    } else {
      setEditingMech(null);
      setFormData({
        name: '',
        status: UNIT_STATUS.OPERATIONAL,
        pilotId: '',
        bv: 0,
        weight: 0,
        image: '',
        history: '',
        warchestCost: 0,
      });
      setCatalogInfo(null);
    }
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.bv || !formData.weight) {
      // eslint-disable-next-line no-alert
      alert('Name, BV, and Weight are required');
      return;
    }

    if (editingMech) {
      // Update existing mech
      const updatedMechs = force.mechs.map((mech) =>
        mech.id === editingMech.id
          ? {
              ...mech,
              name: formData.name,
              status: formData.status,
              pilotId: formData.pilotId,
              bv: parseInt(formData.bv, 10) || 0,
              weight: parseInt(formData.weight, 10) || 0,
              image: formData.image,
              history: formData.history,
              warchestCost: parseInt(formData.warchestCost, 10) || 0,
            }
          : mech,
      );
      const prevCost = editingMech.warchestCost || 0;
      const newCost = parseInt(formData.warchestCost, 10) || 0;
      const delta = newCost - prevCost;
      const currentWarchest = force.currentWarchest - delta;
      onUpdate({ mechs: updatedMechs, currentWarchest });
    } else {
      // Add new mech
      const warchestCost = parseInt(formData.warchestCost, 10) || 0;
      const timestamp = force.currentDate;
      const newMech = {
        id: `mech-${Date.now()}`,
        name: formData.name,
        status: formData.status,
        pilotId: formData.pilotId,
        bv: parseInt(formData.bv, 10) || 0,
        weight: parseInt(formData.weight, 10) || 0,
        image: formData.image,
        history: formData.history,
        warchestCost,
        activityLog: [
          {
            timestamp,
            action: `Purchased mech for ${warchestCost} WP`,
            mission: null,
            cost: warchestCost,
          },
        ],
      };

      const updatedMechs = [...force.mechs, newMech];
      const currentWarchest = force.currentWarchest - warchestCost;
      onUpdate({ mechs: updatedMechs, currentWarchest });
    }

    setShowDialog(false);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredMechs = force.mechs.filter((mech) => {
    const pilot = findPilotForMech(force, mech);
    const searchStr = filterText.toLowerCase();
    return (
      mech.name.toLowerCase().includes(searchStr) ||
      (pilot && pilot.name.toLowerCase().includes(searchStr))
    );
  });

  const sortedMechs = [...filteredMechs].sort((a, b) => {
    const pilotA = findPilotForMech(force, a);
    const pilotB = findPilotForMech(force, b);
    
    let aValue, bValue;
    
    switch (sortConfig.key) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'pilot':
        aValue = pilotA ? pilotA.name : '';
        bValue = pilotB ? pilotB.name : '';
        break;
      case 'bv':
        // Sort by adjusted BV
        aValue = getMechAdjustedBV(force, a);
        bValue = getMechAdjustedBV(force, b);
        break;
      case 'weight':
        aValue = a.weight;
        bValue = b.weight;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const availablePilots = getAvailablePilotsForMech(force, editingMech);

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Mech Roster
          </h3>
          
          <div className="flex items-center gap-4 flex-1 justify-end">
            <Input 
              placeholder="Filter by mech or pilot..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="max-w-xs h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{force.mechs.length} Units</span>
              <Button size="sm" onClick={() => setShowDialog(true)}>
                <Plus className="w-4 h-4" />
                Add Mech
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
                <div className="flex items-center">Mech <SortIcon column="name" /></div>
              </th>
              <th onClick={() => handleSort('status')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Status <SortIcon column="status" /></div>
              </th>
              <th onClick={() => handleSort('pilot')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Pilot <SortIcon column="pilot" /></div>
              </th>
              <th onClick={() => handleSort('bv')} className="text-right cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-end">BV <SortIcon column="bv" /></div>
              </th>
              <th onClick={() => handleSort('weight')} className="text-right cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-end">Weight <SortIcon column="weight" /></div>
              </th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {sortedMechs.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-muted-foreground">
                  {force.mechs.length === 0 
                    ? "No mechs in roster. Add mechs via Data Editor." 
                    : "No mechs match your filter."}
                </td>
              </tr>
            ) : (
              sortedMechs.map((mech) => {
                const pilot = findPilotForMech(force, mech);

                return (
                  <tr
                    key={mech.id}
                    onClick={() => openDialog(mech)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        {mech.image && (
                          <img
                            src={mech.image}
                            alt={mech.name}
                            className="max-h-10 max-w-10 rounded object-contain"
                          />
                        )}
                        <span className="font-medium">{mech.name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={getStatusBadgeVariant(mech.status)}>{mech.status}</Badge>
                    </td>
                    <td className="text-muted-foreground">
                      {!pilot
                        ? 'Missing Pilot'
                        : pilot.injuries === 6
                          ? `${getPilotDisplayName(pilot)} - KIA`
                          : `${getPilotDisplayName(pilot)} - G:${pilot.gunnery} / P:${pilot.piloting}`}
                    </td>
                    <td className="text-right font-mono">{formatNumber(getMechAdjustedBV(force, mech))}</td>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Mech Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMech ? 'Edit Mech' : 'Add New Mech'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mech Name *</label>
              <MechAutocomplete
                value={formData.name}
                onChange={(name) => {
                  setFormData({ ...formData, name });
                  setCatalogInfo(null); // Clear catalog info when typing
                }}
                onSelect={(mechData) => {
                  setFormData({
                    ...formData,
                    name: mechData.name,
                    bv: mechData.bv || formData.bv,
                    weight: mechData.weight || formData.weight,
                  });
                  // Store catalog info for display
                  setCatalogInfo({
                    walk: mechData.walk,
                    maxWalk: mechData.maxWalk,
                    jump: mechData.jump,
                    maxJump: mechData.maxJump,
                    heat: mechData.heat,
                    dissipation: mechData.dissipation,
                    dissipationEfficiency: mechData.dissipationEfficiency,
                    components: mechData.components,
                  });
                }}
                placeholder="Search mech catalog..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Type at least 2 characters to search. Select a mech to auto-fill BV and weight.
              </p>
            </div>

            {/* Catalog Info Display */}
            {catalogInfo && (
              <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
                {/* Movement and Heat Row */}
                <div className="flex flex-wrap gap-6">
                  {/* Movement */}
                  <div className="flex items-center gap-2">
                    <Move className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Movement:</span>
                    <span className="text-sm font-mono">
                      {catalogInfo.walk}/{catalogInfo.walk * 1.5 | 0}
                      {catalogInfo.maxWalk > catalogInfo.walk && (
                        <span className="text-blue-400"> [{catalogInfo.maxWalk}/{catalogInfo.maxWalk * 1.5 | 0}]</span>
                      )}
                      {catalogInfo.jump > 0 && (
                        <>
                          /{catalogInfo.jump}
                          {catalogInfo.maxJump > catalogInfo.jump && (
                            <span className="text-blue-400"> [{catalogInfo.maxJump}]</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  
                  {/* Heat */}
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">
                      <span className="text-orange-400">{catalogInfo.heat}</span>
                      <span className="text-muted-foreground"> gen</span>
                      <span className="mx-1">/</span>
                      <span className="text-cyan-400">{catalogInfo.dissipation}</span>
                      <span className="text-muted-foreground"> sink</span>
                    </span>
                  </div>
                </div>
                
                {/* Equipment Section */}
                {catalogInfo.components && (() => {
                  const { weapons, equipment } = parseComponents(catalogInfo.components);
                  const hasContent = weapons.length > 0 || equipment.length > 0;
                  
                  if (!hasContent) return null;
                  
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Crosshair className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Equipment</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {weapons.map((w, i) => (
                          <div
                            key={`weapon-${i}`}
                            className={`px-2 py-1 text-xs font-medium border-l-4 ${getEquipmentColor(w.name)}`}
                          >
                            {w.count}× {w.name}
                          </div>
                        ))}
                        {equipment.map((e, i) => (
                          <div
                            key={`equip-${i}`}
                            className={`px-2 py-1 text-xs font-medium border-l-4 ${getEquipmentColor(e.name)}`}
                          >
                            {e.count}× {e.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value={UNIT_STATUS.OPERATIONAL}>{UNIT_STATUS.OPERATIONAL}</option>
                  <option value={UNIT_STATUS.DAMAGED}>{UNIT_STATUS.DAMAGED}</option>
                  <option value={UNIT_STATUS.DISABLED}>{UNIT_STATUS.DISABLED}</option>
                  <option value={UNIT_STATUS.DESTROYED}>{UNIT_STATUS.DESTROYED}</option>
                  <option value={UNIT_STATUS.REPAIRING}>{UNIT_STATUS.REPAIRING}</option>
                  <option value={UNIT_STATUS.UNAVAILABLE}>{UNIT_STATUS.UNAVAILABLE}</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">BV (Battle Value) *</label>
                <Input
                  type="number"
                  value={formData.bv}
                  onChange={(e) => setFormData({ ...formData, bv: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Weight (tons) *</label>
                <Input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                />
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
                  Cost in WP to acquire this mech. This will be subtracted from the current
                  Warchest.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pilot</label>
              <Select
                value={formData.pilotId}
                onChange={(e) => setFormData({ ...formData, pilotId: e.target.value })}
              >
                <option value="">No pilot</option>
                {availablePilots.map((pilot) => (
                  <option key={pilot.id} value={pilot.id}>
                    {getPilotDisplayName(pilot)} - G:{pilot.gunnery} / P:{pilot.piloting}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Only pilots not currently assigned to a mech are listed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Image URL (optional)</label>
              <Input
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://example.com/mech-image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">History</label>
              <Textarea
                value={formData.history}
                onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                placeholder="Mech history, notable battles, previous pilots..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name || !formData.bv || !formData.weight}
              >
                {editingMech ? 'Update Mech' : 'Add Mech'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
