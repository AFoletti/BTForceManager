import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus } from 'lucide-react';

export default function AddForceDialog({ open, onOpenChange, onAdd }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    startingWarchest: 1000,
    wpMultiplier: 5
  });

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Force name is required');
      return;
    }

    // Create force ID from name
    const forceId = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newForce = {
      id: forceId,
      name: formData.name,
      description: formData.description,
      image: formData.image,
      startingWarchest: formData.startingWarchest,
      currentWarchest: formData.startingWarchest,
      wpMultiplier: formData.wpMultiplier,
      otherActionsLog: [],
      mechs: [],
      elementals: [],
      pilots: [],
      missions: [],
      repairActions: []
    };

    onAdd(newForce);
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      image: '',
      startingWarchest: 1000,
      wpMultiplier: 5
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Force
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Force Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Wolf's Dragoons"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the force..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image URL (optional)</label>
            <Input
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Starting Warchest (WP)</label>
              <Input
                type="number"
                value={formData.startingWarchest}
                onChange={(e) => setFormData({ ...formData, startingWarchest: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">WP Multiplier</label>
              <Input
                type="number"
                value={formData.wpMultiplier}
                onChange={(e) => setFormData({ ...formData, wpMultiplier: parseFloat(e.target.value) || 1 })}
                min="1"
                step="0.5"
              />
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded text-sm">
            <p className="text-muted-foreground">
              This will create an empty force ready to be populated with mechs, elementals, and pilots.
              You can add units using the Data Editor tab after creation.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              Create Force
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
