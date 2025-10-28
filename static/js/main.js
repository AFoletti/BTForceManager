/*
 * BattleTech Forces Manager - Simplified Main Application
 * Clean, readable code without bloat
 */

// Core React and dependencies
import React, { useState, useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shield, Wrench, FileText, Download, Database, Users, Plus } from 'lucide-react';

// Utility functions
function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Force Management Hook
function useForceManager() {
  const [forces, setForces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForceId, setSelectedForceId] = useState(null);

  useEffect(() => {
    const loadForces = async () => {
      try {
        const manifestResponse = await fetch('./data/forces/manifest.json');
        if (!manifestResponse.ok) {
          throw new Error('Failed to load forces manifest');
        }
        const manifest = await manifestResponse.json();

        const forcePromises = manifest.forces.map(async (filename) => {
          const response = await fetch(`./data/forces/${filename}`);
          if (!response.ok) {
            console.error(`Failed to load ${filename}`);
            return null;
          }
          return response.json();
        });

        const loadedForces = await Promise.all(forcePromises);
        const validForces = loadedForces.filter(f => f !== null);

        setForces(validForces);
        
        if (validForces.length > 0) {
          setSelectedForceId(validForces[0].id);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadForces();
  }, []);

  const selectedForce = forces.find(f => f.id === selectedForceId);

  const updateForceData = (updates) => {
    setForces(prev => 
      prev.map(force =>
        force.id === selectedForceId ? { ...force, ...updates } : force
      )
    );
  };

  const addNewForce = (newForce) => {
    setForces(prev => [...prev, newForce]);
    setSelectedForceId(newForce.id);
  };

  const exportForce = (forceId) => {
    return forces.find(f => f.id === forceId);
  };

  return {
    forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    addNewForce,
    exportForce,
    loading,
    error
  };
}

// UI Components
function Button({ children, onClick, variant = 'primary', size = 'md', className = '', ...props }) {
  const baseClasses = 'inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input hover:bg-accent hover:text-accent-foreground'
  };
  
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg'
  };

  return (
    <button className={classNames(baseClasses, variants[variant], sizes[size], className)} onClick={onClick} {...props}>{children}</button>
  );
}

function Select({ children, value, onChange, className = '' }) {
  return (
    <select
      className={classNames(
        'flex h-10 w-full items-center justify-between rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
}

function Tabs({ children, defaultValue, className = '' }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  return (
    <div className={classNames('space-y-6', className)}>
      {React.Children.map(children, child => {
        if (child.type === TabsList) {
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        if (child.type === TabsContent) {
          return React.cloneElement(child, { activeTab });
        }
        return child;
      })}
    </div>
  );
}

function TabsList({ children, activeTab, setActiveTab, className = '' }) {
  return (
    <div className={classNames('inline-flex h-10 items-center justify-center rounded bg-muted p-1 text-muted-foreground', className)}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

function TabsTrigger({ children, value, activeTab, setActiveTab }) {
  const isActive = activeTab === value;
  
  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-background/60'
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({ children, value, activeTab }) {
  if (activeTab !== value) return null;
  return <div>{children}</div>;
}

// Placeholder components for simplified version
function MechRoster({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mech Roster</h3>
      <div className="grid gap-4">
        {force.mechs.map((mech, index) => (
          <div key={index} className="p-4 border rounded">
            <h4 className="font-medium">{mech.name}</h4>
            <p className="text-sm text-muted-foreground">{mech.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementalRoster({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Elemental Roster</h3>
      <div className="grid gap-4">
        {(force.elementals || []).map((elemental, index) => (
          <div key={index} className="p-4 border rounded">
            <h4 className="font-medium">{elemental.name}</h4>
            <p className="text-sm text-muted-foreground">{elemental.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PilotRoster({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pilot Roster</h3>
      <div className="grid gap-4">
        {force.pilots.map((pilot, index) => (
          <div key={index} className="p-4 border rounded">
            <h4 className="font-medium">{pilot.name}</h4>
            <p className="text-sm text-muted-foreground">Skill: {pilot.skill}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionManager({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mission Manager</h3>
      <p className="text-muted-foreground">Mission management functionality</p>
    </div>
  );
}

function DowntimeOperations({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Downtime Operations</h3>
      <p className="text-muted-foreground">Downtime operations functionality</p>
    </div>
  );
}

function DataEditor({ force, onUpdate }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Data Editor</h3>
      <textarea 
        className="w-full h-64 p-4 border rounded font-mono text-sm"
        value={JSON.stringify(force, null, 2)}
        onChange={(e) => {
          try {
            const updatedForce = JSON.parse(e.target.value);
            onUpdate(updatedForce);
          } catch (err) {
            console.error('Invalid JSON:', err);
          }
        }}
      />
    </div>
  );
}

function AddForceDialog({ open, onOpenChange, onAdd }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  if (!open) return null;
  
  const handleSubmit = () => {
    if (name.trim()) {
      const newForce = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        description: description.trim() || 'New force',
        currentWarchest: 1000,
        startingWarchest: 1000,
        mechs: [],
        elementals: [],
        pilots: []
      };
      onAdd(newForce);
      setName('');
      setDescription('');
      onOpenChange(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-md p-6 bg-card rounded-lg border border-border shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Add New Force</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Force name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              className="w-full p-2 border rounded"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Force description"
              rows="3"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">Add Force</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PDFExport({ force }) {
  const handleExport = () => {
    alert('PDF Export functionality would be implemented here');
  };
  
  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <FileText className="w-4 h-4" />
      PDF
    </Button>
  );
}

// Main Application Component
function App() {
  const {
    forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    addNewForce,
    exportForce,
    loading,
    error
  } = useForceManager();

  const [showAddForceDialog, setShowAddForceDialog] = useState(false);

  const handleExport = () => {
    if (!selectedForce) return;
    const forceData = exportForce(selectedForceId);
    const filename = `${selectedForce.id}.json`;
    downloadJSON(forceData, filename);
  };

  const handleAddForce = (newForce) => {
    addNewForce(newForce);
    alert(`✅ Force "${newForce.name}" created!\n\n⚠️ IMPORTANT: This is a session-only force.\nTo persist:\n1. Go to Data Editor tab\n2. Click "Export Force"\n3. Save as data/forces/${newForce.id}.json\n4. Add "${newForce.id}.json" to manifest.json\n5. Commit and push to GitHub`);
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
            Make sure <code className="bg-muted px-2 py-1 rounded">data/forces.json</code> exists in the repository.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                value={selectedForceId || ''} 
                onChange={(e) => setSelectedForceId(e.target.value)}
                className="w-64"
              >
                {forces.map(force => (
                  <option key={force.id} value={force.id}>
                    {force.name} (WP: {force.currentWarchest}/{force.startingWarchest})
                  </option>
                ))}
              </Select>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowAddForceDialog(true)}
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
      )}

      <main className="container mx-auto px-4 py-8">
        {selectedForce ? (
          <Tabs defaultValue="mechs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto">
              <TabsTrigger value="mechs">
                <Shield className="w-4 h-4" />
                Mechs
              </TabsTrigger>
              <TabsTrigger value="elementals">
                <Users className="w-4 h-4" />
                Elementals
              </TabsTrigger>
              <TabsTrigger value="pilots">
                <FileText className="w-4 h-4" />
                Pilots
              </TabsTrigger>
              <TabsTrigger value="missions">
                <FileText className="w-4 h-4" />
                Missions
              </TabsTrigger>
              <TabsTrigger value="downtime">
                <Wrench className="w-4 h-4" />
                Downtime
              </TabsTrigger>
              <TabsTrigger value="data">
                <Database className="w-4 h-4" />
                Data Editor
              </TabsTrigger>
            </TabsList>

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

            <TabsContent value="data">
              <DataEditor force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No forces available. Check your data/forces/ folder.</p>
          </div>
        )}
      </main>

      <AddForceDialog
        open={showAddForceDialog}
        onOpenChange={setShowAddForceDialog}
        onAdd={handleAddForce}
      />
    </div>
  );
}

// Application Entry Point
const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
