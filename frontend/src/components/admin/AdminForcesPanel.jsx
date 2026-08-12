import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import ImageUploadField from '../ui/image-upload-field';
import * as api from '../../lib/api';

const emptyForm = {
  name: '',
  description: '',
  currentImageUrl: '',
  imageFile: null,
  removeImage: false,
  startingWarchest: 1000,
  wpMultiplier: 10,
  startingDate: '3025-01-01',
  specialAbilitiesText: '',
};

function abilitiesToText(specialAbilities) {
  return (specialAbilities || []).map((a) => `${a.title}: ${a.description || ''}`.trim()).join('\n');
}

export default function AdminForcesPanel({ forces, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (force) => {
    setEditingId(force.id);
    setForm({
      name: force.name || '',
      description: force.description || '',
      currentImageUrl: force.image || '',
      imageFile: null,
      removeImage: false,
      startingWarchest: force.startingWarchest || 0,
      wpMultiplier: force.wpMultiplier || 10,
      startingDate: force.startingDate || '3025-01-01',
      specialAbilitiesText: abilitiesToText(force.specialAbilities),
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Force name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let forceId = editingId;
      if (editingId) {
        await api.updateForce(editingId, {
          name: form.name,
          description: form.description,
          startingWarchest: Number(form.startingWarchest) || 0,
          wpMultiplier: Number(form.wpMultiplier) || 10,
          startingDate: form.startingDate,
        });
      } else {
        const created = await api.createForce({
          name: form.name,
          description: form.description,
          startingWarchest: Number(form.startingWarchest) || 0,
          wpMultiplier: Number(form.wpMultiplier) || 10,
          startingDate: form.startingDate,
        });
        forceId = created.id;
      }
      if (form.imageFile) {
        await api.uploadForceImage(forceId, form.imageFile);
      } else if (form.removeImage) {
        await api.deleteForceImage(forceId);
      }
      await api.adminSetForceSpecialAbilitiesFromText(forceId, form.specialAbilitiesText);
      await onRefresh();
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (force) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete force "${force.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteForce(force.id);
      await onRefresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Failed to delete force: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-forces-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-heading uppercase tracking-wider text-sm text-muted-foreground">Forces</h3>
        <Button size="sm" onClick={startCreate} data-testid="admin-force-new-btn">
          <Plus className="w-4 h-4" /> New Force
        </Button>
      </div>

      <div className="border border-border/40 rounded divide-y divide-border/30">
        {(forces || []).map((force) => (
          <div key={force.id} className="flex items-center justify-between px-3 py-2" data-testid={`admin-force-row-${force.id}`}>
            <div>
              <div className="text-sm font-medium">{force.name}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {force.id} &middot; Start: {force.startingDate || '3025-01-01'} &middot; WP Rate: {force.wpMultiplier}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(force)} data-testid={`admin-force-edit-btn-${force.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(force)} data-testid={`admin-force-delete-btn-${force.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {(!forces || forces.length === 0) && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No forces yet.</div>
        )}
      </div>

      {showForm && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-4 space-y-3" data-testid="admin-force-form">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editingId ? `Edit ${editingId}` : 'Create Force'}</h4>
            <button onClick={() => setShowForm(false)} data-testid="admin-force-form-close-btn">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && <p className="text-xs text-destructive" data-testid="admin-force-form-error">{error}</p>}

          <div>
            <label className="block text-xs font-medium mb-1">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="admin-force-name-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              data-testid="admin-force-description-input"
            />
          </div>

          <div>
            <ImageUploadField
              label="Image"
              currentImageUrl={form.removeImage ? null : form.currentImageUrl}
              file={form.imageFile}
              onFileChange={(selected) => setForm({ ...form, imageFile: selected, removeImage: false })}
              onRemove={() => setForm({ ...form, imageFile: null, removeImage: true })}
              testId="admin-force-image"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Starting Warchest</label>
              <Input
                type="number"
                value={form.startingWarchest}
                onChange={(e) => setForm({ ...form, startingWarchest: e.target.value })}
                data-testid="admin-force-warchest-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">WP Conversion Rate</label>
              <Input
                type="number"
                value={form.wpMultiplier}
                onChange={(e) => setForm({ ...form, wpMultiplier: e.target.value })}
                data-testid="admin-force-wp-rate-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Starting Date</label>
              <Input
                value={form.startingDate}
                onChange={(e) => setForm({ ...form, startingDate: e.target.value })}
                placeholder="3025-01-01"
                data-testid="admin-force-starting-date-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Special Abilities (one per line, "Title: Description")</label>
            <Textarea
              rows={3}
              value={form.specialAbilitiesText}
              onChange={(e) => setForm({ ...form, specialAbilitiesText: e.target.value })}
              placeholder="Zellbrigen: Honor-bound single combat"
              data-testid="admin-force-abilities-input"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} data-testid="admin-force-save-btn">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
