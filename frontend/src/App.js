import React from 'react';
import { Shield, Wrench, FileText, Download, Upload, Database } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Select } from './components/ui/select';
import { Button } from './components/ui/button';
import { downloadJSON } from './lib/utils';
import MechRoster from './components/MechRoster';
import PilotRoster from './components/PilotRoster';
import MissionManager from './components/MissionManager';
import RepairBay from './components/RepairBay';
import DataEditor from './components/DataEditor';
import { useForceManager } from './hooks/useForceManager';
import './index.css';

export default function App() {
  const {
    forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    exportData,
    importData
  } = useForceManager();

  const handleExport = () => {
    const data = exportData();
    downloadJSON(data, `battletech-forces-${Date.now()}.json`);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        importData(data);
        alert('Data imported successfully!');
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">BattleTech Forces Manager</h1>
                <p className="text-xs text-muted-foreground">Classic Mech & Pilot Management System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select 
                value={selectedForceId} 
                onChange={(e) => setSelectedForceId(e.target.value)}
                className="w-64"
              >
                {forces.map(force => (
                  <option key={force.id} value={force.id}>
                    {force.name} (WP: {force.currentWarchest}/{force.startingWarchest})
                  </option>
                ))}
              </Select>
              
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export
              </Button>
              
              <label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button variant="outline" size="sm" as="span" onClick={(e) => e.currentTarget.previousElementSibling.click()}>
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Force Info Banner */}
      {selectedForce && (
        <div className="border-b border-border bg-muted/20">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-start gap-6">
              {selectedForce.image && (
                <img 
                  src={selectedForce.image} 
                  alt={selectedForce.name}
                  className="w-32 h-32 rounded object-cover border-2 border-primary"
                />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">{selectedForce.name}</h2>
                <p className="text-sm text-muted-foreground mb-3">{selectedForce.description}</p>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Warchest:</span>
                    <span className="ml-2 font-mono font-semibold text-primary">{selectedForce.currentWarchest} WP</span>
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
                    <span className="text-muted-foreground">Pilots:</span>
                    <span className="ml-2 font-mono">{selectedForce.pilots.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {selectedForce ? (
          <Tabs defaultValue="mechs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto">
              <TabsTrigger value="mechs">
                <Shield className="w-4 h-4" />
                Mechs
              </TabsTrigger>
              <TabsTrigger value="pilots">
                <FileText className="w-4 h-4" />
                Pilots
              </TabsTrigger>
              <TabsTrigger value="missions">
                <FileText className="w-4 h-4" />
                Missions
              </TabsTrigger>
              <TabsTrigger value="repair">
                <Wrench className="w-4 h-4" />
                Repair Bay
              </TabsTrigger>
              <TabsTrigger value="data">
                <Database className="w-4 h-4" />
                Data Editor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mechs">
              <MechRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="pilots">
              <PilotRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="missions">
              <MissionManager force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="repair">
              <RepairBay force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="data">
              <DataEditor force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No forces available. Import data to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
