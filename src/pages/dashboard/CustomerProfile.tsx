import { useState, useEffect, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { User } from 'lucide-react';

export function CustomerProfile() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  if (!user) return null;
  if (user.role !== 'CUSTOMER') return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Profile updated');
    await refreshProfile();
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
        <User className="w-7 h-7 text-accent-500" /> My profile
      </h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Email</label>
          <input type="email" value={user.email} disabled className="w-full px-3 py-2 rounded-lg border border-navy-200 bg-navy-50 text-navy-600 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1">Avatar image URL</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm focus:ring-2 focus:ring-accent-500 outline-none"
          />
        </div>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-navy-100" />
        ) : null}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
