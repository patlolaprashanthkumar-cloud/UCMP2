import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, Role } from '../types';
import { useToast } from './ToastContext';

const missingConfigError =
  'Supabase is not configured. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).';

export type StoreSignupRole = 'CUSTOMER' | 'AFFILIATE' | 'RESELLER';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: Role,
    referralCode?: string,
    storeContext?: { tenantId: string; storeRole: StoreSignupRole },
  ) => Promise<{ error?: string; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string; profileMissing?: boolean; profile?: Profile }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: Role,
    referralCode?: string,
    storeContext?: { tenantId: string; storeRole: StoreSignupRole },
  ) => {
    if (!isSupabaseConfigured) return { error: missingConfigError };
    const normalizedEmail = email.trim().toLowerCase();
    const metaRole: Role = storeContext
      ? storeContext.storeRole === 'AFFILIATE' || storeContext.storeRole === 'RESELLER'
        ? storeContext.storeRole
        : 'CUSTOMER'
      : role;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name,
          role: metaRole,
          referred_by: referralCode ?? null,
          ...(storeContext
            ? { tenant_id: storeContext.tenantId, store_role: storeContext.storeRole }
            : {}),
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
      return { profile };
    }
    return {};
  };

  const signOut = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
