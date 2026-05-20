import { supabase, isSupabaseConfigured } from './supabase';

function functionsBaseUrl(): string {
  const u = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!u) throw new Error('VITE_SUPABASE_URL is not set');
  return `${u.replace(/\/$/, '')}/functions/v1`;
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: unknown,
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in required');
  }
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!anon) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not set');
  }
  const res = await fetch(`${functionsBaseUrl()}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) {
    throw new Error(json.error || res.statusText || 'Request failed');
  }
  return json as T;
}
