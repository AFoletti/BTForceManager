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
  logOtherDowntimeAction,
} from '../lib/downtime';

export default function DowntimeOperations({ force, onUpdate }) {
  const [selectedUnitType, setSelectedUnitType] = useState('mech');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [showOtherActionDialog, setShowOtherActionDialog] = useState(false);
  const [otherActionData, setOtherActionData] = useState({ description: '', cost: 0, inGameDate: '' });
  const [wpMultiplier, setWpMultiplier] = useState(force.wpMultiplier || 5);
  const [editingMultiplier, setEditingMultiplier] = useState(false);

  // Load downtime actions from JSON
  const [mechActions, setMechActions] = useState([]);
  const [elementalActions, setElementalActions] = useState([]);
  const [pilotActions, setPilotActions] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const canAfford = cost <= force.currentWarchest;

  const performAction = () => {
    if (selectedAction === 'other') {
      setShowOtherActionDialog(true);
      return;
    }

    if (!selectedUnit || !selectedAction || !canAfford) return;

    const timestamp = new Date().toISOString();
    const inGameDate = otherActionData.inGameDate && otherActionData.inGameDate.trim() !== ''
      ? otherActionData.inGameDate
      : undefined;
    const lastMission = force.missions?.[force.missions.length - 1];
    const action = availableActions.find((a) => a.id === selectedAction);

    if (!action) return;

    if (selectedUnitType === 'mech') {
      const result = applyMechDowntimeAction(force, {
        mechId: selectedUnitId,
        action,
        cost,
        timestamp,
        inGameDate,
        lastMissionName: lastMission?.name || null,
      });
      onUpdate(result);
    } else {
      const result = applyElementalDowntimeAction(force, {
        elementalId: selectedUnitId,
        actionId: selectedAction,
        action,
        cost,
        timestamp,
        inGameDate,
        lastMissionName: lastMission?.name || null,
      });
      onUpdate(result);
    }

    setSelectedUnitId('');
    setSelectedAction('');
  };

  const performOtherAction = () => {
    if (!otherActionData.description || otherActionData.cost <= 0) return;
    if (otherActionData.cost > force.currentWarchest) return;

    const timestamp = new Date().toISOString();
    const inGameDate = otherActionData.inGameDate && otherActionData.inGameDate.trim() !== ''
      ? otherActionData.inGameDate
      : undefined;
    const lastMission = force.missions?.[force.missions.length - 1];

    // Always log at force level for global history and WP deduction
    const baseResult = logOtherDowntimeAction(force, {
      description: otherActionData.description,
      cost: otherActionData.cost,
      timestamp,
      inGameDate,
    });

    const updated = { ...baseResult };

    // Additionally log on the specific unit's activity log, if a unit is selected
    if (selectedUnitType === 'mech' && selectedUnitId) {
      updated.mechs = force.mechs.map((mech) => {
        if (mech.id !== selectedUnitId) return mech;
        const activityLog = [...(mech.activityLog || [])];
        activityLog.push({
          timestamp,
          action: `Other: ${otherActionData.description} (${otherActionData.cost} WP)`,
          mission: lastMission?.name || null,
        });
        return { ...mech, activityLog };
      });
    } else if (selectedUnitType === 'elemental' && selectedUnitId) {
      updated.elementals = (force.elementals || []).map((elemental) => {
        if (elemental.id !== selectedUnitId) return elemental;
        const activityLog = [...(elemental.activityLog || [])];
        activityLog.push({
          timestamp,
          action: `Other: ${otherActionData.description} (${otherActionData.cost} WP)`,
          mission: lastMission?.name || null,
        });
        return { ...elemental, activityLog };
      });
    }

    onUpdate(updated);

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
                          {pilot.name} (G:{pilot.gunnery}/P:{pilot.piloting}, Inj:{pilot.injuries})
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
                    {action.name} {action.makesUnavailable ? '(Unavailable)' : ''}
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
                    Available: {force.currentWarchest} WP
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
              onClick={performAction}
              disabled={!selectedUnit || !selectedAction || (!canAfford && selectedAction !== 'other')}
              size="lg"
            >
              {selectedAction === 'other'
                ? 'Configure Other Action'
                : `Perform Action (${cost} WP)`}
            </Button>
          </div>

          {!canAfford && selectedAction && selectedAction !== 'other' && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Insufficient warchest points
            </div>
          )}
        </div>
      </div>

      {/* Other Actions Log */}
      {force.otherActionsLog && force.otherActionsLog.length > 0 && (
        <div className="tactical-panel">
          <div className="tactical-header">
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Other Actions History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {force.otherActionsLog
                  .slice()
                  .reverse()
                  .map((log, idx) => (
                    <tr key={idx}>
                      <td className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>{log.description}</td>
                      <td className="text-right font-mono text-destructive">-{log.cost} WP</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
            <div>
              <label className="block text-sm font-medium mb-2">In-Game Date (YYYY-MM-DD)</label>
              <Input
                type="text"
                value={otherActionData.inGameDate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setOtherActionData({ ...otherActionData, inGameDate: '' });
                    return;
                  }

                  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
                  if (!isValidFormat) {
                    setOtherActionData({ ...otherActionData, inGameDate: value });
                    return;
                  }

                  const year = Number(value.slice(0, 4));
                  if (year < 2400 || year > 3500) {
                    setOtherActionData({ ...otherActionData, inGameDate: value });
                    return;
                  }

                  setOtherActionData({ ...otherActionData, inGameDate: value });
                }}
                placeholder="3025-01-15"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Optional. Must be between years 2400 and 3500.
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
                  otherActionData.cost <= 0 ||
                  otherActionData.cost > force.currentWarchest
                }
              >
                Perform Action ({otherActionData.cost} WP)
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
