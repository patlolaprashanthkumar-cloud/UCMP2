import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, Role } from '../types';
import { useToast } from './ToastContext';

const missingConfigError =
  'Supabase is not configured. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: Role, referralCode?: string) => Promise<{ error?: string; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string; profileMissing?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  demoLogin: (role: Role) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      setUser(profile);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          setUser(profile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session?.user) {
        fetchProfile(session.user.id).then(setUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, name: string, role: Role, referralCode?: string) => {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    const normalizedEmail = email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name,
          role,
          referred_by: referralCode ?? null,
        },
      },
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: 'Signup failed' };

    if (!authData.session) {
      return { needsEmailVerification: true };
    }

    const profile = await fetchProfile(authData.user.id);
    setUser(profile);
    return {};
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) return { error: error.message };
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        toast('Your account has no profile yet. If this continues, contact support.', 'info');
        await supabase.auth.signOut();
        setUser(null);
        return { profileMissing: true };
      }
      setUser(profile);
    }
    return {};
  };

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
  };

  const demoLogin = async (role: Role) => {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-login`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ role }),
    });
    const result = await res.json();
    if (!res.ok || result.error) return { error: result.error || 'Demo setup failed' };

    const { error, profileMissing } = await signIn(result.email, result.password);
    if (error) return { error };
    if (profileMissing) return { error: 'Account has no profile. Contact support.' };
    return {};
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refreshProfile, demoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
