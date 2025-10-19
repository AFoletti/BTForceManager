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
  const [formData, setFormData] = useState({
    name: '',
    status: 'Operational',
    pilot: '',
    bv: 0,
    weight: 0,
    image: '',
    history: ''
  });

  const handleSave = () => {
    if (!formData.name || !formData.bv || !formData.weight) {
      alert('Name, BV, and Weight are required');
      return;
    }

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

    // Reset form
    setFormData({
      name: '',
      status: 'Operational',
      pilot: '',
      bv: 0,
      weight: 0,
      image: '',
      history: ''
    });
    setShowDialog(false);
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
                <tr key={mech.id}>
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
    </div>
  );
}
