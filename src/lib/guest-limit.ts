import { getSupabaseAdmin } from './supabase-admin';
import { devLog } from './logger';

const GUEST_DAILY_LIMIT = 3;

// guest_usage テーブルの型定義（Supabase generated typesがない場合の最小定義）
type GuestUsageRow = {
  guest_id: string;
  usage_date: string;
  count: number;
  updated_at: string;
};

export interface GuestUsage {
    count: number;
    limit: number;
    remaining: number;
    isLimitReached: boolean;
}

/**
 * ゲストユーザーの利用状況を取得・更新する
 */
export async function checkAndIncrementGuestUsage(guestId: string): Promise<{ allowed: boolean; usage: GuestUsage }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // 1. 現在の利用状況を取得
        const supabaseAdmin = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types未使用のため、guest_usageテーブルの型が不明
        const { data: currentUsage, error: fetchError } = await (supabaseAdmin.from('guest_usage') as any)
            .select('count')
            .eq('guest_id', guestId)
            .eq('usage_date', today)
            .single() as { data: Pick<GuestUsageRow, 'count'> | null; error: { code: string } | null };

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: no rows returned
            devLog.error('Failed to fetch guest usage:', fetchError);
            // エラー時は安全側に倒して許可（またはエラーにするか要検討）
            // ここではDBエラーでも一旦通すが、ログに残す
        }

        const currentCount = currentUsage?.count || 0;

        // 2. 制限チェック
        if (currentCount >= GUEST_DAILY_LIMIT) {
            return {
                allowed: false,
                usage: {
                    count: currentCount,
                    limit: GUEST_DAILY_LIMIT,
                    remaining: 0,
                    isLimitReached: true,
                },
            };
        }

        // 3. カウントアップ（Upsert）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types未使用
        const { error: upsertError } = await (supabaseAdmin.from('guest_usage') as any)
            .upsert(
                {
                    guest_id: guestId,
                    usage_date: today,
                    count: currentCount + 1,
                    updated_at: new Date().toISOString(),
                } satisfies GuestUsageRow,
                { onConflict: 'guest_id, usage_date' }
            );

        if (upsertError) {
            devLog.error('Failed to update guest usage:', upsertError);
            // DB更新失敗しても、今回は生成を許可してしまう（ユーザー体験優先）
            // ただし、厳密に制限したい場合はここで allowed: false にする
        }

        return {
            allowed: true,
            usage: {
                count: currentCount + 1,
                limit: GUEST_DAILY_LIMIT,
                remaining: GUEST_DAILY_LIMIT - (currentCount + 1),
                isLimitReached: currentCount + 1 >= GUEST_DAILY_LIMIT,
            },
        };

    } catch (error) {
        devLog.error('Guest limit check failed:', error);
        // システムエラー時は一旦許可
        return {
            allowed: true,
            usage: { count: 0, limit: GUEST_DAILY_LIMIT, remaining: GUEST_DAILY_LIMIT, isLimitReached: false },
        };
    }
}

/**
 * ゲストユーザーの現在の利用状況を取得する（インクリメントなし）
 */
export async function getGuestUsage(guestId: string): Promise<GuestUsage> {
    const today = new Date().toISOString().split('T')[0];

    try {
        const supabaseAdmin = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types未使用
        const { data, error } = await (supabaseAdmin.from('guest_usage') as any)
            .select('count')
            .eq('guest_id', guestId)
            .eq('usage_date', today)
            .single() as { data: Pick<GuestUsageRow, 'count'> | null; error: { code: string } | null };

        if (error && error.code !== 'PGRST116') {
            devLog.error('Failed to fetch guest usage:', error);
        }

        const count = data?.count || 0;

        return {
            count,
            limit: GUEST_DAILY_LIMIT,
            remaining: Math.max(0, GUEST_DAILY_LIMIT - count),
            isLimitReached: count >= GUEST_DAILY_LIMIT,
        };
    } catch (error) {
        devLog.error('Get guest usage failed:', error);
        return { count: 0, limit: GUEST_DAILY_LIMIT, remaining: GUEST_DAILY_LIMIT, isLimitReached: false };
    }
}
