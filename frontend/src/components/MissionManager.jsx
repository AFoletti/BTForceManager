import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Target, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatDate, formatNumber } from '../lib/utils';
import {
  calculateMissionTotalBV,
  getAssignedMechs,
  getAssignedElementals,
  applyMissionCreation,
  applyMissionUpdate,
  applyMissionCompletion,
} from '../lib/missions';
import { findPilotForMech } from '../lib/mechs';

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
    assignedMechs: [],
    assignedElementals: [],
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
        completed: false,
        assignedMechs: [],
        assignedElementals: [],
      });
    }
    setShowDialog(true);
  };

  const toggleMechAssignment = (mechId) => {
    setFormData((prev) => ({
      ...prev,
      assignedMechs: prev.assignedMechs.includes(mechId)
        ? prev.assignedMechs.filter((id) => id !== mechId)
        : [...prev.assignedMechs, mechId],
    }));
  };

  const toggleElementalAssignment = (elementalId) => {
    setFormData((prev) => ({
      ...prev,
      assignedElementals: prev.assignedElementals.includes(elementalId)
        ? prev.assignedElementals.filter((id) => id !== elementalId)
        : [...prev.assignedElementals, elementalId],
    }));
  };

  const saveMission = () => {
    const timestamp = new Date().toISOString();

    if (editingMission) {
      const missions = applyMissionUpdate(
        force.missions || [],
        editingMission.id,
        formData,
        timestamp,
      );
      onUpdate({ missions });
      setShowDialog(false);
      return;
    }

    const result = applyMissionCreation(force, formData, timestamp);
    onUpdate(result);
    setShowDialog(false);
  };

  const handleCompleteMission = (missionId) => {
    const result = applyMissionCompletion(force, missionId);
    onUpdate(result);
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
            force.missions.map((mission) => (
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

                    {/* Assigned Mechs */}
                    {mission.assignedMechs && mission.assignedMechs.length > 0 && (
                      <div className="mt-3 p-3 bg-background/50 rounded border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">Assigned Force</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Total BV:</span>
                            <span className="ml-2 font-mono font-bold text-primary">
                              {formatNumber(
                                calculateMissionTotalBV(
                                  force,
                                  mission.assignedMechs,
                                  mission.assignedElementals || [],
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {mission.assignedMechs.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Mechs:</div>
                              <div className="flex flex-wrap gap-2">
                                {getAssignedMechs(force, mission.assignedMechs).map((mech) => (
                                  <Badge key={mech.id} variant="secondary" className="text-xs">
                                    {mech.name} ({formatNumber(mech.bv)} BV)
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {mission.assignedElementals && mission.assignedElementals.length > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Elementals:</div>
                              <div className="flex flex-wrap gap-2">
                                {getAssignedElementals(force, mission.assignedElementals).map(
                                  (elemental) => (
                                    <Badge key={elemental.id} variant="secondary" className="text-xs">
                                      {elemental.name} ({formatNumber(elemental.bv)} BV)
                                    </Badge>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
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
                      <Button size="sm" onClick={() => handleCompleteMission(mission.id)}>
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Warchest Gained</label>
                <Input
                  type="number"
                  value={formData.warchestGained}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      warchestGained: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            {/* Mech Assignment */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center justify-between">
                  <span>Assign Mechs to Mission</span>
                  <span className="text-xs text-primary font-mono">
                    BV:{' '}
                    {formatNumber(
                      calculateMissionTotalBV(force, formData.assignedMechs, []),
                    )}
                  </span>
                </div>
              </label>
              <div className="border border-border rounded p-3 bg-muted/20 max-h-48 overflow-y-auto">
                {force.mechs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No mechs available</p>
                ) : (
                  <div className="space-y-2">
                    {force.mechs.map((mech) => {
                      const pilot = findPilotForMech(force, mech);

                      return (
                        <label
                          key={mech.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.assignedMechs.includes(mech.id)}
                            onChange={() => toggleMechAssignment(mech.id)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{mech.name}</span>
                              <div className="text-xs text-muted-foreground">
                                {!pilot
                                  ? 'Pilot: Missing Pilot'
                                  : pilot.injuries === 6
                                    ? `Pilot: ${pilot.name} - KIA`
                                    : `Pilot: ${pilot.name} - G:${pilot.gunnery} / P:${pilot.piloting}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  mech.status === 'Operational' ? 'operational' : 'outline'
                                }
                                className="text-xs"
                              >
                                {mech.status}
                              </Badge>
                              <span className="text-xs font-mono text-muted-foreground">
                                {formatNumber(mech.bv)} BV
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {formData.assignedMechs.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {formData.assignedMechs.length} mech
                  {formData.assignedMechs.length !== 1 ? 's' : ''} assigned
                </div>
              )}
            </div>

            {/* Elemental Assignment */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center justify-between">
                  <span>Assign Elementals to Mission</span>
                  <span className="text-xs text-primary font-mono">
                    BV:{' '}
                    {formatNumber(
                      calculateMissionTotalBV(force, [], formData.assignedElementals),
                    )}
                  </span>
                </div>
              </label>
              <div className="border border-border rounded p-3 bg-muted/20 max-h-48 overflow-y-auto">
                {!force.elementals || force.elementals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No elementals available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {force.elementals.map((elemental) => (
                      <label
                        key={elemental.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedElementals.includes(elemental.id)}
                          onChange={() => toggleElementalAssignment(elemental.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{elemental.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({elemental.commander || 'Unassigned'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                elemental.status === 'Operational'
                                  ? 'operational'
                                  : 'outline'
                              }
                              className="text-xs"
                            >
                              {elemental.status}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">
                              {formatNumber(elemental.bv)} BV
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {formData.assignedElementals.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {formData.assignedElementals.length} elemental point
                  {formData.assignedElementals.length !== 1 ? 's' : ''} assigned
                </div>
              )}
            </div>

            {/* Total BV Display */}
            {(formData.assignedMechs.length > 0 ||
              formData.assignedElementals.length > 0) && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Combined Force Total BV:</span>
                  <span className="text-2xl font-bold font-mono text-primary">
                    {formatNumber(
                      calculateMissionTotalBV(
                        force,
                        formData.assignedMechs,
                        formData.assignedElementals,
                      ),
                    )}
                  </span>
                </div>
              </div>
            )}

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
              <label className="block text-sm font-medium mb-2">
                Mission Recap (after completion)
              </label>
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
