'use server';

import { createClient } from '@/utils/supabase/server';

export async function updatePassword(password: string) {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
        password: password,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}
