import { createClient } from '@/utils/supabase/client';

export interface Profile {
  id: string;
  company_name: string | null;
  user_name: string | null;
  service_description: string | null;
  company_url: string | null;
  email: string | null;
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
      console.error('Profile fetch error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Profile fetch error:', error);
    return null;
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(profile: Partial<Omit<Profile, 'id' | 'email'>>): Promise<Profile | null> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Profile update error:', error);
    return null;
  }
}
