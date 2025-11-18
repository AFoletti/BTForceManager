/*
 * BattleTech Forces Manager - Static Browser Version
 * No imports/require, works with React + Babel from CDN
 */

// Use React globals provided by CDN
const { useState, useEffect, StrictMode } = React;
const { createRoot } = ReactDOM;

// ----------------------
// Utility helpers
// ----------------------
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
    minute: '2-digit',
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

// ----------------------
// Simple inline icons (no external library)
// ----------------------
function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
    </svg>
  );
}

function IconWrench(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.66 0L4 11.34V20h8.66l5.04-5.04a4 4 0 0 0 0-5.66" />
      <path d="M16 5l3 3" />
    </svg>
  );
}

function IconFileText(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function IconDownload(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function IconDatabase(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </svg>
  );
}

function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

// ----------------------
// Force Management Hook
// ----------------------
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
        const validForces = loadedForces.filter(function (f) { return f !== null; });

        setForces(validForces);

        if (validForces.length > 0) {
          setSelectedForceId(validForces[0].id);
        }

        setLoading(false);
      } catch (err) {
        setError(err.message || 'Unknown error');
        setLoading(false);
      }
    };

    loadForces();
  }, []);

  const selectedForce = forces.find(function (f) { return f.id === selectedForceId; }) || null;

  const updateForceData = function (updates) {
    setForces(function (prev) {
      return prev.map(function (force) {
        return force.id === selectedForceId ? Object.assign({}, force, updates) : force;
      });
    });
  };

  const addNewForce = function (newForce) {
    setForces(function (prev) { return prev.concat([newForce]); });
    setSelectedForceId(newForce.id);
  };

  const exportForce = function (forceId) {
    return forces.find(function (f) { return f.id === forceId; }) || null;
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
    error,
  };
}

