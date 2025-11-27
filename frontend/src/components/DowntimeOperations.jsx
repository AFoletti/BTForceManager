import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Wrench, AlertTriangle, Settings } from 'lucide-react';
import {
  buildDowntimeContext,
  evaluateDowntimeCost,
  applyMechDowntimeAction,
  applyElementalDowntimeAction,
  applyPilotDowntimeAction,
} from '../lib/downtime';
import { createSnapshot } from '../lib/snapshots';

// Planned downtime action kept in a cycle backlog until validation.
// Actions are applied in sequence to a working copy of the force when
// the user confirms the downtime cycle.

export default function DowntimeOperations({ force, onUpdate }) {
  const [selectedUnitType, setSelectedUnitType] = useState('mech');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [showOtherActionDialog, setShowOtherActionDialog] = useState(false);
  const [otherActionData, setOtherActionData] = useState({ description: '', cost: 0 });
  const [wpMultiplier, setWpMultiplier] = useState(force.wpMultiplier || 5);
  const [editingMultiplier, setEditingMultiplier] = useState(false);

  // Load downtime actions from JSON
  const [mechActions, setMechActions] = useState([]);
  const [elementalActions, setElementalActions] = useState([]);
  const [pilotActions, setPilotActions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Planned actions backlog (downtime cycle)
  const [plannedActions, setPlannedActions] = useState([]);

  useEffect(() => {
    fetch('./data/downtime-actions.json')
      .then((response) => response.json())
      .then((data) => {
        setMechActions(data.mechActions || []);
        setElementalActions(data.elementalActions || []);
        setPilotActions(data.pilotActions || []);
        setLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load downtime actions:', err);
        setLoading(false);
      });
  }, []);

  const selectedUnit =
    selectedUnitType === 'mech'
      ? force.mechs.find((m) => m.id === selectedUnitId)
      : selectedUnitType === 'elemental'
        ? force.elementals?.find((e) => e.id === selectedUnitId)
        : force.pilots?.find((p) => p.id === selectedUnitId);

  const otherAction = {
    id: 'other',
    name: 'Other Action',
    formula: 'custom',
    makesUnavailable: false,
  };

  const availableActions = [
    ...(selectedUnitType === 'mech'
      ? mechActions
      : selectedUnitType === 'elemental'
        ? elementalActions
        : pilotActions),
    otherAction,
  ];

  if (loading) {
    return (
      <div className="tactical-panel">
        <div className="p-6 text-center text-muted-foreground">Loading downtime actions...</div>
      </div>
    );
  }

  const hasActiveMission = Array.isArray(force.missions)
    ? force.missions.some((m) => !m.completed)
    : false;

  const calculateCost = () => {
    if (!selectedUnit || !selectedAction) return 0;

    const action = availableActions.find((a) => a.id === selectedAction);
    if (!action || action.id === 'other') return 0;

    if (selectedUnitType === 'pilot') {
      // For pilot actions, we currently use flat WP costs from downtime-actions.json
      // so the formula is evaluated with only wpMultiplier.
      const context = buildDowntimeContext(force, {});
      return evaluateDowntimeCost(action.formula, context);
    }

    const context = buildDowntimeContext(force, selectedUnit);
    return evaluateDowntimeCost(action.formula, context);
  };

  const cost = calculateCost();

  const addPlannedAction = () => {
    if (!selectedUnit || !selectedAction) return;

    // "Other" actions are configured via the dedicated dialog
    if (selectedAction === 'other') {
      setShowOtherActionDialog(true);
      return;
    }

    const action = availableActions.find((a) => a.id === selectedAction);
    if (!action) return;

    const newPlanned = {
      id: `plan-${Date.now()}-${plannedActions.length}`,
      unitType: selectedUnitType,
      unitId: selectedUnitId,
      unitName: selectedUnit.name,
      actionId: selectedAction,
      actionName: action.name,
      formula: action.formula,
      makesUnavailable: Boolean(action.makesUnavailable),
      cost,
      createdAt: force.currentDate,
    };

    setPlannedActions((prev) => [...prev, newPlanned]);
    setSelectedUnitId('');
    setSelectedAction('');
  };

  const totalPlannedCost = plannedActions.reduce((sum, a) => sum + (a.cost || 0), 0);
  const projectedWarchest = force.currentWarchest - totalPlannedCost;

  const canAffordCycle = projectedWarchest >= 0;

  const removePlannedAction = (id) => {
    setPlannedActions((prev) => prev.filter((a) => a.id !== id));
  };

  const clearPlannedActions = () => {
    setPlannedActions([]);
  };

  const executeDowntimeCycle = () => {
    if (plannedActions.length === 0) return;
    if (!canAffordCycle) return;

    // Apply all planned actions sequentially to a working copy of the force.
    let workingForce = { ...force };

    plannedActions.forEach((plan) => {
      const timestamp = workingForce.currentDate;
      const lastMission = workingForce.missions?.[workingForce.missions.length - 1];

      if (plan.unitType === 'mech') {
        const result = applyMechDowntimeAction(workingForce, {
          mechId: plan.unitId,
          action: {
            id: plan.actionId,
            name: plan.actionName,
            makesUnavailable: plan.makesUnavailable,
          },
          cost: plan.cost,
          timestamp,
          lastMissionName: lastMission?.name || null,
        });
        workingForce = {
          ...workingForce,
          mechs: result.mechs,
          currentWarchest: result.currentWarchest,
        };
      } else if (plan.unitType === 'elemental') {
        const result = applyElementalDowntimeAction(workingForce, {
          elementalId: plan.unitId,
          actionId: plan.actionId,
          action: {
            name: plan.actionName,
          },
          cost: plan.cost,
          timestamp,
          lastMissionName: lastMission?.name || null,
        });
        workingForce = {
          ...workingForce,
          elementals: result.elementals,
          currentWarchest: result.currentWarchest,
        };
      } else if (plan.unitType === 'pilot') {
        const result = applyPilotDowntimeAction(workingForce, {
          pilotId: plan.unitId,
          actionId: plan.actionId,
          action: {
            name: plan.actionName,
          },
          cost: plan.cost,
          timestamp,
          lastMissionName: lastMission?.name || null,
        });
        workingForce = {
          ...workingForce,
          pilots: result.pilots,
          currentWarchest: result.currentWarchest,
        };
      }
    });

    // Create a post-downtime snapshot from the resulting force state.
    const snapshotLabel = `After downtime cycle #${(force.snapshots || []).length + 1}`;
    const snapshot = createSnapshot(workingForce, {
      type: 'post-downtime',
      label: snapshotLabel,
    });

    const existingSnapshots = Array.isArray(force.snapshots) ? force.snapshots : [];

    onUpdate({
      mechs: workingForce.mechs,
      pilots: workingForce.pilots,
      elementals: workingForce.elementals,
      currentWarchest: workingForce.currentWarchest,
      snapshots: [...existingSnapshots, snapshot],
    });

    setPlannedActions([]);
  };

  const performOtherAction = () => {
    if (!otherActionData.description) return;

    const costValue = otherActionData.cost || 0;
    if (!selectedUnitId) return;

    const newPlanned = {
      id: `plan-${Date.now()}-${plannedActions.length}`,
      unitType: selectedUnitType,
      unitId: selectedUnitId,
      unitName: selectedUnit?.name || 'Unit',
      actionId: 'other',
      actionName: `Other: ${otherActionData.description}`,
      formula: 'custom',
      makesUnavailable: false,
      cost: costValue,
      createdAt: force.currentDate,
    };

    setPlannedActions((prev) => [...prev, newPlanned]);

    setShowOtherActionDialog(false);
    setOtherActionData({ description: '', cost: 0 });
    setSelectedAction('');
  };

  const saveWpMultiplier = () => {
    onUpdate({ wpMultiplier });
    setEditingMultiplier(false);
  };

  return (
    <div className="space-y-6">
      {/* WP Multiplier Setting */}
      <div className="tactical-panel">
        <div className="tactical-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Warchest Configuration
            </h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">WP Multiplier</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={wpMultiplier}
                  onChange={(e) => setWpMultiplier(parseFloat(e.target.value) || 1)}
                  disabled={!editingMultiplier}
                  className="w-32"
                  min="1"
                  step="0.5"
                />
                {editingMultiplier ? (
                  <>
                    <Button size="sm" onClick={saveWpMultiplier}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWpMultiplier(force.wpMultiplier || 5);
                        setEditingMultiplier(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingMultiplier(true)}>
                    Edit
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used to calculate repair costs. Current: {force.wpMultiplier || 5}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Panel */}
      <div className="tactical-panel">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Downtime Operations
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {hasActiveMission ? (
            <div className="border border-amber-500 bg-amber-500/10 text-amber-100 rounded-md p-4 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Active mission detected</p>
                <p className="text-xs">
                  You currently have at least one mission marked as active. Complete all missions
                  before planning or executing a downtime cycle. This keeps the campaign
                  progression consistent: <strong>Battle → Downtime → Next Battle</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Unit Type</label>
                  <Select
                    value={selectedUnitType}
                    onChange={(e) => {
                      setSelectedUnitType(e.target.value);
                      setSelectedUnitId('');
                      setSelectedAction('');
                    }}
                  >
                    <option value="mech">Mech</option>
                    <option value="elemental">Elemental</option>
                    <option value="pilot">Pilot</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Select Unit</label>
                  <Select
                    value={selectedUnitId}
                    onChange={(e) => {
                      setSelectedUnitId(e.target.value);
                      setSelectedAction('');
                    }}
                  >
                    <option value="">-- Choose unit --</option>
                    {selectedUnitType === 'mech'
                      ? force.mechs.map((mech) => (
                          <option key={mech.id} value={mech.id}>
                            {mech.name} ({mech.weight}t) - {mech.status}
                          </option>
                        ))
                      : selectedUnitType === 'elemental'
                        ? (force.elementals || []).map((elemental) => (
                            <option key={elemental.id} value={elemental.id}>
                              {elemental.name} (D:{elemental.suitsDestroyed}/Dmg:{
                                elemental.suitsDamaged
                              })
                            </option>
                          ))
                        : force.pilots.map((pilot) => (
                            <option key={pilot.id} value={pilot.id}>
                              {pilot.name} (G:{pilot.gunnery}/P:{pilot.piloting}, Inj:{
                                pilot.injuries
                              })
                            </option>
                          ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Select Action</label>
                  <Select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    disabled={!selectedUnitId}
                  >
                    <option value="">-- Choose action --</option>
                    {availableActions.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.name}{' '}
                        {action.makesUnavailable ? '(Repairing)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {selectedUnit && selectedAction && selectedAction !== 'other' && (
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Unit</div>
                      <div className="font-semibold">{selectedUnit.name}</div>
                      {selectedUnitType === 'mech' ? (
                        <div className="text-sm">Weight: {selectedUnit.weight} tons</div>
                      ) : (
                        <div className="text-sm">
                          Suits: {selectedUnit.suitsDestroyed} destroyed,{' '}
                          {selectedUnit.suitsDamaged} damaged
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Action</div>
                      <div className="font-semibold">
                        {availableActions.find((a) => a.id === selectedAction)?.name}
                      </div>
                      <div className="text-sm font-mono text-muted-foreground">
                        Formula:{' '}
                        {availableActions.find((a) => a.id === selectedAction)?.formula}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <div className="text-2xl font-bold font-mono text-primary">{cost} WP</div>
                      <div className="text-xs text-muted-foreground">
                        Current Warchest: {force.currentWarchest} WP
                      </div>
                    </div>

                    {availableActions.find((a) => a.id === selectedAction)?.makesUnavailable && (
                      <div className="flex items-center gap-2 text-amber-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Unit will be unavailable
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={addPlannedAction}
                  disabled={!selectedUnit || !selectedAction}
                  size="lg"
                >
                  {selectedAction === 'other'
                    ? 'Configure Other Action'
                    : `Add to Downtime Cycle (${cost} WP)`}
                </Button>
              </div>

              {/* Planned actions summary */}
              <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider">
                      Planned Downtime Cycle
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Actions are not applied immediately. Review the backlog, then execute the cycle
                      to apply all changes and create a post-downtime snapshot.
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div>
                      Planned cost:{' '}
                      <span className="font-mono font-semibold">
                        {totalPlannedCost} WP
                      </span>
                    </div>
                    <div>
                      Projected Warchest:{' '}
                      <span
                        className={`font-mono font-semibold ${
                          projectedWarchest >= 0 ? 'text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {projectedWarchest} WP
                      </span>
                    </div>
                  </div>
                </div>

                {plannedActions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No planned actions yet. Select a unit and action above, then add it to the
                    downtime cycle.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table text-xs" data-testid="downtime-planned-table">
                      <thead>
                        <tr>
                          <th className="text-left">Unit</th>
                          <th className="text-left">Type</th>
                          <th className="text-left">Action</th>
                          <th className="text-left">Date</th>
                          <th className="text-right">Cost (WP)</th>
                          <th className="text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plannedActions.map((plan) => (
                          <tr key={plan.id} data-testid="downtime-planned-row">
                            <td>{plan.unitName}</td>
                            <td className="text-muted-foreground">
                              {plan.unitType === 'mech'
                                ? 'Mech'
                                : plan.unitType === 'elemental'
                                  ? 'Elemental'
                                  : 'Pilot'}
                            </td>
                            <td>{plan.actionName}</td>
                            <td className="font-mono">{plan.createdAt}</td>
                            <td className="text-right font-mono">{plan.cost}</td>
                            <td className="text-right">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => removePlannedAction(plan.id)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPlannedActions}
                    disabled={plannedActions.length === 0}
                  >
                    Clear Cycle
                  </Button>
                  <div className="flex items-center gap-3">
                    {!canAffordCycle && plannedActions.length > 0 && (
                      <div className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Insufficient warchest for full cycle
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={executeDowntimeCycle}
                      disabled={plannedActions.length === 0 || !canAffordCycle}
                      data-testid="execute-downtime-cycle-button"
                    >
                      Execute Downtime Cycle
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Other Action Dialog */}
      <Dialog open={showOtherActionDialog} onOpenChange={setShowOtherActionDialog}>
        <DialogContent onClose={() => setShowOtherActionDialog(false)}>
          <DialogHeader>
            <DialogTitle>Other Action</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Action Description</label>
              <Textarea
                value={otherActionData.description}
                onChange={(e) =>
                  setOtherActionData({ ...otherActionData, description: e.target.value })
                }
                placeholder="e.g., Hire technician, Purchase supplies, Training session..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Cost (WP)</label>
              <Input
                type="number"
                value={otherActionData.cost}
                onChange={(e) =>
                  setOtherActionData({
                    ...otherActionData,
                    cost: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
                min="0"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Available: {force.currentWarchest} WP
              </div>
            </div>

            {otherActionData.cost > force.currentWarchest && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Insufficient warchest points
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowOtherActionDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={performOtherAction}
                disabled={
                  !otherActionData.description ||
                  otherActionData.cost < 0 ||
                  otherActionData.cost > force.currentWarchest ||
                  !selectedUnitId
                }
              >
                Add to Cycle ({otherActionData.cost} WP)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Actions Reference */}
      <div className="tactical-panel bg-muted/20">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Available Actions Reference
          </h3>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="text-muted-foreground mb-2">
            Actions are loaded from{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
              data/downtime-actions.json
            </code>
          </div>

          <div>
            <div className="font-medium mb-2 text-primary">Mech Actions:</div>
            {mechActions.map((action) => (
              <div key={action.id} className="mb-2 pl-3 border-l-2 border-muted">
                <div className="font-medium">{action.name}</div>
                <div className="text-xs text-muted-foreground">
                  Formula:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{action.formula}</code>
                  {action.makesUnavailable && (
                    <span className="ml-2 text-amber-400">(Makes Unavailable)</span>
                  )}
                </div>
                {action.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="font-medium mb-2 text-primary">Elemental Actions:</div>
            {elementalActions.map((action) => (
              <div key={action.id} className="mb-2 pl-3 border-l-2 border-muted">
                <div className="font-medium">{action.name}</div>
                <div className="text-xs text-muted-foreground">
                  Formula:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{action.formula}</code>
                </div>
                {action.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="font-medium mb-2 text-primary">Pilot Actions:</div>
            {pilotActions.map((action) => (
              <div key={action.id} className="mb-2 pl-3 border-l-2 border-muted">
                <div className="font-medium">{action.name}</div>
                <div className="text-xs text-muted-foreground">
                  Formula:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">{action.formula}</code>
                </div>
                {action.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">
                💡 <strong>To modify actions:</strong>
              </p>
              <ol className="list-decimal list-inside ml-2 space-y-0.5">
                <li>
                  Edit{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    data/downtime-actions.json
                  </code>
                </li>
                <li>
                  Formulas use:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">weight</code>,{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">wpMultiplier</code>,{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">suitsDamaged</code>,{' '}
                  <code className="bg-muted px-1 py-0.5 rounded">suitsDestroyed</code>
                </li>
                <li>Commit and push to GitHub</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
