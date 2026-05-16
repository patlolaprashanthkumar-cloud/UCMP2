import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: Role, referralCode?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  demoLogin: (role: Role) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const DEMO_ACCOUNTS: Record<Role, { email: string; password: string }> = {
  AFFILIATE: { email: 'demo.affiliate@ucmp.in', password: 'demo123456' },
  RESELLER: { email: 'demo.reseller@ucmp.in', password: 'demo123456' },
  VENDOR: { email: 'demo.vendor@ucmp.in', password: 'demo123456' },
  SAAS_OWNER: { email: 'demo.saas@ucmp.in', password: 'demo123456' },
  ADMIN: { email: 'demo.admin@ucmp.in', password: 'demo123456' },
};

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'UCMP';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      setUser(profile);
    }
  }, [fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          setUser(profile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

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
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: 'Signup failed' };

    const existing = await fetchProfile(authData.user.id);
    if (existing) {
      setUser(existing);
      return {};
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      name,
      email,
      role,
      referral_code: generateReferralCode(),
      referred_by: referralCode || null,
    });
    if (profileError && !profileError.message.includes('duplicate')) return { error: profileError.message };

    await supabase.from('wallets').insert({ user_id: authData.user.id });

    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();
      if (referrer) {
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: authData.user.id,
        });
      }
    }

    const profile = await fetchProfile(authData.user.id);
    setUser(profile);
    return {};
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      setUser(profile);
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const demoLogin = async (role: Role) => {
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

    const { error } = await signIn(result.email, result.password);
    if (error) return { error };
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
