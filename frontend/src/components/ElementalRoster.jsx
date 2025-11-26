import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Minus, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatNumber } from '../lib/utils';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';

export default function ElementalRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingElemental, setEditingElemental] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [formData, setFormData] = useState({
    name: '',
    commander: '',
    gunnery: 3,
    antimech: 4,
    suitsDestroyed: 0,
    suitsDamaged: 0,
    bv: 0,
    status: UNIT_STATUS.OPERATIONAL,
    image: '',
    history: '',
    warchestCost: 0,
  });

  const openDialog = (elemental = null) => {
    if (elemental) {
      setEditingElemental(elemental);
      setFormData({
        name: elemental.name,
        commander: elemental.commander || '',
        gunnery: elemental.gunnery,
        antimech: elemental.antimech,
        suitsDestroyed: elemental.suitsDestroyed,
        suitsDamaged: elemental.suitsDamaged,
        bv: elemental.bv,
        status: elemental.status || UNIT_STATUS.OPERATIONAL,
        image: elemental.image || '',
        history: elemental.history || '',
        warchestCost: elemental.warchestCost || 0,
      });
    } else {
      setEditingElemental(null);
      setFormData({
        name: '',
        commander: '',
        gunnery: 3,
        antimech: 4,
        suitsDestroyed: 0,
        suitsDamaged: 0,
        bv: 0,
        status: UNIT_STATUS.OPERATIONAL,
        image: '',
        history: '',
        warchestCost: 0,
      });
    }
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.bv) {
      // eslint-disable-next-line no-alert
      alert('Name and BV are required');
      return;
    }

    if (editingElemental) {
      // Update existing elemental
      const updatedElementals = (force.elementals || []).map((e) =>
        e.id === editingElemental.id
          ? {
              ...e,
              name: formData.name,
              commander: formData.commander,
              gunnery: parseInt(formData.gunnery, 10) || 3,
              antimech: parseInt(formData.antimech, 10) || 4,
              suitsDestroyed: parseInt(formData.suitsDestroyed, 10) || 0,
              suitsDamaged: parseInt(formData.suitsDamaged, 10) || 0,
              bv: parseInt(formData.bv, 10) || 0,
              status: formData.status,
              image: formData.image,
              history: formData.history,
              warchestCost: parseInt(formData.warchestCost, 10) || 0,
            }
          : e,
      );
      const prevCost = editingElemental.warchestCost || 0;
      const newCost = parseInt(formData.warchestCost, 10) || 0;
      const delta = newCost - prevCost;
      const currentWarchest = force.currentWarchest - delta;
      onUpdate({ elementals: updatedElementals, currentWarchest });
    } else {
      // Add new elemental
      const warchestCost = parseInt(formData.warchestCost, 10) || 0;
      const timestamp = force.currentDate;
      const newElemental = {
        id: `elemental-${Date.now()}`,
        name: formData.name,
        commander: formData.commander,
        gunnery: parseInt(formData.gunnery, 10) || 3,
        antimech: parseInt(formData.antimech, 10) || 4,
        suitsDestroyed: 0,
        suitsDamaged: 0,
        bv: parseInt(formData.bv, 10) || 0,
        status: formData.status,
        image: formData.image,
        history: formData.history,
        warchestCost,
        activityLog: [
          {
            timestamp,
            action: `Purchased elemental point for ${warchestCost} WP`,
            mission: null,
            cost: warchestCost,
          },
        ],
      };

      const updatedElementals = [...(force.elementals || []), newElemental];
      const currentWarchest = force.currentWarchest - warchestCost;
      onUpdate({ elementals: updatedElementals, currentWarchest });
    }

    setShowDialog(false);
  };

  const updateCounter = (elementalId, field, delta) => {
    const updatedElementals = force.elementals.map((elemental) => {
      if (elemental.id === elementalId) {
        // Both destroyed and damaged suits are capped at 5
        const maxValue = 5;
        const currentValue = elemental[field];
        const newValue = Math.max(0, Math.min(maxValue, currentValue + delta));

        return { ...elemental, [field]: newValue };
      }
      return elemental;
    });

    onUpdate({ elementals: updatedElementals });
  };

  const getSuitStatusVariant = (destroyed, damaged) => {
    if (destroyed >= 3) return 'disabled';
    if (destroyed >= 1 || damaged >= 3) return 'damaged';
    return 'operational';
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredElementals = (force.elementals || []).filter((elemental) => {
    const searchStr = filterText.toLowerCase();
    return (
      elemental.name.toLowerCase().includes(searchStr) ||
      (elemental.commander && elemental.commander.toLowerCase().includes(searchStr))
    );
  });

  const sortedElementals = [...filteredElementals].sort((a, b) => {
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
      case 'commander':
        aValue = a.commander || '';
        bValue = b.commander || '';
        break;
      case 'gunnery':
        aValue = a.gunnery;
        bValue = b.gunnery;
        break;
      case 'antimech':
        aValue = a.antimech;
        bValue = b.antimech;
        break;
      case 'bv':
        aValue = a.bv;
        bValue = b.bv;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Elemental Roster
          </h3>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <Input 
              placeholder="Filter by name or commander..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="max-w-xs h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {force.elementals?.length || 0} Points
              </span>
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4" />
                Add Elemental
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
                <div className="flex items-center">Point <SortIcon column="name" /></div>
              </th>
              <th onClick={() => handleSort('status')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Status <SortIcon column="status" /></div>
              </th>
              <th onClick={() => handleSort('commander')} className="cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center">Commander <SortIcon column="commander" /></div>
              </th>
              <th onClick={() => handleSort('gunnery')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Gunnery <SortIcon column="gunnery" /></div>
              </th>
              <th onClick={() => handleSort('antimech')} className="text-center cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-center">Antimech <SortIcon column="antimech" /></div>
              </th>
              <th className="text-center">Suits Destroyed</th>
              <th className="text-center">Suits Damaged</th>
              <th onClick={() => handleSort('bv')} className="text-right cursor-pointer hover:bg-muted/80 select-none">
                <div className="flex items-center justify-end">BV <SortIcon column="bv" /></div>
              </th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {!sortedElementals || sortedElementals.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted-foreground">
                  {force.elementals?.length === 0 
                    ? "No elementals in roster. Add elementals via Data Editor." 
                    : "No elementals match your filter."}
                </td>
              </tr>
            ) : (
              sortedElementals.map((elemental) => (
                <tr
                  key={elemental.id}
                  onClick={(e) => {
                    // Don't open dialog if clicking on suit counter buttons
                    if (!e.target.closest('button')) {
                      openDialog(elemental);
                    }
                  }}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      {elemental.image && (
                        <img
                          src={elemental.image}
                          alt={elemental.name}
                          className="max-h-10 max-w-10 rounded object-contain"
                        />
                      )}
                      <span className="font-medium">{elemental.name}</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={getStatusBadgeVariant(elemental.status)}>
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
                      <Badge
                        variant={getSuitStatusVariant(
                          elemental.suitsDestroyed,
                          elemental.suitsDamaged,
                        )}
                      >
                        {elemental.suitsDestroyed}/5
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateCounter(elemental.id, 'suitsDestroyed', 1)}
                        disabled={elemental.suitsDestroyed === 5}
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
                      <Badge
                        variant={getSuitStatusVariant(
                          elemental.suitsDestroyed,
                          elemental.suitsDamaged,
                        )}
                      >
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

      {/* Add/Edit Elemental Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingElemental ? 'Edit Elemental Point' : 'Add New Elemental Point'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Point Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Elemental Point Alpha"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Commander</label>
                <Input
                  value={formData.commander}
                  onChange={(e) => setFormData({ ...formData, commander: e.target.value })}
                  placeholder="e.g., Star Captain Elena"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Gunnery</label>
                <Input
                  type="number"
                  value={formData.gunnery}
                  onChange={(e) => setFormData({ ...formData, gunnery: e.target.value })}
                  placeholder="3"
                  min="0"
                  max="8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Antimech</label>
                <Input
                  type="number"
                  value={formData.antimech}
                  onChange={(e) => setFormData({ ...formData, antimech: e.target.value })}
                  placeholder="4"
                  min="0"
                  max="8"
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
                  Cost in WP to acquire this elemental point. This will be subtracted from the current
                  Warchest.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">BV (Battle Value) *</label>
                <Input
                  type="number"
                  value={formData.bv}
                  onChange={(e) => setFormData({ ...formData, bv: e.target.value })}
                  placeholder="485"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium mb-2">Image URL (optional)</label>
                <Input
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">History</label>
              <Textarea
                value={formData.history}
                onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                placeholder="Point history, notable engagements, bloodnames..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name || !formData.bv}>
                {editingElemental ? 'Update Elemental Point' : 'Add Elemental Point'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
