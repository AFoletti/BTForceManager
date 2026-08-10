import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, FolderSync, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import * as api from '../../lib/api';

export default function AdminMechCatalogPanel() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [watcherStatus, setWatcherStatus] = useState(null);
  const [watcherError, setWatcherError] = useState('');
  const [watcherLoading, setWatcherLoading] = useState(false);

  const loadWatcherStatus = useCallback(async () => {
    setWatcherLoading(true);
    setWatcherError('');
    try {
      setWatcherStatus(await api.getMechCatalogImportStatus());
    } catch (err) {
      setWatcherError(err.message);
    } finally {
      setWatcherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatcherStatus();
  }, [loadWatcherStatus]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.adminImportMechCatalog(selectedFile);
      setResult(response);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadWatcherStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-mech-catalog-panel">
      <h3 className="font-heading uppercase tracking-wider text-sm text-muted-foreground">Mech Catalog Import</h3>
      <p className="text-xs text-muted-foreground">
        Upload a MekBay CSV export. Entries are upserted by MUL ID - existing rows are updated, new ones inserted.
        The watched-folder mechanism (Docker/ops) remains available as an alternative path.
      </p>

      <div className="border border-border/40 rounded p-4 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          data-testid="admin-mech-catalog-file-input"
          className="text-sm"
        />
        <Button size="sm" onClick={handleImport} disabled={!selectedFile || importing} data-testid="admin-mech-catalog-import-btn">
          <UploadCloud className="w-4 h-4" /> {importing ? 'Importing...' : 'Import CSV'}
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded p-3 text-sm text-destructive" data-testid="admin-mech-catalog-error">
          {error}
        </div>
      )}

      {result && (
        <div className="border border-operational/40 bg-operational/5 rounded p-3 text-sm" data-testid="admin-mech-catalog-result">
          <p><span className="font-medium">{result.filename}</span> imported.</p>
          <p className="font-mono text-xs mt-1">
            Created: {result.created} &middot; Updated: {result.updated} &middot; Errors: {(result.errors || []).length}
          </p>
        </div>
      )}

      <div className="border border-border/40 rounded p-3" data-testid="watcher-status-panel">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FolderSync className="w-3.5 h-3.5" />
            Watched-Folder Status (Docker/ops)
          </h4>
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

        {watcherError && (
          <div className="p-2 bg-destructive/10 border border-destructive rounded text-xs text-destructive" data-testid="watcher-status-error">
            Failed to load watcher status: {watcherError}
          </div>
        )}

        {watcherStatus && (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-4" data-testid="watcher-status-summary">
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
              <div className="font-medium mb-1 text-muted-foreground">Recent Imports</div>
              {(!watcherStatus.recentImports || watcherStatus.recentImports.length === 0) ? (
                <div className="text-muted-foreground" data-testid="watcher-status-empty">
                  No CSV drops processed yet.
                </div>
              ) : (
                <ul className="space-y-1" data-testid="watcher-status-recent-imports">
                  {watcherStatus.recentImports.slice(0, 5).map((entry, idx) => (
                    <li
                      key={`${entry.filename}-${entry.timestamp}-${idx}`}
                      className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1"
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
          </div>
        )}
      </div>
    </div>
  );
}
