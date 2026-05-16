import { supabase } from './supabase';

export interface UserProfile {
  factoryId: string;
}

export async function getOrCreateProfile(
  userId: string,
  email: string,
  fullName?: string
): Promise<UserProfile> {
  // Check if profile already exists
  const { data: existing } = await supabase
    .from('users')
    .select('factory_id')
    .eq('id', userId)
    .maybeSingle();

  if (existing?.factory_id) {
    return { factoryId: existing.factory_id };
  }

  // Look up the existing factory for this owner
  const { data: factory, error: factoryError } = await supabase
    .from('factories')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (factoryError || !factory) throw new Error('Factory not found. Ask admin to set up your factory in the database.');

  // Create the user profile linked to that factory
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email,
      full_name: fullName ?? null,
      role: 'admin',
      factory_id: factory.id,
    });

  if (profileError) throw new Error(`Could not create user profile: ${profileError.message}`);

  return { factoryId: factory.id };
}
