import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { User } from 'lucide-react';

export function PortalProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name != null) setName(user.name);
  }, [user?.name]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ name: name.trim() || user.name }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    await refreshProfile();
    toast('Profile updated');
  }

  if (!user) return null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <User className="w-7 h-7 text-accent-500" />
          My profile
        </h1>
        <p className="text-navy-500 mt-1">Update how your name appears in the portal.</p>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-navy-200 rounded-lg focus:ring-2 focus:ring-accent-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Email</label>
          <input
            value={user.email}
            readOnly
            className="w-full px-3 py-2 border border-navy-200 rounded-lg bg-navy-50 text-navy-500"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="px-4 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
