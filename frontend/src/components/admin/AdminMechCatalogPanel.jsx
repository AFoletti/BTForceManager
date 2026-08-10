import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '../ui/button';
import * as api from '../../lib/api';

export default function AdminMechCatalogPanel() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
    </div>
  );
}
