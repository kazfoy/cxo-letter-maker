import { createClient } from '@/utils/supabase/client';
import { devLog } from '@/lib/logger';

export interface Profile {
  id: string;
  company_name: string | null;
  user_name: string | null;
  service_description: string | null;
  company_url: string | null;
  email: string | null;
  department?: string | null;
  position?: string | null;
  reference_docs?: { name: string; path: string }[] | null;
}

/**
 * Get the current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      devLog.error('Profile fetch error:', error);
      return null;
    }

    return data;
  } catch (error) {
    devLog.error('Profile fetch error:', error);
    return null;
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(profile: Partial<Omit<Profile, 'id' | 'email'>>): Promise<Profile | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('ログインが必要です');
  }

  devLog.log('[Profile Update] Updating profile for user:', user.id);
  devLog.log('[Profile Update] Data:', JSON.stringify(profile, null, 2));

  const { data, error } = await supabase
    .from('profiles')
    .update(profile)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    devLog.error('[Profile Update] Supabase error:', error.code, error.message, error.details, error.hint);
    throw new Error(`プロフィール更新エラー: ${error.message}`);
  }

  devLog.log('[Profile Update] Success:', data);
  return data;
}
