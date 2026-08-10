import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import * as api from '../../lib/api';

const CATEGORIES = ['mechActions', 'elementalActions', 'pilotActions'];

const emptyForm = { name: '', description: '', category: 'mechActions', formula: '', makesUnavailable: false };

export default function AdminDowntimeActionsPanel() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setActions(await api.adminListDowntimeActions());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (action) => {
    setEditingId(action.id);
    setForm({
      name: action.name,
      description: action.description || '',
      category: action.category,
      formula: action.formula,
      makesUnavailable: (action.flags || []).includes('makesUnavailable'),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.formula.trim()) {
      setError('Name and formula are required');
      return;
    }
    const flags = form.makesUnavailable ? ['makesUnavailable'] : [];
    try {
      if (editingId) {
        await api.adminUpdateDowntimeAction(editingId, {
          name: form.name,
          description: form.description,
          category: form.category,
          formula: form.formula,
          flags,
        });
      } else {
        await api.adminCreateDowntimeAction({
          name: form.name,
          description: form.description,
          category: form.category,
          formula: form.formula,
          flags,
        });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (action) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete downtime action "${action.name}"?`)) return;
    try {
      await api.adminDeleteDowntimeAction(action.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-downtime-actions-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-heading uppercase tracking-wider text-sm text-muted-foreground">Downtime Operations</h3>
        <Button size="sm" onClick={startCreate} data-testid="admin-downtime-action-new-btn">
          <Plus className="w-4 h-4" /> New Action
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border/40 rounded divide-y divide-border/30">
        {!loading && actions.map((action) => (
          <div key={action.id} className="flex items-center justify-between px-3 py-2" data-testid={`admin-downtime-action-row-${action.id}`}>
            <div>
              <div className="text-sm font-medium">{action.name} <span className="text-xs text-muted-foreground">({action.category})</span></div>
              <div className="text-xs text-muted-foreground font-mono">{action.formula}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(action)} data-testid={`admin-downtime-action-edit-btn-${action.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(action)} data-testid={`admin-downtime-action-delete-btn-${action.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {!loading && actions.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No downtime actions yet.</div>
        )}
      </div>

      {showForm && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-4 space-y-3" data-testid="admin-downtime-action-form">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editingId ? `Edit ${editingId}` : 'Create Downtime Action'}</h4>
            <button onClick={() => setShowForm(false)} data-testid="admin-downtime-action-form-close-btn"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="admin-downtime-action-name-input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="admin-downtime-action-category-select">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="admin-downtime-action-description-input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Formula *</label>
            <Input value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} placeholder="weight/wpMultiplier" data-testid="admin-downtime-action-formula-input" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.makesUnavailable} onChange={(e) => setForm({ ...form, makesUnavailable: e.target.checked })} data-testid="admin-downtime-action-unavailable-checkbox" />
            Makes unit unavailable
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} data-testid="admin-downtime-action-save-btn"><Save className="w-3.5 h-3.5" /> Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
