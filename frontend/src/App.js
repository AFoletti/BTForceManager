import React, { useState } from 'react';
import { Shield, Wrench, Download, Database, Users, Plus, User, Target, List, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Select } from './components/ui/select';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { downloadJSON } from './lib/utils';
import MechRoster from './components/MechRoster';
import ElementalRoster from './components/ElementalRoster';
import PilotRoster from './components/PilotRoster';
import MissionManager from './components/MissionManager';
import DowntimeOperations from './components/DowntimeOperations';
import DataEditor from './components/DataEditor';
import AddForceDialog from './components/AddForceDialog';
import PDFExport from './components/PDFExport';
import LedgerTab from './components/LedgerTab';
import NotesTab from './components/NotesTab';
import SnapshotsTab from './components/SnapshotsTab';
import { useForceManager } from './hooks/useForceManager';
import './index.css';

export default function App() {
  const {
    forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    addNewForce,
    exportForce,
    loading,
    error,
  } = useForceManager();

  const [showAddForceDialog, setShowAddForceDialog] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState('');

  const handleExport = () => {
    if (!selectedForce) return;
    const forceData = exportForce(selectedForceId);
    const filename = `${selectedForce.id}.json`;
    downloadJSON(forceData, filename);
  };

  const handleAddForce = (newForce) => {
    addNewForce(newForce);
    // eslint-disable-next-line no-alert
    alert(
      `✅ Force "${newForce.name}" created!\n\n⚠️ IMPORTANT: This is a session-only force.\nTo persist:\n1. Go to Data Editor tab\n2. Click "Export Force"\n3. Save as data/forces/${newForce.id}.json\n4. Add "${newForce.id}.json" to manifest.json\n5. Commit and push to GitHub`,
    );
  };

  const handleEditDate = () => {
    setTempDate(selectedForce?.currentDate || '');
    setEditingDate(true);
  };

  const handleSaveDate = () => {
    if (tempDate) {
      updateForceData({ currentDate: tempDate });
    }
    setEditingDate(false);
  };

  const handleCancelDate = () => {
    setTempDate('');
    setEditingDate(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-foreground">Loading forces data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold text-foreground mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Make sure{' '}
            <code className="bg-muted px-2 py-1 rounded">data/forces/manifest.json</code>{' '}
            exists in the repository.
          </p>
        </div>
      </div>
    );
  }

  const HeaderContent = () => (
    <header className="bg-card/50 backdrop-blur-sm py-4 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">BattleTech Forces Manager</h1>
              <p className="text-xs text-muted-foreground">Classic Mech &amp; Pilot Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={selectedForceId}
              onChange={(e) => setSelectedForceId(e.target.value)}
              className="w-64"
            >
              {forces.map((force) => (
                <option key={force.id} value={force.id}>
                  {force.name} (WP: {force.currentWarchest}/{force.startingWarchest})
                </option>
              ))}
            </Select>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddForceDialog(true)}
              title="Create new force"
            >
              <Plus className="w-4 h-4" />
              Add Force
            </Button>

            <PDFExport force={selectedForce} />

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-background">
      {selectedForce ? (
        <Tabs defaultValue="mechs" className="flex flex-col min-h-screen">
          {/* Sticky Header Group */}
          <div className="sticky top-0 z-50 bg-background shadow-md">
            <HeaderContent />
            
            {/* Force Info Banner */}
            <div className="border-b border-border bg-muted/20">
              <div className="container mx-auto px-4 py-6">
                <div className="flex items-start gap-6">
                  {selectedForce.image && (
                    <img
                      src={selectedForce.image}
                      alt={selectedForce.name}
                      className="max-h-32 max-w-32 rounded object-contain border-2 border-primary"
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground mb-2">{selectedForce.name}</h2>
                    <p className="text-sm text-muted-foreground mb-3">{selectedForce.description}</p>
                    <div className="mt-3 flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Current Date (in-universe):</span>
                        <Input
                          type="text"
                          data-testid="current-date-input"
                          className="font-mono text-xs w-32 h-8"
                          value={editingDate ? tempDate : (selectedForce.currentDate || '')}
                          onChange={(e) => setTempDate(e.target.value)}
                          disabled={!editingDate}
                          placeholder="3025-01-01"
                        />
                        {editingDate ? (
                          <>
                            <Button size="sm" onClick={handleSaveDate}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelDate}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={handleEditDate}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm mt-2">
                      <div>
                        <span className="text-muted-foreground">Warchest:</span>
                        <span className="ml-2 font-mono font-semibold text-primary">
                          {selectedForce.currentWarchest} WP
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Starting:</span>
                        <span className="ml-2 font-mono">{selectedForce.startingWarchest} WP</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mechs:</span>
                        <span className="ml-2 font-mono">{selectedForce.mechs.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Elementals:</span>
                        <span className="ml-2 font-mono">{selectedForce.elementals?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pilots:</span>
                        <span className="ml-2 font-mono">{selectedForce.pilots.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs List */}
            <div className="bg-background border-b border-border">
              <div className="container mx-auto px-4 py-2">
                <TabsList className="grid w-full grid-cols-9 lg:w-auto">
                  <TabsTrigger value="mechs">
                    <Shield className="w-4 h-4" />
                    Mechs
                  </TabsTrigger>
                  <TabsTrigger value="elementals">
                    <Users className="w-4 h-4" />
                    Elementals
                  </TabsTrigger>
                  <TabsTrigger value="pilots">
                    <User className="w-4 h-4" />
                    Pilots
                  </TabsTrigger>
                  <TabsTrigger value="missions">
                    <Target className="w-4 h-4" />
                    Missions
                  </TabsTrigger>
                  <TabsTrigger value="downtime">
                    <Wrench className="w-4 h-4" />
                    Downtime
                  </TabsTrigger>
                  <TabsTrigger value="ledger">
                    <List className="w-4 h-4" />
                    Ledger
                  </TabsTrigger>
                  <TabsTrigger value="notes" data-testid="force-notes-tab">
                    <FileText className="w-4 h-4" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="snapshots" data-testid="snapshots-tab">
                    <FileText className="w-4 h-4" />
                    Snapshots
                  </TabsTrigger>
                  <TabsTrigger value="data">
                    <Database className="w-4 h-4" />
                    Data Editor
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8 flex-1">
            <TabsContent value="mechs">
              <MechRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="elementals">
              <ElementalRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="pilots">
              <PilotRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="missions">
              <MissionManager force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="downtime">
              <DowntimeOperations force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="ledger">
              <LedgerTab force={selectedForce} />
            </TabsContent>

            <TabsContent value="notes">
              <NotesTab force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="snapshots">
              <SnapshotsTab force={selectedForce} />
            </TabsContent>

            <TabsContent value="data">
              <DataEditor force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>
          </main>
        </Tabs>
      ) : (
        <>
          <HeaderContent />
          <div className="container mx-auto px-4 py-12">
            <div className="text-center text-muted-foreground">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No forces available. Check your data/forces/ folder.</p>
            </div>
          </div>
        </>
      )}

      {/* Add Force Dialog */}
      <AddForceDialog
        open={showAddForceDialog}
        onOpenChange={setShowAddForceDialog}
        onAdd={handleAddForce}
      />
    </div>
  );
}
