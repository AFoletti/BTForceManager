import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Minus, Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatNumber } from '../lib/utils';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';

export default function ElementalRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingElemental, setEditingElemental] = useState(null);
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
  const [nameFilter, setNameFilter] = useState('');
  const [sortBy, setSortBy] = useState(null); // null = JSON order
  const [sortDirection, setSortDirection] = useState('asc');

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

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedElementals = React.useMemo(() => {
    const filtered = (force.elementals || []).filter((elemental) =>
      elemental.name.toLowerCase().includes(nameFilter.toLowerCase()),
    );

    if (!sortBy) return filtered; // Default JSON order

    const STATUS_ORDER = {
      [UNIT_STATUS.OPERATIONAL]: 1,
      [UNIT_STATUS.DAMAGED]: 2,
      [UNIT_STATUS.REPAIRING]: 3,
      [UNIT_STATUS.DISABLED]: 4,
      [UNIT_STATUS.UNAVAILABLE]: 5,
      [UNIT_STATUS.DESTROYED]: 6,
    };

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
      }

      if (sortBy === 'status') {
        const aVal = STATUS_ORDER[a.status] || 999;
        const bVal = STATUS_ORDER[b.status] || 999;
        if (aVal === bVal) return 0;
        return aVal < bVal ? -1 * dir : 1 * dir;
      }

      if (sortBy === 'bv') {
        const aVal = a.bv || 0;
        const bVal = b.bv || 0;
        if (aVal === bVal) return 0;
        return aVal < bVal ? -1 * dir : 1 * dir;
      }

      return 0;
    });

    return sorted;
  }, [force.elementals, nameFilter, sortBy, sortDirection]);

  return (
    <div className="tactical-panel">
      <div className="tactical-header">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Elemental Roster
          </h3>
          <div className="flex items-center gap-2">
            <Input
              data-testid="elemental-name-filter"
              className="h-8 w-40"
              placeholder="Filter by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {filteredAndSortedElementals.length}/{force.elementals?.length || 0} Points
            </span>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="w-4 h-4" />
              Add Elemental
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
                  data-testid="elemental-sort-name"
                  className="flex items-center gap-1"
                  onClick={() => handleSortChange('name')}
                >
                  Point
                  {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  data-testid="elemental-sort-status"
                  className="flex items-center gap-1"
                  onClick={() => handleSortChange('status')}
                >
                  Status
                  {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>Commander</th>
              <th className="text-center">Gunnery</th>
              <th className="text-center">Antimech</th>
              <th className="text-center">Suits Destroyed</th>
              <th className="text-center">Suits Damaged</th>
              <th className="text-right">
                <button
                  type="button"
                  data-testid="elemental-sort-bv"
                  className="flex items-center gap-1 ml-auto"
                  onClick={() => handleSortChange('bv')}
                >
                  BV
                  {sortBy === 'bv' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {!force.elementals || filteredAndSortedElementals.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted-foreground">
                  No elementals match the current filters.
                </td>
              </tr>
            ) : (
              filteredAndSortedElementals.map((elemental) => (
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
