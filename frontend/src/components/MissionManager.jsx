import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Target, CheckCircle2, AlertCircle, Shield, X, Trophy } from 'lucide-react';
import { Badge } from './ui/badge';
import { Select } from './ui/select';
import { formatDate, formatNumber } from '../lib/utils';
import {
  calculateMissionTotalBV,
  calculateMissionTotalTonnage,
  getAssignedMechs,
  getAssignedElementals,
  applyMissionCreation,
  applyMissionUpdate,
  applyMissionCompletion,
  isMechAvailableForMission,
  isElementalAvailableForMission,
  getMissionObjectiveReward,
} from '../lib/missions';
import { findPilotForMech, getMechAdjustedBV } from '../lib/mechs';
import { getPilotDisplayName } from '../lib/pilots';
import { getStatusBadgeVariant, UNIT_STATUS } from '../lib/constants';
import { createSnapshot, advanceDateString, createFullSnapshot, addFullSnapshot } from '../lib/snapshots';
import { checkAchievements, findNewAchievements, recordMissionCompletion, addKill, addAssists, createEmptyCombatRecord } from '../lib/achievements';
import MechAutocomplete from './MechAutocomplete';

const emptyMissionForm = {
  name: '',
  cost: 0,
  description: '',
  objectives: [],
  recap: '',
  completed: false,
  assignedMechs: [],
  assignedElementals: [],
  spBudget: 0,
  spPurchases: [],
  totalTonnage: 0,
};