// ----------------------
// UI Components
// ----------------------
function Button(props) {
  const { children, onClick, variant, size, className, ...rest } = props;
  const baseClasses = 'inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:pointer-events-none gap-2';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg',
  };

  const variantClass = variants[variant] || variants.primary;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button
      type="button"
      className={classNames(baseClasses, variantClass, sizeClass, className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

function Select(props) {
  const { children, value, onChange, className, ...rest } = props;
  return (
    <select
      className={classNames(
        'flex h-10 w-full items-center justify-between rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      value={value}
      onChange={onChange}
      {...rest}
    >
      {children}
    </select>
  );
}

function Tabs(props) {
  const { children, defaultValue, className } = props;
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <div className={classNames('space-y-6', className)} data-testid="tabs-root">
      {React.Children.map(children, function (child) {
        if (!child) return null;
        if (child.type === TabsList) {
          return React.cloneElement(child, { activeTab: activeTab, setActiveTab: setActiveTab });
        }
        if (child.type === TabsContent) {
          return React.cloneElement(child, { activeTab: activeTab });
        }
        return child;
      })}
    </div>
  );
}

function TabsList(props) {
  const { children, activeTab, setActiveTab, className } = props;
  return (
    <div
      className={classNames('inline-flex h-10 items-center justify-center rounded bg-muted p-1 text-muted-foreground', className)}
      data-testid="tabs-list"
    >
      {React.Children.map(children, function (child) {
        if (!child) return null;
        return React.cloneElement(child, { activeTab: activeTab, setActiveTab: setActiveTab });
      })}
    </div>
  );
}

function TabsTrigger(props) {
  const { children, value, activeTab, setActiveTab, testId } = props;
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      className={classNames(
        'inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 gap-2',
        isActive ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/60'
      )}
      onClick={function () { setActiveTab(value); }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function TabsContent(props) {
  const { children, value, activeTab, testId } = props;
  if (activeTab !== value) return null;
  return (
    <div data-testid={testId}>
      {children}
    </div>
  );
}

// ----------------------
// Feature sections
// ----------------------
function MechRoster(props) {
  const { force } = props;
  return (
    <div className="space-y-4" data-testid="mech-roster">
      <h3 className="text-lg font-semibold">Mech Roster</h3>
      <div className="grid gap-4">
        {force.mechs.map(function (mech, index) {
          return (
            <div key={index} className="p-4 border rounded tactical-panel" data-testid="mech-roster-item">
              <h4 className="font-medium">{mech.name}</h4>
              <p className="text-sm text-muted-foreground">{mech.type}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElementalRoster(props) {
  const { force } = props;
  return (
    <div className="space-y-4" data-testid="elemental-roster">
      <h3 className="text-lg font-semibold">Elemental Roster</h3>
      <div className="grid gap-4">
        {(force.elementals || []).map(function (elemental, index) {
          return (
            <div key={index} className="p-4 border rounded tactical-panel" data-testid="elemental-roster-item">
              <h4 className="font-medium">{elemental.name}</h4>
              <p className="text-sm text-muted-foreground">{elemental.type}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PilotRoster(props) {
  const { force } = props;
  return (
    <div className="space-y-4" data-testid="pilot-roster">
      <h3 className="text-lg font-semibold">Pilot Roster</h3>
      <div className="grid gap-4">
        {force.pilots.map(function (pilot, index) {
          return (
            <div key={index} className="p-4 border rounded tactical-panel" data-testid="pilot-roster-item">
              <h4 className="font-medium">{pilot.name}</h4>
              <p className="text-sm text-muted-foreground">Skill: {pilot.skill}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionManager(props) {
  const { force } = props;
  return (
    <div className="space-y-4" data-testid="mission-manager">
      <h3 className="text-lg font-semibold">Mission Manager</h3>
      <p className="text-muted-foreground">
        Mission management functionality for {force.name} would be implemented here.
      </p>
    </div>
  );
}

function DowntimeOperations(props) {
  const { force } = props;
  return (
    <div className="space-y-4" data-testid="downtime-operations">
      <h3 className="text-lg font-semibold">Downtime Operations</h3>
      <p className="text-muted-foreground">
        Downtime operations functionality for {force.name} would be implemented here.
      </p>
    </div>
  );
}

function DataEditor(props) {
  const { force, onUpdate } = props;
  return (
    <div className="space-y-4" data-testid="data-editor">
      <h3 className="text-lg font-semibold">Data Editor</h3>
      <textarea
        className="w-full h-64 p-4 border rounded font-mono text-sm bg-input"
        value={JSON.stringify(force, null, 2)}
        onChange={function (e) {
          try {
            const updatedForce = JSON.parse(e.target.value);
            onUpdate(updatedForce);
          } catch (err) {
            console.error('Invalid JSON:', err);
          }
        }}
        data-testid="data-editor-textarea"
      />
    </div>
  );
}

function AddForceDialog(props) {
  const { open, onOpenChange, onAdd } = props;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!open) return null;

  const handleSubmit = function () {
    if (name.trim()) {
      const newForce = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        description: description.trim() || 'New force',
        currentWarchest: 1000,
        startingWarchest: 1000,
        mechs: [],
        elementals: [],
        pilots: [],
      };
      onAdd(newForce);
      setName('');
      setDescription('');
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="add-force-dialog">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={function () { onOpenChange(false); }}
        data-testid="add-force-dialog-backdrop"
      />
      <div className="relative z-50 w-full max-w-md p-6 bg-card rounded-lg border border-border shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Add New Force</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="add-force-name">Name</label>
            <input
              id="add-force-name"
              type="text"
              className="w-full p-2 border rounded bg-input"
              value={name}
              onChange={function (e) { setName(e.target.value); }}
              placeholder="Force name"
              data-testid="add-force-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="add-force-description">Description</label>
            <textarea
              id="add-force-description"
              className="w-full p-2 border rounded bg-input"
              value={description}
              onChange={function (e) { setDescription(e.target.value); }}
              placeholder="Force description"
              rows="3"
              data-testid="add-force-description-input"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              className="flex-1"
              data-testid="add-force-dialog-submit-button"
            >
              Add Force
            </Button>
            <Button
              variant="outline"
              onClick={function () { onOpenChange(false); }}
              data-testid="add-force-dialog-cancel-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PDFExport(props) {
  const { force } = props;
  const handleExport = function () {
    if (!force) return;
    // Placeholder: real PDF export would require a library and build step
    window.alert('PDF Export placeholder. In a build-based setup, a PDF would be generated here.');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      data-testid="pdf-export-button"
    >
      <IconFileText className="w-4 h-4" />
      PDF
    </Button>
  );
}

// ----------------------
// Main Application Component
// ----------------------
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
    error,
  } = useForceManager();

  const [showAddForceDialog, setShowAddForceDialog] = useState(false);

  const handleExport = function () {
    if (!selectedForce) return;
    const forceData = exportForce(selectedForceId);
    if (!forceData) return;
    const filename = selectedForce.id + '.json';
    downloadJSON(forceData, filename);
  };

  const handleAddForce = function (newForce) {
    addNewForce(newForce);
    window.alert(
      'Force "' +
        newForce.name +
        '" created!\n\n' +
        'IMPORTANT: This is a session-only force. To persist it:\n' +
        '1. Go to Data Editor tab\n' +
        '2. Click "Export" to download JSON\n' +
        '3. Save as data/forces/' +
        newForce.id +
        '.json in the repository' +
        '\n4. Add "' +
        newForce.id +
        '.json" to data/forces/manifest.json\n5. Commit and push to GitHub'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <IconShield className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-foreground">Loading forces data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="error-state">
        <div className="text-center max-w-md">
          <IconShield className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold text-foreground mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Make sure <code className="bg-muted px-2 py-1 rounded">data/forces/manifest.json</code> exists in the repository
            and the listed JSON files are present.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="app-root">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40" data-testid="app-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" data-testid="app-title-block">
              <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
                <IconShield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight" data-testid="app-title">
                  BattleTech Forces Manager
                </h1>
                <p className="text-xs text-muted-foreground" data-testid="app-subtitle">
                  Classic Mech &amp; Pilot Management System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3" data-testid="app-controls">
              <Select
                value={selectedForceId || ''}
                onChange={function (e) { setSelectedForceId(e.target.value); }}
                className="w-64"
                data-testid="force-select"
              >
                {forces.map(function (force) {
                  return (
                    <option key={force.id} value={force.id} data-testid={"force-option-" + force.id}>
                      {force.name} (WP: {force.currentWarchest}/{force.startingWarchest})
                    </option>
                  );
                })}
              </Select>

              <Button
                variant="secondary"
                size="sm"
                onClick={function () { setShowAddForceDialog(true); }}
                title="Create new force"
                data-testid="add-force-button"
              >
                <IconPlus className="w-4 h-4" />
                Add Force
              </Button>

              <PDFExport force={selectedForce} />

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                data-testid="export-force-button"
              >
                <IconDownload className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Force Info Banner */}
      {selectedForce && (
        <div className="border-b border-border bg-muted/20" data-testid="force-summary">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-start gap-6">
              {selectedForce.image && (
                <img
                  src={selectedForce.image}
                  alt={selectedForce.name}
                  className="w-32 h-32 rounded object-cover border-2 border-primary"
                  data-testid="force-image"
                />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="force-name">
                  {selectedForce.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-3" data-testid="force-description">
                  {selectedForce.description}
                </p>
                <div className="flex flex-wrap items-center gap-6 text-sm" data-testid="force-stats">
                  <div data-testid="force-warchest">
                    <span className="text-muted-foreground">Warchest:</span>
                    <span className="ml-2 font-mono font-semibold text-primary">
                      {formatNumber(selectedForce.currentWarchest)} WP
                    </span>
                  </div>
                  <div data-testid="force-starting-warchest">
                    <span className="text-muted-foreground">Starting:</span>
                    <span className="ml-2 font-mono">
                      {formatNumber(selectedForce.startingWarchest)} WP
                    </span>
                  </div>
                  <div data-testid="force-mech-count">
                    <span className="text-muted-foreground">Mechs:</span>
                    <span className="ml-2 font-mono">{selectedForce.mechs.length}</span>
                  </div>
                  <div data-testid="force-elemental-count">
                    <span className="text-muted-foreground">Elementals:</span>
                    <span className="ml-2 font-mono">{selectedForce.elementals ? selectedForce.elementals.length : 0}</span>
                  </div>
                  <div data-testid="force-pilot-count">
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
      <main className="container mx-auto px-4 py-8" data-testid="app-main">
        {selectedForce ? (
          <Tabs defaultValue="mechs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto">
              <TabsTrigger value="mechs" testId="tab-trigger-mechs">
                <IconShield className="w-4 h-4" />
                Mechs
              </TabsTrigger>
              <TabsTrigger value="elementals" testId="tab-trigger-elementals">
                <IconUsers className="w-4 h-4" />
                Elementals
              </TabsTrigger>
              <TabsTrigger value="pilots" testId="tab-trigger-pilots">
                <IconFileText className="w-4 h-4" />
                Pilots
              </TabsTrigger>
              <TabsTrigger value="missions" testId="tab-trigger-missions">
                <IconFileText className="w-4 h-4" />
                Missions
              </TabsTrigger>
              <TabsTrigger value="downtime" testId="tab-trigger-downtime">
                <IconWrench className="w-4 h-4" />
                Downtime
              </TabsTrigger>
              <TabsTrigger value="data" testId="tab-trigger-data">
                <IconDatabase className="w-4 h-4" />
                Data Editor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mechs" testId="tab-content-mechs">
              <MechRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="elementals" testId="tab-content-elementals">
              <ElementalRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="pilots" testId="tab-content-pilots">
              <PilotRoster force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="missions" testId="tab-content-missions">
              <MissionManager force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="downtime" testId="tab-content-downtime">
              <DowntimeOperations force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>

            <TabsContent value="data" testId="tab-content-data">
              <DataEditor force={selectedForce} onUpdate={updateForceData} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="no-forces-state">
            <IconShield className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No forces available. Check your data/forces/ folder.</p>
          </div>
        )}
      </main>

      {/* Add Force Dialog */}
      <AddForceDialog
        open={showAddForceDialog}
        onOpenChange={setShowAddForceDialog}
        onAdd={handleAddForce}
      />
    </div>
  );
}

// ----------------------
// Application Entry Point
// ----------------------
var rootElement = document.getElementById('root');
if (rootElement) {
  var root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
