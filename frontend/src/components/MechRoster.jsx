import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Shield, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { findPilotForMech, getAvailablePilotsForMech } from '../lib/mechs';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';
import MechAutocomplete from './MechAutocomplete';

export default function MechRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMech, setEditingMech] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
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
        aValue = a.bv;
        bValue = b.bv;
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
                          ? `${pilot.name} - KIA`
                          : `${pilot.name} - G:${pilot.gunnery} / P:${pilot.piloting}`}
                    </td>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Mech Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMech ? 'Edit Mech' : 'Add New Mech'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mech Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Atlas AS7-D"
                />
              </div>

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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pilot</label>
                <Select
                  value={formData.pilotId}
                  onChange={(e) => setFormData({ ...formData, pilotId: e.target.value })}
                >
                  <option value="">No pilot</option>
                  {availablePilots.map((pilot) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name} - G:{pilot.gunnery} / P:{pilot.piloting}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only pilots not currently assigned to a mech are listed.
                </p>
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
