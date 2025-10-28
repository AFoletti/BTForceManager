import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Shield, Plus } from 'lucide-react';
import { formatNumber } from '../lib/utils';

export default function MechRoster({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMech, setEditingMech] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    status: 'Operational',
    pilot: '',
    bv: 0,
    weight: 0,
    image: '',
    history: ''
  });

  const openDialog = (mech = null) => {
    if (mech) {
      setEditingMech(mech);
      setFormData({
        name: mech.name,
        status: mech.status,
        pilot: mech.pilot || '',
        bv: mech.bv,
        weight: mech.weight,
        image: mech.image || '',
        history: mech.history || ''
      });
    } else {
      setEditingMech(null);
      setFormData({
        name: '',
        status: 'Operational',
        pilot: '',
        bv: 0,
        weight: 0,
        image: '',
        history: ''
      });
    }
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.bv || !formData.weight) {
      alert('Name, BV, and Weight are required');
      return;
    }

    if (editingMech) {
      // Update existing mech
      const updatedMechs = force.mechs.map(m => 
        m.id === editingMech.id 
          ? {
              ...m,
              name: formData.name,
              status: formData.status,
              pilot: formData.pilot,
              bv: parseInt(formData.bv) || 0,
              weight: parseInt(formData.weight) || 0,
              image: formData.image,
              history: formData.history
            }
          : m
      );
      onUpdate({ mechs: updatedMechs });
    } else {
      // Add new mech
      const newMech = {
        id: `mech-${Date.now()}`,
        name: formData.name,
        status: formData.status,
        pilot: formData.pilot,
        bv: parseInt(formData.bv) || 0,
        weight: parseInt(formData.weight) || 0,
        image: formData.image,
        history: formData.history,
        activityLog: []
      };

      const updatedMechs = [...force.mechs, newMech];
      onUpdate({ mechs: updatedMechs });
    }

    setShowDialog(false);
  };
  const getStatusColor = (status) => {
    const statusMap = {
      'Operational': 'operational',
      'Damaged': 'damaged',
      'Disabled': 'disabled',
      'Destroyed': 'destroyed',
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{force.mechs.length} Units</span>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4" />
              Add Mech
            </Button>
          </div>
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
                <tr 
                  key={mech.id}
                  onClick={() => openDialog(mech)}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
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
                <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  <option value="Operational">Operational</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Destroyed">Destroyed</option>
                  <option value="Repairing">Repairing</option>
                  <option value="Unavailable">Unavailable</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pilot</label>
                <Input
                  value={formData.pilot}
                  onChange={(e) => setFormData({ ...formData, pilot: e.target.value })}
                  placeholder="Pilot name"
                />
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
              <Button onClick={handleSave} disabled={!formData.name || !formData.bv || !formData.weight}>
                {editingMech ? 'Update Mech' : 'Add Mech'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
