import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** False when env is missing — avoids crashing the whole app on import (blank page in dev). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient throws if URL or anon key is missing; use inert placeholders so the UI still mounts.
const resolvedUrl = supabaseUrl ?? 'https://missing-env.supabase.co';
const resolvedKey = supabaseAnonKey ?? 'missing-anon-key';

export const supabase = createClient(resolvedUrl, resolvedKey);
