import { createClient } from '@/utils/supabase/client';

export type LetterStatus = 'draft' | 'generated' | 'sent' | 'replied' | 'meeting_set';

export interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
  isPinned?: boolean;
  mode?: 'sales' | 'event';
  status?: LetterStatus;
  inputs: {
    myCompanyName: string;
    myName: string;
    myServiceDescription: string;
    companyName: string;
    position: string;
    name: string;
    background: string;
    problem: string;
    solution: string;
    caseStudy: string;
    offer: string;
    freeformInput?: string;
  };
}

// Database type (snake_case for Supabase)
interface LetterRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  target_company: string;
  target_name: string;
  content: string;
  is_pinned: boolean;
  mode: 'sales' | 'event';
  status: LetterStatus;
  inputs: LetterHistory['inputs'];
}

/**
 * Convert database row to LetterHistory format
 */
function rowToHistory(row: LetterRow): LetterHistory {
  return {
    id: row.id,
    createdAt: row.created_at,
    targetCompany: row.target_company,
    targetName: row.target_name,
    content: row.content,
    isPinned: row.is_pinned,
    mode: row.mode,
    status: row.status,
    inputs: row.inputs,
  };
}

/**
 * Get all letter histories for the current user
 * Sorted by: 1. Pinned (true first), 2. Created date (newest first)
 */
export async function getHistories(): Promise<LetterHistory[]> {
  try {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('認証エラー:', userError);
      return [];
    }

    if (!user) {
      console.log('No user found, returning empty array');
      return [];
    }

    console.log(`Fetching histories for user: ${user.id}`);

    // Sort at database level: pinned DESC (true first), then created_at DESC (newest first)
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('履歴取得エラー:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    console.log(`Fetched ${data?.length || 0} histories from Supabase`);
    return (data || []).map(rowToHistory);
  } catch (error) {
    console.error('履歴取得エラー (catch):', error);
    return [];
  }
}

/**
 * Save a new letter to history
 */
export async function saveToHistory(
  inputs: LetterHistory['inputs'],
  content: string,
  mode?: 'sales' | 'event'
): Promise<LetterHistory | null> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const newLetter = {
      user_id: user.id,
      target_company: inputs.companyName,
      target_name: inputs.name,
      content,
      is_pinned: false,
      mode: mode || 'sales',
      status: 'generated' as LetterStatus,
      inputs,
    };

    const { data, error } = await supabase
      .from('letters')
      .insert(newLetter)
      .select()
      .single();

    if (error) {
      console.error('履歴保存エラー:', error);
      throw error;
    }

    // Check unpinned items count and delete oldest if needed
    await cleanupOldHistories();

    return data ? rowToHistory(data) : null;
  } catch (error) {
    console.error('履歴保存エラー:', error);
    return null;
  }
}

/**
 * Delete old unpinned histories (keep only 10 most recent)
 */
async function cleanupOldHistories(): Promise<void> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all unpinned letters
    const { data: unpinnedLetters } = await supabase
      .from('letters')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('is_pinned', false)
      .order('created_at', { ascending: false });

    if (!unpinnedLetters || unpinnedLetters.length <= 10) return;

    // Delete letters beyond the 10 most recent
    const idsToDelete = unpinnedLetters.slice(10).map(l => l.id);

    if (idsToDelete.length > 0) {
      await supabase
        .from('letters')
        .delete()
        .in('id', idsToDelete);
    }
  } catch (error) {
    console.error('古い履歴の削除エラー:', error);
  }
}

/**
 * Toggle pin status for a letter
 */
export async function togglePin(id: string): Promise<LetterHistory[]> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    // Get current letter
    const { data: letter } = await supabase
      .from('letters')
      .select('is_pinned')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!letter) {
      console.error('Letter not found');
      return getHistories();
    }

    // Toggle pin status
    const { error } = await supabase
      .from('letters')
      .update({ is_pinned: !letter.is_pinned })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('ピン留め切り替えエラー:', error);
    }

    // Return updated histories
    return getHistories();
  } catch (error) {
    console.error('ピン留め切り替えエラー:', error);
    return [];
  }
}

/**
 * Delete a letter by ID
 */
export async function deleteHistory(id: string): Promise<LetterHistory[]> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { error } = await supabase
      .from('letters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('履歴削除エラー:', error);
    }

    // Return updated histories
    return getHistories();
  } catch (error) {
    console.error('履歴削除エラー:', error);
    return [];
  }
}

/**
 * Update the status of a letter
 */
export async function updateStatus(id: string, status: LetterStatus): Promise<LetterHistory | null> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('letters')
      .update({ status })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('ステータス更新エラー:', error);
      throw error;
    }

    return data ? rowToHistory(data) : null;
  } catch (error) {
    console.error('ステータス更新エラー:', error);
    return null;
  }
}

/**
 * Migrate data from LocalStorage to Supabase
 * This function should be called once when a user first logs in
 * Includes retry logic for robustness
 */
export async function migrateFromLocalStorage(retryCount = 0): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Migration: 認証エラー:', userError);
      return { success: false, error: userError.message };
    }

    if (!user) {
      console.log('Migration: No user logged in, skipping migration');
      return { success: true };
    }

    console.log(`Migration: Starting for user ${user.id}`);

    // Check if migration has already been done
    const migrationKey = `migration_done_${user.id}`;
    if (localStorage.getItem(migrationKey)) {
      console.log('Migration: Already completed for this user');
      return { success: true };
    }

    // Get LocalStorage data
    const stored = localStorage.getItem('letterHistories');
    if (!stored) {
      console.log('Migration: No LocalStorage data to migrate');
      localStorage.setItem(migrationKey, 'true');
      return { success: true };
    }

    const localHistories: LetterHistory[] = JSON.parse(stored);
    if (localHistories.length === 0) {
      console.log('Migration: No histories to migrate');
      localStorage.setItem(migrationKey, 'true');
      return { success: true };
    }

    console.log(`Migration: Migrating ${localHistories.length} histories to Supabase (attempt ${retryCount + 1})`);

    // Insert all local histories to Supabase
    const lettersToInsert = localHistories.map(history => ({
      id: history.id, // Keep the same ID
      user_id: user.id,
      created_at: history.createdAt,
      target_company: history.targetCompany,
      target_name: history.targetName,
      content: history.content,
      is_pinned: history.isPinned || false,
      mode: history.mode || 'sales',
      status: history.status || 'generated',
      inputs: history.inputs,
    }));

    const { error } = await supabase
      .from('letters')
      .upsert(lettersToInsert, { onConflict: 'id' });

    if (error) {
      console.error('Migration: Database error:', error);
      console.error('Migration: Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      // Retry up to 2 times
      if (retryCount < 2) {
        console.log(`Migration: Retrying... (${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return migrateFromLocalStorage(retryCount + 1);
      }

      return { success: false, error: error.message };
    }

    console.log('Migration: Successful!');

    // Mark migration as complete
    localStorage.setItem(migrationKey, 'true');

    // Optionally clear LocalStorage data after successful migration
    localStorage.removeItem('letterHistories');
    console.log('Migration: Cleared LocalStorage data after successful migration');

    return { success: true };
  } catch (error: any) {
    console.error('Migration: Failed (catch):', error);

    // Retry up to 2 times
    if (retryCount < 2) {
      console.log(`Migration: Retrying... (${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return migrateFromLocalStorage(retryCount + 1);
    }

    return { success: false, error: error.message || 'Unknown error' };
  }
}
