import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Minus, Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatNumber } from '../lib/utils';

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
    status: 'Operational',
    image: '',
    history: ''
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
        status: elemental.status,
        image: elemental.image || '',
        history: elemental.history || ''
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
        status: 'Operational',
        image: '',
        history: ''
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
      const updatedElementals = (force.elementals || []).map(e => 
        e.id === editingElemental.id 
          ? {
              ...e,
              name: formData.name,
              commander: formData.commander,
              gunnery: parseInt(formData.gunnery) || 3,
              antimech: parseInt(formData.antimech) || 4,
              suitsDestroyed: parseInt(formData.suitsDestroyed) || 0,
              suitsDamaged: parseInt(formData.suitsDamaged) || 0,
              bv: parseInt(formData.bv) || 0,
              status: formData.status,
              image: formData.image,
              history: formData.history
            }
          : e
      );
      onUpdate({ elementals: updatedElementals });
    } else {
      // Add new elemental
      const newElemental = {
        id: `elemental-${Date.now()}`,
        name: formData.name,
        commander: formData.commander,
        gunnery: parseInt(formData.gunnery) || 3,
        antimech: parseInt(formData.antimech) || 4,
        suitsDestroyed: 0,
        suitsDamaged: 0,
        bv: parseInt(formData.bv) || 0,
        status: formData.status,
        image: formData.image,
        history: formData.history,
        activityLog: []
      };

      const updatedElementals = [...(force.elementals || []), newElemental];
      onUpdate({ elementals: updatedElementals });
    }

    setShowDialog(false);
  };
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

      {/* Add/Edit Elemental Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingElemental ? 'Edit Elemental Point' : 'Add New Elemental Point'}</DialogTitle>
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
                <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="Operational">Operational</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Repairing">Repairing</option>
                  <option value="Unavailable">Unavailable</option>
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
                Add Elemental Point
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
