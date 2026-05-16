import { supabase } from './supabase';

export async function ensureUserProfile(userId: string, email: string, fullName?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  await supabase.from('users').insert({
    id: userId,
    email,
    full_name: fullName ?? null,
    role: 'admin',
  });
}
