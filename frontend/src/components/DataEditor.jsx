import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Database, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

export default function DataEditor({ force, onUpdate }) {
  const [mechsJSON, setMechsJSON] = useState(JSON.stringify(force.mechs, null, 2));
  const [pilotsJSON, setPilotsJSON] = useState(JSON.stringify(force.pilots, null, 2));
  const [repairActionsJSON, setRepairActionsJSON] = useState(
    JSON.stringify(force.repairActions || [], null, 2)
  );
  const [forceMetaJSON, setForceMetaJSON] = useState(
    JSON.stringify({
      name: force.name,
      description: force.description,
      image: force.image,
      startingWarchest: force.startingWarchest,
      currentWarchest: force.currentWarchest
    }, null, 2)
  );

  const [error, setError] = useState('');

  const handleSave = (type) => {
    setError('');
    try {
      let updates = {};
      
      switch(type) {
        case 'mechs':
          updates.mechs = JSON.parse(mechsJSON);
          break;
        case 'pilots':
          updates.pilots = JSON.parse(pilotsJSON);
          break;
        case 'repairs':
          updates.repairActions = JSON.parse(repairActionsJSON);
          break;
        case 'meta':
          updates = JSON.parse(forceMetaJSON);
          break;
        default:
          return;
      }
      
      onUpdate(updates);
      alert('✅ Data saved to session!\n\n⚠️ IMPORTANT: This only updates the current session.\nTo persist changes permanently:\n1. Click Export in the header\n2. Replace data/forces.json in your repository\n3. Commit and push to GitHub');
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleReset = (type) => {
    switch(type) {
      case 'mechs':
        setMechsJSON(JSON.stringify(force.mechs, null, 2));
        break;
      case 'pilots':
        setPilotsJSON(JSON.stringify(force.pilots, null, 2));
        break;
      case 'repairs':
        setRepairActionsJSON(JSON.stringify(force.repairActions || [], null, 2));
        break;
      case 'meta':
        setForceMetaJSON(JSON.stringify({
          name: force.name,
          description: force.description,
          image: force.image,
          startingWarchest: force.startingWarchest,
          currentWarchest: force.currentWarchest
        }, null, 2));
        break;
    }
    setError('');
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
              Changes made here only affect your current browser session. To make permanent changes:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-amber-100/80 ml-2">
              <li>Make your edits and click Save</li>
              <li>Click <strong>Export</strong> button in the header to download JSON</li>
              <li>Replace <code className="bg-amber-950/50 px-1.5 py-0.5 rounded text-xs">data/forces.json</code> in your repository</li>
              <li>Commit and push to GitHub</li>
              <li>GitHub Pages will serve the updated data</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="tactical-panel">
        <div className="tactical-header">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" />
              Session Data Editor
            </h3>
            <div className="text-xs text-muted-foreground">
              Edit current session data
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="mechs">
            <TabsList className="mb-4">
              <TabsTrigger value="mechs">Mechs</TabsTrigger>
              <TabsTrigger value="pilots">Pilots</TabsTrigger>
              <TabsTrigger value="repairs">Repair Actions</TabsTrigger>
              <TabsTrigger value="meta">Force Info</TabsTrigger>
            </TabsList>

            <TabsContent value="mechs">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Edit mechs JSON. Each mech should have: id, name, status, pilot, bv, weight, image (optional), activityLog
                  </div>
                  <Textarea
                    value={mechsJSON}
                    onChange={(e) => setMechsJSON(e.target.value)}
                    className="font-mono text-xs"
                    rows={20}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSave('mechs')}>
                    <Save className="w-4 h-4" />
                    Save to Session
                  </Button>
                  <Button variant="outline" onClick={() => handleReset('mechs')}>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pilots">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Edit pilots JSON. Each pilot should have: id, name, gunnery, piloting, injuries, activityLog
                  </div>
                  <Textarea
                    value={pilotsJSON}
                    onChange={(e) => setPilotsJSON(e.target.value)}
                    className="font-mono text-xs"
                    rows={20}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSave('pilots')}>
                    <Save className="w-4 h-4" />
                    Save to Session
                  </Button>
                  <Button variant="outline" onClick={() => handleReset('pilots')}>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="repairs">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Edit repair actions JSON. Each action should have: id, name, formula (use 'weight' variable), makesUnavailable (boolean)
                    <div className="mt-2 p-3 bg-muted/30 rounded text-xs">
                      <div className="font-semibold mb-1">Example formulas:</div>
                      <div>• Simple: "weight/5" or "weight*2"</div>
                      <div>• Complex: "(weight*20)/5" or "weight/3 + 10"</div>
                    </div>
                  </div>
                  <Textarea
                    value={repairActionsJSON}
                    onChange={(e) => setRepairActionsJSON(e.target.value)}
                    className="font-mono text-xs"
                    rows={20}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSave('repairs')}>
                    <Save className="w-4 h-4" />
                    Save to Session
                  </Button>
                  <Button variant="outline" onClick={() => handleReset('repairs')}>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="meta">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Edit force metadata: name, description, image, startingWarchest, currentWarchest
                  </div>
                  <Textarea
                    value={forceMetaJSON}
                    onChange={(e) => setForceMetaJSON(e.target.value)}
                    className="font-mono text-xs"
                    rows={15}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSave('meta')}>
                    <Save className="w-4 h-4" />
                    Save to Session
                  </Button>
                  <Button variant="outline" onClick={() => handleReset('meta')}>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
