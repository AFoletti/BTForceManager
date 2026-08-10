import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Database, Save, RotateCcw, AlertCircle, Download, FolderSync, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { downloadJSON } from '../lib/utils';
import { getMechCatalogImportStatus } from '../lib/api';

export default function DataEditor({ force, onUpdate }) {
  const [forceJSON, setForceJSON] = useState(JSON.stringify(force, null, 2));

  // Keep editor content in sync when the selected force changes or updates.
  // This prevents editing stale JSON when switching forces.
  useEffect(() => {
    setForceJSON(JSON.stringify(force, null, 2));
  }, [force]);
  const [error, setError] = useState('');

  const [watcherStatus, setWatcherStatus] = useState(null);
  const [watcherError, setWatcherError] = useState('');
  const [watcherLoading, setWatcherLoading] = useState(false);

  const loadWatcherStatus = useCallback(async () => {
    setWatcherLoading(true);
    setWatcherError('');
    try {
      const status = await getMechCatalogImportStatus();
      setWatcherStatus(status);
    } catch (err) {
      setWatcherError(err.message);
    } finally {
      setWatcherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatcherStatus();
  }, [loadWatcherStatus]);

  const handleSave = () => {
    setError('');
    try {
      const parsedForce = JSON.parse(forceJSON);
      
      // Validate that it has an id
      if (!parsedForce.id) {
        throw new Error('Force must have an "id" field');
      }
      
      onUpdate(parsedForce);
      alert('✅ Force data saved to the server.');
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleReset = () => {
    setForceJSON(JSON.stringify(force, null, 2));
    setError('');
  };

  const handleExportForce = () => {
    try {
      const parsedForce = JSON.parse(forceJSON);
      downloadJSON(parsedForce, `${parsedForce.id}.json`);
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Important Notice */}
      <div className="tactical-panel bg-amber-900/20 border-amber-600/50">
        <div className="p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-200 mb-2">Data Management Notice</p>
            <p className="text-amber-100/90 mb-2">
              Edit the JSON below and click <strong>Save to Session</strong> to write the changes
              to the backend database. Use <strong>Export Force</strong> to download a JSON backup
              of the current force at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Mech Catalog Watcher Status */}
      <div className="tactical-panel" data-testid="watcher-status-panel">
        <div className="tactical-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <FolderSync className="w-4 h-4" />
              Mech Catalog Watcher
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadWatcherStatus}
              disabled={watcherLoading}
              data-testid="watcher-status-refresh-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${watcherLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-3 text-sm">
          {watcherError && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded text-xs text-destructive" data-testid="watcher-status-error">
              Failed to load watcher status: {watcherError}
            </div>
          )}
          {watcherStatus && (
            <>
              <div className="flex flex-wrap items-center gap-4 text-xs" data-testid="watcher-status-summary">
                <div className="flex items-center gap-1.5">
                  {watcherStatus.enabled ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>{watcherStatus.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {watcherStatus.running ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>{watcherStatus.running ? 'Running' : 'Stopped'}</span>
                </div>
                {watcherStatus.watchDir && (
                  <div className="text-muted-foreground">
                    Watching: <span className="font-mono">{watcherStatus.watchDir}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-1.5 text-muted-foreground">Recent Imports</div>
                {(!watcherStatus.recentImports || watcherStatus.recentImports.length === 0) ? (
                  <div className="text-xs text-muted-foreground" data-testid="watcher-status-empty">
                    No CSV drops processed yet.
                  </div>
                ) : (
                  <ul className="space-y-1.5" data-testid="watcher-status-recent-imports">
                    {watcherStatus.recentImports.slice(0, 5).map((entry, idx) => (
                      <li
                        key={`${entry.filename}-${entry.timestamp}-${idx}`}
                        className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5"
                        data-testid={`watcher-status-import-row-${idx}`}
                      >
                        {entry.status === 'ok' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className="font-mono truncate">{entry.filename}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {entry.status === 'ok'
                            ? `${entry.created} created, ${entry.updated} updated, ${entry.skipped} skipped`
                            : entry.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tactical-panel">
        <div className="tactical-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" />
              Force JSON Editor
            </h3>
            <div className="text-xs text-muted-foreground">
              {force.name}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Complete Force Data</label>
              <div className="text-xs text-muted-foreground">
                Lines: {forceJSON.split('\n').length}
              </div>
            </div>
            <Textarea
              value={forceJSON}
              onChange={(e) => setForceJSON(e.target.value)}
              className="font-mono text-xs"
              rows={30}
              placeholder="Force JSON data..."
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <p className="mb-1">Edit the complete force JSON including:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><strong>id, name, description, image:</strong> Force metadata</li>
                <li><strong>startingWarchest, currentWarchest:</strong> Warchest values</li>
                <li><strong>wpMultiplier:</strong> Repair cost multiplier (default: 5)</li>
                <li><strong>mechs[]:</strong> Array of mechs with id, name, status, pilot, bv, weight, image, activityLog</li>
                <li><strong>elementals[]:</strong> Array of elementals with id, name, commander, gunnery, antimech, suitsDestroyed, suitsDamaged, bv, status, image, activityLog</li>
                <li><strong>pilots[]:</strong> Array of pilots with id, name, gunnery, piloting, injuries, activityLog</li>
                <li><strong>missions[]:</strong> Array of missions with assignedMechs, assignedElementals</li>
                <li><strong>repairActions[]:</strong> Legacy repair actions (optional)</li>
                <li><strong>otherActionsLog[]:</strong> Force-level other actions history</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} size="lg">
              <Save className="w-4 h-4" />
              Save to Session
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={handleExportForce}>
              <Download className="w-4 h-4" />
              Export Force
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="tactical-panel">
        <div className="tactical-header">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Quick Reference</h3>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <div className="font-medium mb-1">Adding a Mech:</div>
            <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto">
{`{
  "id": "mech-3",
  "name": "Warhammer WHM-6R",
  "status": "Operational",
  "pilot": "Pilot Name",
  "bv": 1299,
  "weight": 70,
  "image": "",
  "activityLog": []
}`}
            </pre>
          </div>
          
          <div>
            <div className="font-medium mb-1">Adding an Elemental:</div>
            <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto">
{`{
  "id": "elemental-2",
  "name": "Elemental Point Beta",
  "commander": "Star Captain Name",
  "gunnery": 3,
  "antimech": 4,
  "suitsDestroyed": 0,
  "suitsDamaged": 0,
  "bv": 485,
  "status": "Operational",
  "image": "",
  "activityLog": []
}`}
            </pre>
          </div>

          <div>
            <div className="font-medium mb-1">Adding a Pilot:</div>
            <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto">
{`{
  "id": "pilot-3",
  "name": "Pilot Name",
  "gunnery": 4,
  "piloting": 5,
  "injuries": 0,
  "activityLog": []
}`}
            </pre>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>💡 <strong>Tip:</strong> Use a JSON validator (jsonlint.com) to check your JSON before saving.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
