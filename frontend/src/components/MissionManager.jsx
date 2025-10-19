import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Target, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatDate } from '../lib/utils';

export default function MissionManager({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    cost: 0,
    description: '',
    objectives: '',
    recap: '',
    warchestGained: 0,
    completed: false,
    assignedMechs: []
  });

  const openDialog = (mission = null) => {
    if (mission) {
      setEditingMission(mission);
      setFormData(mission);
    } else {
      setEditingMission(null);
      setFormData({
        name: '',
        cost: 0,
        description: '',
        objectives: '',
        recap: '',
        warchestGained: 0,
        completed: false
      });
    }
    setShowDialog(true);
  };

  const saveMission = () => {
    const missions = [...(force.missions || [])];
    const timestamp = new Date().toISOString();
    
    if (editingMission) {
      const index = missions.findIndex(m => m.id === editingMission.id);
      missions[index] = { ...formData, id: editingMission.id, updatedAt: timestamp };
    } else {
      const newMission = {
        ...formData,
        id: `mission-${Date.now()}`,
        createdAt: timestamp
      };
      missions.push(newMission);
      
      // Deduct mission cost
      const newWarchest = force.currentWarchest - formData.cost;
      onUpdate({ missions, currentWarchest: newWarchest });
      setShowDialog(false);
      return;
    }
    
    onUpdate({ missions });
    setShowDialog(false);
  };

  const completeMission = (missionId) => {
    const missions = force.missions.map(m => {
      if (m.id === missionId && !m.completed) {
        return { ...m, completed: true, completedAt: new Date().toISOString() };
      }
      return m;
    });
    
    const mission = force.missions.find(m => m.id === missionId);
    const newWarchest = force.currentWarchest + (mission?.warchestGained || 0);
    
    onUpdate({ missions, currentWarchest: newWarchest });
  };

  return (
    <div className="space-y-4">
      <div className="tactical-panel">
        <div className="tactical-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4" />
              Mission Log
            </h3>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="w-4 h-4" />
              New Mission
            </Button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {!force.missions || force.missions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No missions yet. Create your first mission to get started.</p>
            </div>
          ) : (
            force.missions.map(mission => (
              <div key={mission.id} className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg">{mission.name}</h4>
                      {mission.completed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium uppercase">
                          <AlertCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{mission.description}</p>
                    {mission.objectives && (
                      <div className="text-sm">
                        <span className="font-medium">Objectives:</span>
                        <p className="text-muted-foreground">{mission.objectives}</p>
                      </div>
                    )}
                    {mission.recap && (
                      <div className="text-sm mt-2 p-3 bg-background/50 rounded">
                        <span className="font-medium">Mission Recap:</span>
                        <p className="text-muted-foreground mt-1">{mission.recap}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex gap-4 text-sm">
                    <span>
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="ml-1 font-mono text-destructive">-{mission.cost} WP</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Gained:</span>
                      <span className="ml-1 font-mono text-green-400">+{mission.warchestGained} WP</span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(mission.createdAt)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog(mission)}>
                      Edit
                    </Button>
                    {!mission.completed && (
                      <Button size="sm" onClick={() => completeMission(mission.id)}>
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)}>
          <DialogHeader>
            <DialogTitle>{editingMission ? 'Edit Mission' : 'Create New Mission'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mission Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Assault on Highland Base"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Warchest Cost</label>
                <Input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Warchest Gained</label>
                <Input
                  type="number"
                  value={formData.warchestGained}
                  onChange={(e) => setFormData({ ...formData, warchestGained: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief mission description..."
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Objectives</label>
              <Textarea
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                placeholder="List mission objectives..."
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Mission Recap (after completion)</label>
              <Textarea
                value={formData.recap}
                onChange={(e) => setFormData({ ...formData, recap: e.target.value })}
                placeholder="What happened during the mission..."
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveMission} disabled={!formData.name}>
                {editingMission ? 'Update Mission' : 'Create Mission'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
