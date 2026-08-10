import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { formatDate } from '../lib/utils';
import * as api from '../lib/api';

const WAYPOINT_TYPE_SUGGESTIONS = ['MANUAL', 'MISSION_END', 'DOWNTIME_END'];

// Full-state, per-force backups ("waypoints") - distinct from the Campaign
// Snapshots table above, which tracks lightweight stats over time and
// supports session rollback. Waypoints are read-only here; restore is a
// later feature.
export default function WaypointsPanel({ force, flushForceSync }) {
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [label, setLabel] = useState('');
  const [waypointType, setWaypointType] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewingWaypoint, setViewingWaypoint] = useState(null);

  const load = async () => {
    if (!force?.id) return;
    setLoading(true);
    setError('');
    try {
      setWaypoints(await api.listForceStateSnapshots(force.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [force?.id]);

  const openCreateDialog = () => {
    setLabel(`Waypoint - ${formatDate(force.currentDate)}`);
    setWaypointType('MANUAL');
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    try {
      await flushForceSync(force.id);
      await api.createForceStateSnapshot(force.id, { label: label.trim(), waypointType });
      setShowCreateDialog(false);
      await load();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Failed to create waypoint: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleView = async (waypoint) => {
    try {
      setViewingWaypoint(await api.getForceStateSnapshot(force.id, waypoint.id));
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Failed to load waypoint details: ${err.message}`);
    }
  };

  return (
    <div className="tactical-panel" data-testid="waypoints-panel">
      <div className="tactical-header flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-amber-500" />
          Waypoints (Full Backups)
        </h3>
        <Button size="sm" onClick={openCreateDialog} data-testid="create-waypoint-button">
          <Plus className="w-4 h-4" /> Create Waypoint
        </Button>
      </div>
      <p className="px-4 pt-2 text-xs text-muted-foreground">
        Waypoints are full backups of this force only - other forces and app-wide settings (catalog, SP
        purchases, downtime actions, achievements) are never affected. Restore isn't available yet.
      </p>

      {error && <p className="px-4 pt-2 text-xs text-destructive">{error}</p>}

      {!loading && waypoints.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center" data-testid="waypoints-empty-state">
          No waypoints yet for this force.
        </div>
      ) : (
        <div className="p-4">
          <table className="data-table" data-testid="waypoints-table">
            <thead>
              <tr>
                <th className="text-left">Created</th>
                <th className="text-left">Label</th>
                <th className="text-left">Type</th>
                <th className="text-center">Details</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map((wp) => (
                <tr key={wp.id} data-testid={`waypoint-row-${wp.id}`}>
                  <td className="font-mono text-xs">{wp.createdAt}</td>
                  <td className="text-sm font-medium">{wp.label}</td>
                  <td className="text-xs text-muted-foreground">{wp.waypointType || '-'}</td>
                  <td className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleView(wp)}
                      data-testid={`view-waypoint-btn-${wp.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Waypoint Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent onClose={() => setShowCreateDialog(false)} data-testid="create-waypoint-dialog">
          <DialogHeader>
            <DialogTitle>Create Waypoint for {force.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="waypoint-label-input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Waypoint Type (optional)</label>
              <Input
                value={waypointType}
                onChange={(e) => setWaypointType(e.target.value)}
                placeholder="MANUAL"
                list="waypoint-type-suggestions"
                data-testid="waypoint-type-input"
              />
              <datalist id="waypoint-type-suggestions">
                {WAYPOINT_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !label.trim()} data-testid="confirm-create-waypoint-btn">
                {creating ? 'Saving...' : 'Create Waypoint'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Waypoint Details Dialog */}
      <Dialog open={!!viewingWaypoint} onOpenChange={() => setViewingWaypoint(null)}>
        <DialogContent onClose={() => setViewingWaypoint(null)} data-testid="view-waypoint-dialog">
          <DialogHeader>
            <DialogTitle>{viewingWaypoint?.label}</DialogTitle>
          </DialogHeader>
          {viewingWaypoint && (
            <div className="space-y-2 text-sm">
              <p><strong>Type:</strong> {viewingWaypoint.waypointType || '-'}</p>
              <p><strong>Created:</strong> {viewingWaypoint.createdAt}</p>
              <div className="p-3 bg-muted rounded-md font-mono text-xs space-y-1">
                <p>Mechs: {viewingWaypoint.snapshotJson.mechs?.length || 0}</p>
                <p>Elementals: {viewingWaypoint.snapshotJson.elementals?.length || 0}</p>
                <p>Pilots: {viewingWaypoint.snapshotJson.pilots?.length || 0}</p>
                <p>Missions: {viewingWaypoint.snapshotJson.missions?.length || 0}</p>
                <p>Warchest at time of backup: {viewingWaypoint.snapshotJson.currentWarchest}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is metadata only - the full backup isn't editable here, and restoring it isn't available yet.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
