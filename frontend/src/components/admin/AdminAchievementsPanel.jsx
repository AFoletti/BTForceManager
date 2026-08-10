import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import * as api from '../../lib/api';

const emptyForm = { id: '', name: '', icon: '', description: '', condition: '' };

export default function AdminAchievementsPanel() {
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setDefinitions(await api.adminListAchievementDefinitions());
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

  const startEdit = (definition) => {
    setEditingId(definition.id);
    setForm({ ...definition });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || (!editingId && !form.id.trim()) || !form.condition.trim()) {
      setError('Id, name, and condition are required');
      return;
    }
    try {
      if (editingId) {
        await api.adminUpdateAchievementDefinition(editingId, {
          name: form.name,
          icon: form.icon,
          description: form.description,
          condition: form.condition,
        });
      } else {
        await api.adminCreateAchievementDefinition(form);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (definition) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete achievement "${definition.name}"?`)) return;
    try {
      await api.adminDeleteAchievementDefinition(definition.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-achievements-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-heading uppercase tracking-wider text-sm text-muted-foreground">Achievements</h3>
        <Button size="sm" onClick={startCreate} data-testid="admin-achievement-new-btn">
          <Plus className="w-4 h-4" /> New Achievement
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border/40 rounded divide-y divide-border/30">
        {!loading && definitions.map((definition) => (
          <div key={definition.id} className="flex items-center justify-between px-3 py-2" data-testid={`admin-achievement-row-${definition.id}`}>
            <div>
              <div className="text-sm font-medium">{definition.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{definition.condition}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(definition)} data-testid={`admin-achievement-edit-btn-${definition.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(definition)} data-testid={`admin-achievement-delete-btn-${definition.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {!loading && definitions.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No achievement definitions yet.</div>
        )}
      </div>

      {showForm && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded p-4 space-y-3" data-testid="admin-achievement-form">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editingId ? `Edit ${editingId}` : 'Create Achievement'}</h4>
            <button onClick={() => setShowForm(false)} data-testid="admin-achievement-form-close-btn"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!editingId && (
              <div>
                <label className="block text-xs font-medium mb-1">Id *</label>
                <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="first-blood" data-testid="admin-achievement-id-input" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="admin-achievement-name-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="admin-achievement-description-input" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Condition *</label>
            <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="killCount >= 1" data-testid="admin-achievement-condition-input" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} data-testid="admin-achievement-save-btn"><Save className="w-3.5 h-3.5" /> Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
