import React, { useState } from 'react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Wrench, AlertTriangle } from 'lucide-react';
import { evaluateFormula } from '../lib/utils';
import { Badge } from './ui/badge';

export default function RepairBay({ force, onUpdate }) {
  const [selectedMechId, setSelectedMechId] = useState('');
  const [selectedActionId, setSelectedActionId] = useState('');

  const selectedMech = force.mechs.find(m => m.id === selectedMechId);
  const selectedAction = force.repairActions?.find(a => a.id === selectedActionId);
  
  const repairCost = selectedMech && selectedAction 
    ? evaluateFormula(selectedAction.formula, selectedMech.weight)
    : 0;

  const canAffordRepair = repairCost <= force.currentWarchest;

  const performRepair = () => {
    if (!selectedMech || !selectedAction || !canAffordRepair) return;

    const timestamp = new Date().toISOString();
    const lastMission = force.missions?.[force.missions.length - 1];
    
    // Update mech
    const updatedMechs = force.mechs.map(mech => {
      if (mech.id === selectedMechId) {
        const activityLog = [...(mech.activityLog || [])];
        activityLog.push({
          timestamp,
          action: `${selectedAction.name} performed (${repairCost} WP)`,
          mission: lastMission?.name || null
        });
        
        return {
          ...mech,
          status: selectedAction.makesUnavailable ? 'Unavailable' : mech.status,
          activityLog
        };
      }
      return mech;
    });

    // Deduct warchest
    const newWarchest = force.currentWarchest - repairCost;

    onUpdate({ mechs: updatedMechs, currentWarchest: newWarchest });
    setSelectedMechId('');
    setSelectedActionId('');
  };

  return (
    <div className="space-y-6">
      <div className="tactical-panel">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Repair Bay
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Mech</label>
              <Select value={selectedMechId} onChange={(e) => setSelectedMechId(e.target.value)}>
                <option value="">-- Choose a mech --</option>
                {force.mechs.map(mech => (
                  <option key={mech.id} value={mech.id}>
                    {mech.name} ({mech.weight}t) - {mech.status}
                  </option>
                ))}
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Select Repair Action</label>
              <Select 
                value={selectedActionId} 
                onChange={(e) => setSelectedActionId(e.target.value)}
                disabled={!selectedMechId}
              >
                <option value="">-- Choose action --</option>
                {(force.repairActions || []).map(action => (
                  <option key={action.id} value={action.id}>
                    {action.name} {action.makesUnavailable ? '(Makes Unavailable)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {selectedMech && selectedAction && (
            <div className="border border-border rounded-lg p-4 bg-muted/20">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Mech</div>
                  <div className="font-semibold">{selectedMech.name}</div>
                  <div className="text-sm">Weight: {selectedMech.weight} tons</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Action</div>
                  <div className="font-semibold">{selectedAction.name}</div>
                  <div className="text-sm font-mono">Formula: {selectedAction.formula}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <div className="text-2xl font-bold font-mono text-primary">{repairCost} WP</div>
                  <div className="text-xs text-muted-foreground">
                    Available: {force.currentWarchest} WP
                  </div>
                </div>
                
                {selectedAction.makesUnavailable && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Mech will be unavailable
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={performRepair}
              disabled={!selectedMech || !selectedAction || !canAffordRepair}
              size="lg"
            >
              Perform Repair ({repairCost} WP)
            </Button>
          </div>
          
          {!canAffordRepair && selectedAction && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Insufficient warchest points
            </div>
          )}
        </div>
      </div>

      {/* Repair Actions Reference */}
      <div className="tactical-panel">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Available Repair Actions</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Formula</th>
                <th>Effects</th>
              </tr>
            </thead>
            <tbody>
              {(!force.repairActions || force.repairActions.length === 0) ? (
                <tr>
                  <td colSpan="3" className="text-center py-8 text-muted-foreground">
                    No repair actions configured. Add them via Data Editor.
                  </td>
                </tr>
              ) : (
                force.repairActions.map(action => (
                  <tr key={action.id}>
                    <td className="font-medium">{action.name}</td>
                    <td className="font-mono text-sm">{action.formula}</td>
                    <td>
                      {action.makesUnavailable ? (
                        <Badge variant="damaged">Makes Unavailable</Badge>
                      ) : (
                        <Badge variant="operational">Available After</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
