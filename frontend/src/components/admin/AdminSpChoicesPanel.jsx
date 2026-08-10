import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import * as api from '../../lib/api';

const emptyForm = { name: '', cost: 0 };

export default function AdminSpChoicesPanel() {
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newForm, setNewForm] = useState(emptyForm);
  const [edits, setEdits] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setChoices(await api.adminListSpChoices());
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

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    try {
      await api.adminCreateSpChoice({ name: newForm.name, cost: Number(newForm.cost) || 0 });
      setNewForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (id) => {
    const edit = edits[id];
    if (!edit) return;
    try {
      await api.adminUpdateSpChoice(id, { name: edit.name, cost: Number(edit.cost) || 0 });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this SP purchase option?')) return;
    try {
      await api.adminDeleteSpChoice(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const editValue = (choice, field) => edits[choice.id]?.[field] ?? choice[field];

  return (
    <div className="space-y-4" data-testid="admin-sp-choices-panel">
      <h3 className="font-heading uppercase tracking-wider text-sm text-muted-foreground">SP Purchases</h3>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border/40 rounded divide-y divide-border/30">
        {!loading && choices.map((choice) => (
          <div key={choice.id} className="flex items-center gap-2 px-3 py-2" data-testid={`admin-sp-choice-row-${choice.id}`}>
            <Input
              className="flex-1"
              value={editValue(choice, 'name')}
              onChange={(e) => setEdits({ ...edits, [choice.id]: { ...edits[choice.id], name: e.target.value, cost: editValue(choice, 'cost') } })}
              data-testid={`admin-sp-choice-name-input-${choice.id}`}
            />
            <Input
              type="number"
              className="w-24"
              value={editValue(choice, 'cost')}
              onChange={(e) => setEdits({ ...edits, [choice.id]: { ...edits[choice.id], name: editValue(choice, 'name'), cost: e.target.value } })}
              data-testid={`admin-sp-choice-cost-input-${choice.id}`}
            />
            <Button size="sm" variant="outline" onClick={() => handleUpdate(choice.id)} data-testid={`admin-sp-choice-save-btn-${choice.id}`}>
              <Save className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(choice.id)} data-testid={`admin-sp-choice-delete-btn-${choice.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {!loading && choices.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No SP purchase options yet.</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="New option name"
          value={newForm.name}
          onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
          data-testid="admin-sp-choice-new-name-input"
        />
        <Input
          type="number"
          className="w-24"
          placeholder="Cost"
          value={newForm.cost}
          onChange={(e) => setNewForm({ ...newForm, cost: e.target.value })}
          data-testid="admin-sp-choice-new-cost-input"
        />
        <Button size="sm" onClick={handleCreate} data-testid="admin-sp-choice-create-btn">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
    </div>
  );
}
