import React, { useState } from 'react';
import { Shield, Wrench, Download, Database, Users, Plus, User, Target, List, FileText, Calendar, Crosshair } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Select } from './components/ui/select';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { downloadJSON, formatNumber } from './lib/utils';
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
import { UNIT_STATUS } from './lib/constants';
import { getMechAdjustedBV } from './lib/mechs';
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

  const STATUS_ORDER = [
    UNIT_STATUS.OPERATIONAL,
    UNIT_STATUS.DAMAGED,
    UNIT_STATUS.DISABLED,
    UNIT_STATUS.REPAIRING,
    UNIT_STATUS.UNAVAILABLE,
    UNIT_STATUS.DESTROYED,
  ];

  const STATUS_LABELS = {
    [UNIT_STATUS.OPERATIONAL]: 'OPR',
    [UNIT_STATUS.DAMAGED]: 'DMG',
    [UNIT_STATUS.DISABLED]: 'DIS',
    [UNIT_STATUS.REPAIRING]: 'REP',
    [UNIT_STATUS.UNAVAILABLE]: 'UNV',
    [UNIT_STATUS.DESTROYED]: 'DES',
  };

  const getStatusCounts = (units = []) => {
    const counts = STATUS_ORDER.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    units.forEach((unit) => {
      const status = unit.status || UNIT_STATUS.OPERATIONAL;
      if (STATUS_ORDER.includes(status)) {
        counts[status] += 1;
      }
    });

    return counts;
  };


  const [showAddForceDialog, setShowAddForceDialog] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState('');

  const mechStatusCounts = selectedForce ? getStatusCounts(selectedForce.mechs || []) : null;
  const elementalStatusCounts = selectedForce ? getStatusCounts(selectedForce.elementals || []) : null;

  // Calculate total BV (base) and adjusted BV for the force
  const calculateForceBV = () => {
    if (!selectedForce) return { baseBV: 0, adjustedBV: 0 };
    
    const mechs = selectedForce.mechs || [];
    const elementals = selectedForce.elementals || [];
    
    const mechBaseBV = mechs
      .filter(m => m.status !== UNIT_STATUS.DESTROYED)
      .reduce((sum, mech) => sum + (mech.bv || 0), 0);
    
    const mechAdjustedBV = mechs
      .filter(m => m.status !== UNIT_STATUS.DESTROYED)
      .reduce((sum, mech) => sum + getMechAdjustedBV(selectedForce, mech), 0);
    
    const elementalBV = elementals
      .filter(e => e.status !== UNIT_STATUS.DESTROYED)
      .reduce((sum, e) => sum + (e.bv || 0), 0);
    
    return {
      baseBV: mechBaseBV + elementalBV,
      adjustedBV: mechAdjustedBV + elementalBV
    };
  };

  const forceBV = calculateForceBV();

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

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Crosshair className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
            <div className="absolute inset-0 w-20 h-20 mx-auto border-2 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <p className="font-heading text-lg uppercase tracking-widest text-muted-foreground">
            Initializing Command Interface
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="tactical-panel p-8 max-w-md text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="font-heading text-xl font-bold uppercase tracking-wider text-destructive mb-2">
            System Error
          </h2>
          <p className="text-muted-foreground mb-4 font-mono text-sm">{error}</p>
          <p className="text-xs text-muted-foreground font-mono">
            Verify: <code className="bg-muted px-2 py-1">data/forces/manifest.json</code>
          </p>
        </div>
      </div>
    );
  }

  // Status Bar Component
  const StatusBar = ({ counts, label }) => (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2 w-6">{label}</span>
      {STATUS_ORDER.map((status) => {
        const count = counts?.[status] || 0;
        const isActive = count > 0;
        return (
          <div
            key={status}
            className={`flex flex-col items-center px-1.5 py-0.5 border ${
              isActive 
                ? status === UNIT_STATUS.OPERATIONAL ? 'border-operational/50 bg-operational/10'
                : status === UNIT_STATUS.DAMAGED ? 'border-damaged/50 bg-damaged/10'
                : status === UNIT_STATUS.DESTROYED ? 'border-red-900/50 bg-red-900/20'
                : status === UNIT_STATUS.REPAIRING ? 'border-repairing/50 bg-repairing/10'
                : 'border-critical/50 bg-critical/10'
                : 'border-border/30 bg-transparent'
            }`}
            title={status}
          >
            <span className="text-[9px] text-muted-foreground uppercase">{STATUS_LABELS[status]}</span>
            <span className={`font-mono text-xs font-bold ${
              isActive
                ? status === UNIT_STATUS.OPERATIONAL ? 'text-operational'
                : status === UNIT_STATUS.DAMAGED ? 'text-damaged'
                : status === UNIT_STATUS.DESTROYED ? 'text-red-400'
                : status === UNIT_STATUS.REPAIRING ? 'text-repairing'
                : 'text-critical'
                : 'text-muted-foreground/50'
            }`}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {selectedForce ? (
        <Tabs defaultValue="mechs" className="flex flex-col min-h-screen">
          {/* === COMMAND HEADER === */}
          <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40">
            {/* Top Bar */}
            <div className="h-14 border-b border-border/30 px-6 flex items-center justify-between">
              {/* Logo & Title */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/20 border border-primary/40 flex items-center justify-center">
                    <Crosshair className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="font-heading text-base font-bold uppercase tracking-wider text-foreground">
                      BattleTech Forces Manager
                    </h1>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Classic Mech &amp; Pilot Management System
                    </p>
                  </div>
                </div>
              </div>

              {/* Force Selector & Actions */}
              <div className="flex items-center gap-3">
                <Select
                  value={selectedForceId}
                  onChange={(e) => setSelectedForceId(e.target.value)}
                  className="w-64 font-mono text-sm bg-input border-border/60"
                  data-testid="force-selector"
                >
                  {forces.map((force) => (
                    <option key={force.id} value={force.id}>
                      {force.name}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForceDialog(true)}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                  data-testid="add-force-btn"
                >
                  <Plus className="w-4 h-4" />
                </Button>

                <PDFExport force={selectedForce} />

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport}
                  className="border-border/60 hover:border-primary/40"
                  data-testid="export-btn"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Force Info Banner */}
            <div className="px-6 py-4 bg-card/50">
              <div className="flex items-start gap-6">
                {/* Force Image */}
                {selectedForce.image && (
                  <div className="relative hud-corners">
                    <img
                      src={selectedForce.image}
                      alt={selectedForce.name}
                      className="h-28 w-28 object-contain border border-border/60"
                    />
                  </div>
                )}

                {/* Force Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-foreground">
                        {selectedForce.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        {selectedForce.description}
                      </p>
                    </div>

                    {/* Special Abilities */}
                    {selectedForce.specialAbilities && selectedForce.specialAbilities.length > 0 && (
                      <div className="border border-primary/30 bg-primary/5 p-3 min-w-48">
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                          Special Abilities
                        </h3>
                        <div className="space-y-1">
                          {selectedForce.specialAbilities.map((ability, index) => (
                            <div key={index} className="text-xs">
                              <span className="font-medium text-foreground">{ability.title}:</span>
                              <span className="text-muted-foreground ml-1">{ability.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-4 flex flex-wrap items-center gap-6">
                    {/* Date */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {editingDate ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            data-testid="current-date-input"
                            className="font-mono text-xs w-28 h-7 bg-input"
                            value={tempDate}
                            onChange={(e) => setTempDate(e.target.value)}
                            placeholder="3025-01-01"
                          />
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveDate}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleCancelDate}>Cancel</Button>
                        </div>
                      ) : (
                        <button
                          onClick={handleEditDate}
                          className="font-mono text-sm text-foreground hover:text-primary transition-colors"
                        >
                          {selectedForce.currentDate || 'Set Date'}
                        </button>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-border/40" />

                    {/* Warchest */}
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Warchest</div>
                        <div className="font-mono text-lg font-bold text-primary glow-text">
                          {formatNumber(selectedForce.currentWarchest)} <span className="text-xs text-muted-foreground">WP</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        / {formatNumber(selectedForce.startingWarchest)}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-border/40" />

                    {/* BV Stats */}
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Base BV</div>
                        <div className="font-mono text-sm text-foreground">{formatNumber(forceBV.baseBV)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Adjusted BV</div>
                        <div className="font-mono text-sm font-semibold text-secondary">{formatNumber(forceBV.adjustedBV)}</div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-border/40" />

                    {/* Status Bars */}
                    <div className="flex flex-col gap-1">
                      <StatusBar counts={mechStatusCounts} label="M" />
                      <StatusBar counts={elementalStatusCounts} label="E" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 py-2 bg-muted/20 border-t border-border/30">
              <TabsList className="bg-transparent gap-1">
                <TabsTrigger value="mechs" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Shield className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Mechs</span>
                </TabsTrigger>
                <TabsTrigger value="elementals" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Users className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Elementals</span>
                </TabsTrigger>
                <TabsTrigger value="pilots" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <User className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Pilots</span>
                </TabsTrigger>
                <TabsTrigger value="missions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Target className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Missions</span>
                </TabsTrigger>
                <TabsTrigger value="downtime" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Wrench className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Downtime</span>
                </TabsTrigger>
                <TabsTrigger value="ledger" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <List className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Ledger</span>
                </TabsTrigger>
                <TabsTrigger value="notes" data-testid="force-notes-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <FileText className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="snapshots" data-testid="snapshots-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Database className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Snapshots</span>
                </TabsTrigger>
                <TabsTrigger value="data" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent px-4">
                  <Database className="w-4 h-4" />
                  <span className="font-heading uppercase tracking-wider">Data</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </header>

          {/* === MAIN CONTENT === */}
          <main className="flex-1 p-6 max-w-[1920px] mx-auto w-full">
            <TabsContent value="mechs" className="mt-0">
              <MechRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="elementals" className="mt-0">
              <ElementalRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="pilots" className="mt-0">
              <PilotRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="missions" className="mt-0">
              <MissionManager force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="downtime" className="mt-0">
              <DowntimeOperations force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="ledger" className="mt-0">
              <LedgerTab force={selectedForce} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NotesTab force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="snapshots" className="mt-0">
              <SnapshotsTab force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="data" className="mt-0">
              <DataEditor force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>
          </main>

          {/* Footer */}
          <footer className="border-t border-border/30 px-6 py-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              BattleTech Forces Manager • Orbital Command Interface • All Rights Reserved
            </p>
          </footer>
        </Tabs>
      ) : (
        <div className="min-h-screen flex flex-col">
          <header className="h-14 border-b border-border/40 px-6 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Crosshair className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-heading text-base font-bold uppercase tracking-wider">
                BattleTech Forces Manager
              </h1>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="tactical-panel p-12 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="font-heading uppercase tracking-wider text-muted-foreground">
                No forces available
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Check data/forces/ directory
              </p>
            </div>
          </div>
        </div>
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
