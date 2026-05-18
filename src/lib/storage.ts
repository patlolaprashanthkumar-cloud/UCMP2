import { supabase, isSupabaseConfigured } from './supabase';

export async function uploadPublicFile(
  bucket: string,
  path: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: 'Supabase not configured' };
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return { url: null, error: error.message };
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { url: pub.publicUrl, error: null };
}