export default function MissionManager({ force, onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [formData, setFormData] = useState(emptyMissionForm);
  const [spChoices, setSpChoices] = useState([]);

  // Load SP choices from JSON file
  useEffect(() => {
    fetch('./data/sp-choices.json')
      .then((res) => res.json())
      .then((data) => setSpChoices(data.spChoices || []))
      .catch(() => setSpChoices([]));
  }, []);

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [missionBeingCompleted, setMissionBeingCompleted] = useState(null);
  const [completionObjectives, setCompletionObjectives] = useState([]);
  const [completionRecap, setCompletionRecap] = useState('');
  const [postMissionUnitState, setPostMissionUnitState] = useState({
    mechs: {},
    elementals: {},
    pilots: {},
  });
  
  // Combat tracking state for kills and assists
  const [pilotCombatUpdates, setPilotCombatUpdates] = useState({});
  const [killSearchInput, setKillSearchInput] = useState({});
  
  // Achievements state
  const [achievementDefinitions, setAchievementDefinitions] = useState([]);
  const [showAchievementsPopup, setShowAchievementsPopup] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);

  // Load achievement definitions
  useEffect(() => {
    fetch('./data/achievements.json')
      .then((res) => res.json())
      .then((data) => setAchievementDefinitions(data.achievements || []))
      .catch(() => setAchievementDefinitions([]));
  }, []);

  const normaliseObjectives = (rawObjectives) => {
    if (Array.isArray(rawObjectives)) return rawObjectives;
    if (typeof rawObjectives === 'string' && rawObjectives.trim().length > 0) {
      return [
        {
          id: `obj-${Date.now()}`,
          title: 'Objectives',
          description: rawObjectives.trim(),
          wpReward: 0,
          achieved: false,
        },
      ];
    }
    return [];
  };

  const openDialog = (mission = null) => {
    if (mission) {
      setEditingMission(mission);
      setFormData({
        name: mission.name || '',
        cost: mission.cost || 0,
        description: mission.description || '',
        objectives: normaliseObjectives(mission.objectives),
        recap: mission.recap || '',
        completed: mission.completed || false,
        assignedMechs: mission.assignedMechs || [],
        assignedElementals: mission.assignedElementals || [],
        spBudget: mission.spBudget || 0,
        spPurchases: mission.spPurchases || [],
        totalTonnage: mission.totalTonnage || 0,
      });
    } else {
      setEditingMission(null);
      setFormData(emptyMissionForm);
    }
    setShowDialog(true);
  };

  // Calculate spent SP from purchases
  const spSpent = (formData.spPurchases || []).reduce((sum, p) => sum + (p.cost || 0), 0);
  const spRemaining = (formData.spBudget || 0) - spSpent;

  // Add SP purchase
  const addSpPurchase = (choiceId) => {
    const choice = spChoices.find((c) => c.id === choiceId);
    if (!choice || choice.cost > spRemaining) return;
    
    setFormData((prev) => ({
      ...prev,
      spPurchases: [
        ...(prev.spPurchases || []),
        { id: `sp-${Date.now()}`, choiceId: choice.id, name: choice.name, cost: choice.cost },
      ],
    }));
  };

  // Remove SP purchase
  const removeSpPurchase = (purchaseId) => {
    setFormData((prev) => ({
      ...prev,
      spPurchases: (prev.spPurchases || []).filter((p) => p.id !== purchaseId),
    }));
  };

  const toggleMechAssignment = (mechId) => {
    setFormData((prev) => {
      const newAssignedMechs = prev.assignedMechs.includes(mechId)
        ? prev.assignedMechs.filter((id) => id !== mechId)
        : [...prev.assignedMechs, mechId];
      
      // Recalculate tonnage
      const totalTonnage = calculateMissionTotalTonnage(force, newAssignedMechs);
      
      return {
        ...prev,
        assignedMechs: newAssignedMechs,
        totalTonnage,
      };
    });
  };

  const toggleElementalAssignment = (elementalId) => {
    setFormData((prev) => ({
      ...prev,
      assignedElementals: prev.assignedElementals.includes(elementalId)
        ? prev.assignedElementals.filter((id) => id !== elementalId)
        : [...prev.assignedElementals, elementalId],
    }));
  };

  const updateObjectiveField = (index, field, value) => {
    setFormData((prev) => {
      const objectives = [...(prev.objectives || [])];
      const target = objectives[index] || {
        id: `obj-${Date.now()}-${index}`,
        title: '',
        description: '',
        wpReward: 0,
        achieved: false,
      };
      const updated = {
        ...target,
        [field]: field === 'wpReward' ? Math.max(0, parseInt(value, 10) || 0) : value,
      };
      objectives[index] = updated;
      return { ...prev, objectives };
    });
  };

  const addObjective = () => {
    setFormData((prev) => ({
      ...prev,
      objectives: [
        ...(prev.objectives || []),
        {
          id: `obj-${Date.now()}-${(prev.objectives || []).length}`,
          title: '',
          description: '',
          wpReward: 0,
          achieved: false,
        },
      ],
    }));
  };

  const removeObjective = (index) => {
    setFormData((prev) => ({
      ...prev,
      objectives: (prev.objectives || []).filter((_, i) => i !== index),
    }));
  };

  const saveMission = () => {
    const timestamp = force.currentDate;

    const cleanObjectives = (formData.objectives || []).map((obj) => ({
      ...obj,
      wpReward:
        typeof obj.wpReward === 'number' && obj.wpReward > 0
          ? Math.floor(obj.wpReward)
          : 0,
      achieved: Boolean(obj.achieved),
    }));

    // Calculate current tonnage from assigned mechs
    const totalTonnage = calculateMissionTotalTonnage(force, formData.assignedMechs);

    const payload = {
      ...formData,
      objectives: cleanObjectives,
      spBudget: formData.spBudget || 0,
      spPurchases: formData.spPurchases || [],
      totalTonnage,
    };

    if (editingMission) {
      const missions = applyMissionUpdate(force.missions || [], editingMission.id, payload, timestamp);
      onUpdate({ missions });
      setShowDialog(false);
      return;
    }

    const result = applyMissionCreation(force, payload, timestamp);

    const existingSnapshots = Array.isArray(force.snapshots) ? force.snapshots : [];
    const existingFullSnapshots = Array.isArray(force.fullSnapshots) ? force.fullSnapshots : [];
    const nextDate = advanceDateString(force.currentDate);

    const nextForce = {
      ...force,
      mechs: result.mechs,
      pilots: result.pilots,
      elementals: result.elementals,
      missions: result.missions,
      currentWarchest: result.currentWarchest,
      currentDate: nextDate,
    };

    const snapshotLabel = `Prior to mission: ${payload.name || 'Unnamed mission'}`;
    const snapshot = createSnapshot(nextForce, {
      type: 'pre-mission',
      label: snapshotLabel,
    });

    // Build the complete force state including the new snapshot
    const nextSnapshots = [...existingSnapshots, snapshot];
    const forceForFullSnapshot = {
      ...nextForce,
      snapshots: nextSnapshots,
    };

    // Create full snapshot that includes the normal snapshot
    const fullSnapshot = createFullSnapshot(forceForFullSnapshot, snapshot.id);
    const nextFullSnapshots = addFullSnapshot(existingFullSnapshots, fullSnapshot);

    onUpdate({
      ...result,
      currentDate: nextDate,
      snapshots: nextSnapshots,
      fullSnapshots: nextFullSnapshots,
    });

    setShowDialog(false);
  };

  const openCompleteDialog = (mission) => {
    const objectives = normaliseObjectives(mission.objectives).map((obj) => ({
      ...obj,
      wpReward:
        typeof obj.wpReward === 'number' && obj.wpReward > 0
          ? Math.floor(obj.wpReward)
          : 0,
      achieved: Boolean(obj.achieved),
    }));

    // Build initial post-mission state for deployed units:
    // - Mechs assigned to the mission
    // - Elementals assigned to the mission
    // - Pilots piloting assigned mechs
    const assignedMechs = getAssignedMechs(force, mission.assignedMechs || []);
    const assignedElementals = getAssignedElementals(force, mission.assignedElementals || []);

    const mechState = {};
    assignedMechs.forEach((mech) => {
      mechState[mech.id] = {
        status: mech.status || UNIT_STATUS.OPERATIONAL,
      };
    });

    const elementalState = {};
    assignedElementals.forEach((elemental) => {
      elementalState[elemental.id] = {
        status: elemental.status || UNIT_STATUS.OPERATIONAL,
        suitsDamaged:
          typeof elemental.suitsDamaged === 'number' && elemental.suitsDamaged >= 0
            ? elemental.suitsDamaged
            : 0,
        suitsDestroyed:
          typeof elemental.suitsDestroyed === 'number' && elemental.suitsDestroyed >= 0
            ? elemental.suitsDestroyed
            : 0,
      };
    });

    const pilotState = {};
    const combatUpdates = {};
    assignedMechs.forEach((mech) => {
      const pilot = findPilotForMech(force, mech);
      if (pilot) {
        pilotState[pilot.id] = {
          injuries:
            typeof pilot.injuries === 'number' && pilot.injuries >= 0 ? pilot.injuries : 0,
        };
        // Initialize combat updates for this pilot
        combatUpdates[pilot.id] = {
          kills: [],
          assists: 0,
        };
      }
    });

    setPostMissionUnitState({
      mechs: mechState,
      elementals: elementalState,
      pilots: pilotState,
    });
    
    // Reset combat tracking state
    setPilotCombatUpdates(combatUpdates);
    setKillSearchInput({});
    setNewAchievements([]);

    setMissionBeingCompleted(mission);
    setCompletionObjectives(objectives);
    setCompletionRecap(mission.recap || '');
    setShowCompleteDialog(true);
  };

  const toggleCompletionObjective = (index) => {
    setCompletionObjectives((prev) =>
      prev.map((obj, i) => (i === index ? { ...obj, achieved: !obj.achieved } : obj)),
    );
  };

  // Add a kill to a pilot's combat updates
  const addPilotKill = (pilotId, mechData) => {
    const missionName = missionBeingCompleted?.name || 'Mission';
    const missionDate = force.currentDate;
    
    setPilotCombatUpdates((prev) => ({
      ...prev,
      [pilotId]: {
        ...prev[pilotId],
        kills: [
          ...(prev[pilotId]?.kills || []),
          {
            id: `kill-${Date.now()}`,
            mechModel: mechData.name,
            tonnage: mechData.weight || 0,
            mission: missionName,
            date: missionDate,
          },
        ],
      },
    }));
    // Clear search input for this pilot
    setKillSearchInput((prev) => ({ ...prev, [pilotId]: '' }));
  };

  // Remove a kill from a pilot's combat updates
  const removePilotKill = (pilotId, killId) => {
    setPilotCombatUpdates((prev) => ({
      ...prev,
      [pilotId]: {
        ...prev[pilotId],
        kills: (prev[pilotId]?.kills || []).filter((k) => k.id !== killId),
      },
    }));
  };

  // Update assists for a pilot
  const updatePilotAssists = (pilotId, delta) => {
    setPilotCombatUpdates((prev) => ({
      ...prev,
      [pilotId]: {
        ...prev[pilotId],
        assists: Math.max(0, (prev[pilotId]?.assists || 0) + delta),
      },
    }));
  };

  const confirmCompleteMission = () => {
    if (!missionBeingCompleted) return;
    const timestamp = force.currentDate;

    const updatedObjectives = completionObjectives.map((obj) => ({
      ...obj,
      wpReward:
        typeof obj.wpReward === 'number' && obj.wpReward > 0
          ? Math.floor(obj.wpReward)
          : 0,
      achieved: Boolean(obj.achieved),
    }));

    const completionData = {
      objectives: updatedObjectives,
      recap: completionRecap,
    };

    // Apply post-mission unit state edits to mechs, elementals and pilots
    const updatedMechs = force.mechs.map((mech) => {
      const edited = postMissionUnitState.mechs[mech.id];
      if (!edited) return mech;
      return {
        ...mech,
        status: edited.status,
      };
    });

    const updatedElementals = (force.elementals || []).map((elemental) => {
      const edited = postMissionUnitState.elementals[elemental.id];
      if (!edited) return elemental;
      return {
        ...elemental,
        status: edited.status,
        suitsDamaged: Number.isFinite(edited.suitsDamaged)
          ? Math.max(0, Math.min(6, edited.suitsDamaged))
          : 0,
        suitsDestroyed: Number.isFinite(edited.suitsDestroyed)
          ? Math.max(0, Math.min(6, edited.suitsDestroyed))
          : 0,
      };
    });

    // Update pilots with injuries AND combat records
    const allNewAchievements = [];
    const updatedPilots = (force.pilots || []).map((pilot) => {
      const editedState = postMissionUnitState.pilots[pilot.id];
      const combatUpdate = pilotCombatUpdates[pilot.id];
      
      if (!editedState && !combatUpdate) return pilot;
      
      // Get current injuries and check if pilot was injured this mission
      const previousInjuries = pilot.injuries || 0;
      const newInjuries = editedState 
        ? (Number.isFinite(editedState.injuries) ? Math.max(0, Math.min(6, editedState.injuries)) : 0)
        : previousInjuries;
      const wasInjured = newInjuries > previousInjuries;
      
      // Update combat record
      let combatRecord = pilot.combatRecord || createEmptyCombatRecord();
      
      // Only update if pilot participated (has state entry)
      if (editedState) {
        // Record mission completion
        combatRecord = recordMissionCompletion(combatRecord, wasInjured);
        
        // Add kills
        if (combatUpdate?.kills?.length > 0) {
          combatUpdate.kills.forEach((kill) => {
            combatRecord = addKill(combatRecord, {
              mechModel: kill.mechModel,
              tonnage: kill.tonnage,
              mission: kill.mission,
              date: kill.date,
            });
          });
        }
        
        // Add assists
        if (combatUpdate?.assists > 0) {
          combatRecord = addAssists(combatRecord, combatUpdate.assists);
        }
      }
      
      // Check for new achievements
      const previousAchievements = pilot.achievements || [];
      const currentAchievements = checkAchievements(combatRecord, achievementDefinitions);
      const earnedNew = findNewAchievements(previousAchievements, currentAchievements);
      
      if (earnedNew.length > 0) {
        allNewAchievements.push({
          pilotId: pilot.id,
          pilotName: pilot.name,
          achievements: earnedNew,
        });
      }
      
      return {
        ...pilot,
        injuries: newInjuries,
        combatRecord,
        achievements: currentAchievements,
      };
    });

    const forceAfterBattle = {
      ...force,
      mechs: updatedMechs,
      elementals: updatedElementals,
      pilots: updatedPilots,
    };

    const result = applyMissionCompletion(
      forceAfterBattle,
      missionBeingCompleted.id,
      completionData,
      timestamp,
    );

    const existingSnapshots = Array.isArray(force.snapshots) ? force.snapshots : [];
    const existingFullSnapshots = Array.isArray(force.fullSnapshots) ? force.fullSnapshots : [];
    const nextDate = advanceDateString(force.currentDate);

    // Build the next force state (post-mission) to generate a snapshot.
    const nextForce = {
      ...forceAfterBattle,
      missions: result.missions,
      currentWarchest: result.currentWarchest,
      currentDate: nextDate,
    };

    const snapshotLabel = `After ${missionBeingCompleted.name || 'mission'}`;
    const snapshot = createSnapshot(nextForce, {
      type: 'post-mission',
      label: snapshotLabel,
    });

    // Build the complete force state including the new snapshot
    const nextSnapshots = [...existingSnapshots, snapshot];
    const forceForFullSnapshot = {
      ...nextForce,
      snapshots: nextSnapshots,
    };

    // Create full snapshot that includes the normal snapshot
    const fullSnapshot = createFullSnapshot(forceForFullSnapshot, snapshot.id);
    const nextFullSnapshots = addFullSnapshot(existingFullSnapshots, fullSnapshot);

    onUpdate({
      ...result,
      mechs: updatedMechs,
      elementals: updatedElementals,
      pilots: updatedPilots,
      currentDate: nextDate,
      snapshots: nextSnapshots,
      fullSnapshots: nextFullSnapshots,
    });

    setShowCompleteDialog(false);
    setMissionBeingCompleted(null);
    
    // Show achievements popup if any new achievements were earned
    if (allNewAchievements.length > 0) {
      setNewAchievements(allNewAchievements);
      setShowAchievementsPopup(true);
    }
  };

  // Get achievement details by ID
  const getAchievementById = (achievementId) => {
    return achievementDefinitions.find((a) => a.id === achievementId) || { name: achievementId, icon: '🏆', description: '' };
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
            <Button size="sm" onClick={() => openDialog()} data-testid="new-mission-button">
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
            force.missions.map((mission) => {
              const reward = getMissionObjectiveReward(mission);

              return (
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

                      {Array.isArray(mission.objectives) && mission.objectives.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Objectives:</span>
                          <ul className="mt-1 space-y-1 text-muted-foreground">
                            {mission.objectives.map((obj) => (
                              <li key={obj.id} className="flex items-center gap-2 text-xs">
                                <span>{obj.achieved ? '☑' : '☐'}</span>
                                <span>
                                  {obj.title || 'Objective'}
                                  {obj.wpReward > 0 && (
                                    <span className="ml-1 text-emerald-400 font-mono">
                                      (+{formatNumber(obj.wpReward)} WP)
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
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
                            <div className="text-sm flex gap-4">
                              <span>
                                <span className="text-muted-foreground">Tonnage:</span>
                                <span className="ml-1 font-mono font-bold">
                                  {formatNumber(mission.totalTonnage || calculateMissionTotalTonnage(force, mission.assignedMechs))}t
                                </span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Total BV:</span>
                                <span className="ml-1 font-mono font-bold text-primary">
                                  {formatNumber(
                                    calculateMissionTotalBV(
                                      force,
                                      mission.assignedMechs,
                                      mission.assignedElementals || [],
                                    ),
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {mission.assignedMechs.length > 0 && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Mechs:</div>
                                <div className="flex flex-wrap gap-2">
                                  {getAssignedMechs(force, mission.assignedMechs).map((mech) => {
                                    const pilot = findPilotForMech(force, mech);
                                    return (
                                      <Badge key={mech.id} variant="secondary" className="text-xs">
                                        {mech.name}
                                        {pilot && pilot.dezgra ? ' (D)' : ''} ({formatNumber(getMechAdjustedBV(force, mech))} BV)
                                      </Badge>
                                    );
                                  })}
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

                      {/* SP Purchases */}
                      {mission.spPurchases && mission.spPurchases.length > 0 && (
                        <div className="mt-3 p-3 bg-background/50 rounded border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">Support Point Purchases</span>
                            <span className="text-xs text-muted-foreground">
                              Budget: {formatNumber(mission.spBudget || 0)} SP
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {mission.spPurchases.map((purchase) => (
                              <Badge key={purchase.id} variant="outline" className="text-xs">
                                {purchase.name} ({purchase.cost} SP)
                              </Badge>
                            ))}
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
                        <span className="ml-1 font-mono text-green-400">+{reward} WP</span>
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
                        <Button size="sm" onClick={() => openCompleteDialog(mission)}>
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mission create/edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClose={() => setShowDialog(false)} className="max-w-5xl">
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
                  min="6"
                  className={formData.cost <= 5 ? 'border-destructive' : ''}
                />
                {formData.cost <= 5 && (
                  <p className="text-xs text-destructive mt-1">
                    Cost must be greater than 5 WP
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Support Points Budget</label>
                <Input
                  type="number"
                  value={formData.spBudget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spBudget: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  placeholder="0"
                  min="0"
                  data-testid="sp-budget-input"
                />
              </div>
            </div>

            {/* SP Purchases Section */}
            {formData.spBudget > 0 && (
              <div className="border border-border rounded p-4 bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Support Point Purchases</label>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Remaining: </span>
                    <span className={`font-mono font-bold ${spRemaining < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {spRemaining} SP
                    </span>
                    <span className="text-muted-foreground ml-2">/ {formData.spBudget} SP</span>
                  </div>
                </div>

                {/* Add SP Purchase Dropdown */}
                <div className="flex gap-2 mb-3">
                  <Select
                    className="flex-1"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addSpPurchase(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    data-testid="sp-choice-select"
                  >
                    <option value="">Select support to purchase...</option>
                    {spChoices.map((choice) => {
                      const canAfford = choice.cost <= spRemaining;
                      return (
                        <option 
                          key={choice.id} 
                          value={choice.id}
                          disabled={!canAfford}
                        >
                          {choice.name} ({choice.cost} SP){!canAfford ? ' - Insufficient SP' : ''}
                        </option>
                      );
                    })}
                  </Select>
                </div>

                {/* Purchased Items */}
                {formData.spPurchases && formData.spPurchases.length > 0 ? (
                  <div className="space-y-2">
                    {formData.spPurchases.map((purchase) => (
                      <div 
                        key={purchase.id} 
                        className="flex items-center justify-between p-2 bg-background rounded border border-border"
                      >
                        <span className="text-sm">{purchase.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{purchase.cost} SP</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => removeSpPurchase(purchase.id)}
                            data-testid={`remove-sp-${purchase.id}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No support points purchased yet
                  </p>
                )}
              </div>
            )}

            {/* Force Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mech Assignment */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center justify-between">
                    <span>Assign Mechs to Mission</span>
                    <div className="flex gap-3">
                      <span className="text-xs font-mono">
                        Tonnage: {formatNumber(formData.totalTonnage || 0)}t
                      </span>
                      <span className="text-xs text-primary font-mono">
                        BV: {formatNumber(calculateMissionTotalBV(force, formData.assignedMechs, []))}
                      </span>
                    </div>
                  </div>
                </label>
                <div className="border border-border rounded p-3 bg-muted/20 max-h-60 overflow-y-auto">
                  {force.mechs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No mechs available
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {force.mechs.map((mech) => {
                        if (mech.status === 'Destroyed') {
                          return null;
                        }

                        const pilot = findPilotForMech(force, mech);
                        const isSelectable = isMechAvailableForMission(force, mech);

                        return (
                          <label
                            key={mech.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            {isSelectable ? (
                              <input
                                type="checkbox"
                                checked={formData.assignedMechs.includes(mech.id)}
                                onChange={() => toggleMechAssignment(mech.id)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                data-testid={`mission-mech-checkbox-${mech.id}`}
                              />
                            ) : (
                              <div className="w-4 h-4" aria-hidden="true" />
                            )}
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium">{mech.name}</span>
                                <div className="text-xs text-muted-foreground">
                                  {!pilot
                                    ? 'Pilot: Missing Pilot'
                                    : pilot.injuries === 6
                                      ? `Pilot: ${getPilotDisplayName(pilot)} - KIA`
                                      : `Pilot: ${getPilotDisplayName(pilot)} - G:${pilot.gunnery} / P:${pilot.piloting}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={getStatusBadgeVariant(mech.status)}
                                  className="text-xs"
                                >
                                  {mech.status}
                                </Badge>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {formatNumber(getMechAdjustedBV(force, mech))} BV
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
                <div className="border border-border rounded p-3 bg-muted/20 max-h-60 overflow-y-auto">
                  {!force.elementals || force.elementals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No elementals available
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {force.elementals.map((elemental) => {
                        if (!isElementalAvailableForMission(elemental)) {
                          return null;
                        }

                        const isSelectable = isElementalAvailableForMission(elemental);

                        return (
                          <label
                            key={elemental.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            {isSelectable ? (
                              <input
                                type="checkbox"
                                checked={formData.assignedElementals.includes(elemental.id)}
                                onChange={() => toggleElementalAssignment(elemental.id)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                data-testid={`mission-elemental-checkbox-${elemental.id}`}
                              />
                            ) : (
                              <div className="w-4 h-4" aria-hidden="true" />
                            )}
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium">{elemental.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({elemental.commander || 'Unassigned'})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={getStatusBadgeVariant(elemental.status)}
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
                        );
                      })}
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
            </div>

            {/* Total BV Display */}
            {(formData.assignedMechs.length > 0 ||
              formData.assignedElementals.length > 0) && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Combined Force:</span>
                    <span className="ml-4 text-sm text-muted-foreground">
                      Tonnage: <span className="font-mono font-bold">{formatNumber(formData.totalTonnage || 0)}t</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Total BV:</span>
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

            {/* Structured objectives */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Objectives</label>
                <Button size="xs" variant="outline" onClick={addObjective}>
                  Add Objective
                </Button>
              </div>

              {(formData.objectives || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No objectives yet. Add at least one to define how this mission awards Warchest
                  points when completed.
                </p>
              ) : (
                <div className="space-y-3">
                  {formData.objectives.map((obj, index) => (
                    <div
                      key={obj.id || `obj-${index}`}
                      className="border border-border rounded p-3 bg-muted/10 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          value={obj.title || ''}
                          onChange={(e) => updateObjectiveField(index, 'title', e.target.value)}
                          placeholder="Objective title (e.g., Hold Kozice bridges)"
                        />
                        <Input
                          type="number"
                          className="w-24"
                          value={obj.wpReward || 0}
                          onChange={(e) => updateObjectiveField(index, 'wpReward', e.target.value)}
                          min={0}
                        />
                        <span className="text-xs text-muted-foreground">WP</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => removeObjective(index)}
                        >
                          ×
                        </Button>
                      </div>
                      <Textarea
                        value={obj.description || ''}
                        onChange={(e) =>
                          updateObjectiveField(index, 'description', e.target.value)
                        }
                        placeholder="Optional details for this objective..."
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveMission} 
                disabled={!formData.name || formData.cost <= 5} 
                data-testid="mission-save-button"
              >
                {editingMission ? 'Update Mission' : 'Create Mission'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mission completion dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent onClose={() => setShowCompleteDialog(false)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Complete Mission{missionBeingCompleted ? `: ${missionBeingCompleted.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          {missionBeingCompleted && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Review Objectives</label>
                {completionObjectives.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This mission has no structured objectives. You can still complete it, but no
                    Warchest reward will be granted.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {completionObjectives.map((obj, index) => (
                      <label
                        key={obj.id}
                        className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={obj.achieved}
                          onChange={() => toggleCompletionObjective(index)}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{obj.title || 'Objective'}</span>
                            {obj.wpReward > 0 && (
                              <span className="text-xs font-mono text-emerald-400">
                                +{formatNumber(obj.wpReward)} WP
                              </span>
                            )}
                          </div>
                          {obj.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {obj.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">After Action Report</label>
                <Textarea
                  value={completionRecap}
                  onChange={(e) => setCompletionRecap(e.target.value)}
                  placeholder="What happened during the mission..."
                  rows={4}
                />
              </div>

              {/* Post-mission unit outcomes */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Post-mission outcomes</h4>

                {/* Deployed Mechs */}
                {missionBeingCompleted.assignedMechs &&
                  missionBeingCompleted.assignedMechs.length > 0 && (
                    <div className="border border-border rounded p-3 bg-muted/10">
                      <div className="text-xs font-semibold mb-2">Mechs</div>
                      <div className="space-y-1">
                        {getAssignedMechs(force, missionBeingCompleted.assignedMechs).map(
                          (mech) => {
                            const state = postMissionUnitState.mechs[mech.id];
                            if (!state) return null;
                            return (
                              <div
                                key={mech.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="font-medium">{mech.name}</span>
                                <select
                                  className="border border-border rounded px-1 py-0.5 bg-background text-xs"
                                  value={state.status}
                                  onChange={(e) =>
                                    setPostMissionUnitState((prev) => ({
                                      ...prev,
                                      mechs: {
                                        ...prev.mechs,
                                        [mech.id]: {
                                          ...prev.mechs[mech.id],
                                          status: e.target.value,
                                        },
                                      },
                                    }))
                                  }
                                >
                                  {[UNIT_STATUS.OPERATIONAL, UNIT_STATUS.DAMAGED, UNIT_STATUS.DISABLED, UNIT_STATUS.DESTROYED].map(
                                    (status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                {/* Deployed Elementals */}
                {missionBeingCompleted.assignedElementals &&
                  missionBeingCompleted.assignedElementals.length > 0 && (
                    <div className="border border-border rounded p-3 bg-muted/10">
                      <div className="text-xs font-semibold mb-2">Elementals</div>
                      <div className="space-y-1">
                        {getAssignedElementals(
                          force,
                          missionBeingCompleted.assignedElementals,
                        ).map((elemental) => {
                          const state = postMissionUnitState.elementals[elemental.id];
                          if (!state) return null;
                          return (
                            <div
                              key={elemental.id}
                              className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 text-xs"
                            >
                              <span className="font-medium col-span-1">{elemental.name}</span>
                              <select
                                className="border border-border rounded px-1 py-0.5 bg-background text-xs col-span-1"
                                value={state.status}
                                onChange={(e) =>
                                  setPostMissionUnitState((prev) => ({
                                    ...prev,
                                    elementals: {
                                      ...prev.elementals,
                                      [elemental.id]: {
                                        ...prev.elementals[elemental.id],
                                        status: e.target.value,
                                      },
                                    },
                                  }))
                                }
                              >
                                {[UNIT_STATUS.OPERATIONAL, UNIT_STATUS.DAMAGED, UNIT_STATUS.DISABLED, UNIT_STATUS.DESTROYED].map(
                                  (status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ),
                                )}
                              </select>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Suits Damaged
                                </span>
                                <Input
                                  type="number"
                                  className="h-7 w-16 text-xs"
                                  value={state.suitsDamaged}
                                  min={0}
                                  max={6}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    setPostMissionUnitState((prev) => ({
                                      ...prev,
                                      elementals: {
                                        ...prev.elementals,
                                        [elemental.id]: {
                                          ...prev.elementals[elemental.id],
                                          suitsDamaged: Number.isNaN(value)
                                            ? 0
                                            : Math.max(0, Math.min(6, value)),
                                        },
                                      },
                                    }));
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Suits Destroyed
                                </span>
                                <Input
                                  type="number"
                                  className="h-7 w-16 text-xs"
                                  value={state.suitsDestroyed}
                                  min={0}
                                  max={6}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    setPostMissionUnitState((prev) => ({
                                      ...prev,
                                      elementals: {
                                        ...prev.elementals,
                                        [elemental.id]: {
                                          ...prev.elementals[elemental.id],
                                          suitsDestroyed: Number.isNaN(value)
                                            ? 0
                                            : Math.max(0, Math.min(6, value)),
                                        },
                                      },
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Deployed Pilots */}
                {Object.keys(postMissionUnitState.pilots).length > 0 && (
                  <div className="border border-border rounded p-3 bg-muted/10">
                    <div className="text-xs font-semibold mb-2">Pilots</div>
                    <div className="space-y-1">
                      {(force.pilots || [])
                        .filter((pilot) => postMissionUnitState.pilots[pilot.id])
                        .map((pilot) => {
                          const state = postMissionUnitState.pilots[pilot.id];
                          return (
                            <div
                              key={pilot.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-medium">{pilot.name}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground">Injuries</span>
                                <Input
                                  type="number"
                                  className="h-7 w-16 text-xs"
                                  value={state.injuries}
                                  min={0}
                                  max={6}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    setPostMissionUnitState((prev) => ({
                                      ...prev,
                                      pilots: {
                                        ...prev.pilots,
                                        [pilot.id]: {
                                          ...prev.pilots[pilot.id],
                                          injuries: Number.isNaN(value)
                                            ? 0
                                            : Math.max(0, Math.min(6, value)),
                                        },
                                      },
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span>
                  Total reward from achieved objectives:{' '}
                  <span className="font-mono text-emerald-400">
                    +
                    {formatNumber(
                      completionObjectives.reduce(
                        (sum, obj) =>
                          obj.achieved && obj.wpReward > 0 ? sum + obj.wpReward : sum,
                        0,
                      ),
                    )}{' '}
                    WP
                  </span>
                </span>
                <span>Current Warchest: {formatNumber(force.currentWarchest)} WP</span>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmCompleteMission}>Confirm Completion</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
