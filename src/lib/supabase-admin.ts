import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// シングルトンインスタンスを保持
let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
    if (adminClient) return adminClient;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        // ビルド時や環境変数未設定時はエラーを投げる（呼び出し元でハンドリングするか、ここでのエラーが適切）
        // ただし、ビルド中にこの関数が呼ばれなければOK
        throw new Error('Missing Supabase environment variables for admin client');
    }

    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return adminClient;
}
