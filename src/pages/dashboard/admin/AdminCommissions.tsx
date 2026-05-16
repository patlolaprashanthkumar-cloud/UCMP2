import { useState, useEffect } from 'react';
import { Pencil, Check, X, Plus, Percent } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { Commission } from '../../../types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/LoadingSkeleton';

interface EditState {
  id: string | null;
  role: string;
  level: string;
  percentage: string;
}

const EMPTY_EDIT: EditState = { id: null, role: '', level: '', percentage: '' };

export function AdminCommissions() {
  const { toast } = useToast();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<EditState>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);

  const fetchCommissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .order('role', { ascending: true })
      .order('level', { ascending: true });
    if (error) {
      toast('Failed to load commissions', 'error');
    } else {
      setCommissions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCommissions(); }, []);

  const startEdit = (c: Commission) => {
    setEditing({ id: c.id, role: c.role, level: String(c.level), percentage: String(c.percentage) });
    setAdding(false);
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing?.id) return;
    const pct = parseFloat(editing.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast('Percentage must be between 0 and 100', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('commissions')
      .update({ role: editing.role, level: editing.level, percentage: pct })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast('Failed to update commission', 'error');
    } else {
      toast('Commission updated successfully', 'success');
      setEditing(null);
      fetchCommissions();
    }
  };

  const startAdd = () => {
    setAdding(true);
    setNewRow(EMPTY_EDIT);
    setEditing(null);
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewRow(EMPTY_EDIT);
  };

  const saveNew = async () => {
    const pct = parseFloat(newRow.percentage);
    if (!newRow.role || !newRow.level) {
      toast('Role and level are required', 'error');
      return;
    }
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast('Percentage must be between 0 and 100', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('commissions')
      .insert({ role: newRow.role, level: newRow.level, percentage: pct });
    setSaving(false);
    if (error) {
      toast('Failed to add commission', 'error');
    } else {
      toast('Commission added successfully', 'success');
      cancelAdd();
      fetchCommissions();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Commission Rates</h1>
        <button
          onClick={startAdd}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Rate
        </button>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : commissions.length === 0 && !adding ? (
        <EmptyState icon={<Percent className="w-12 h-12 text-slate-300" />} title="No commission rates" description="Add your first commission rate to get started." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Level</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Percentage</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {editing?.id === c.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" max="100" step="0.1" value={editing.percentage} onChange={(e) => setEditing({ ...editing, percentage: e.target.value })} className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-slate-900 capitalize">{c.role}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{c.level}</td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{c.percentage}%</td>
                      <td className="px-4 py-3">
                        <button onClick={() => startEdit(c)} className="p-1 text-slate-500 hover:text-orange-500 transition-colors"><Pencil className="w-4 h-4" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {adding && (
                <tr className="border-b border-slate-100 bg-orange-50/50">
                  <td className="px-4 py-3">
                    <input placeholder="Role" value={newRow.role} onChange={(e) => setNewRow({ ...newRow, role: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </td>
                  <td className="px-4 py-3">
                    <input placeholder="Level" value={newRow.level} onChange={(e) => setNewRow({ ...newRow, level: e.target.value })} className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" min="0" max="100" step="0.1" placeholder="0.0" value={newRow.percentage} onChange={(e) => setNewRow({ ...newRow, percentage: e.target.value })} className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={saveNew} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      <button onClick={cancelAdd} className="p-1 text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
