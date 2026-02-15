import { getSupabaseAdmin } from './supabase-admin';
import { devLog } from './logger';

const GUEST_DAILY_LIMIT = 3;

export interface GuestUsage {
    count: number;
    limit: number;
    remaining: number;
    isLimitReached: boolean;
}

/**
 * ゲストユーザーの利用状況をアトミックに確認・更新する
 * - Supabase RPC (increment_daily_usage) で1トランザクション内で処理
 * - エラー時はfail-closed（利用不可）
 */
export async function checkAndIncrementGuestUsage(guestId: string): Promise<{ allowed: boolean; usage: GuestUsage }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        const supabaseAdmin = getSupabaseAdmin();

        // アトミックインクリメントRPC呼び出し
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any).rpc('increment_daily_usage', {
            p_guest_id: guestId,
            p_usage_date: today,
            p_daily_limit: GUEST_DAILY_LIMIT,
        }) as { data: Array<{ new_count: number; was_allowed: boolean }> | null; error: unknown };

        if (error || !data || data.length === 0) {
            devLog.error('Guest usage RPC failed:', error);
            // fail-closed: DBエラー時は利用不可
            return {
                allowed: false,
                usage: {
                    count: GUEST_DAILY_LIMIT,
                    limit: GUEST_DAILY_LIMIT,
                    remaining: 0,
                    isLimitReached: true,
                },
            };
        }

        const { new_count, was_allowed } = data[0];

        return {
            allowed: was_allowed,
            usage: {
                count: new_count,
                limit: GUEST_DAILY_LIMIT,
                remaining: Math.max(0, GUEST_DAILY_LIMIT - new_count),
                isLimitReached: new_count >= GUEST_DAILY_LIMIT,
            },
        };
    } catch (error) {
        devLog.error('Guest limit check failed:', error);
        // fail-closed: システムエラー時は利用不可
        return {
            allowed: false,
            usage: {
                count: GUEST_DAILY_LIMIT,
                limit: GUEST_DAILY_LIMIT,
                remaining: 0,
                isLimitReached: true,
            },
        };
    }
}

/**
 * ゲストユーザーの現在の利用状況を取得する（インクリメントなし）
 * エラー時はfail-closed（制限到達として返却）
 */
export async function getGuestUsage(guestId: string): Promise<GuestUsage> {
    const today = new Date().toISOString().split('T')[0];

    try {
        const supabaseAdmin = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin.from('guest_usage') as any)
            .select('count')
            .eq('guest_id', guestId)
            .eq('usage_date', today)
            .single() as { data: { count: number } | null; error: { code: string } | null };

        if (error && error.code !== 'PGRST116') { // PGRST116: no rows returned
            devLog.error('Failed to fetch guest usage:', error);
            // fail-closed: DBエラー時は制限到達として返却
            return {
                count: GUEST_DAILY_LIMIT,
                limit: GUEST_DAILY_LIMIT,
                remaining: 0,
                isLimitReached: true,
            };
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
        // fail-closed: システムエラー時は制限到達として返却
        return {
            count: GUEST_DAILY_LIMIT,
            limit: GUEST_DAILY_LIMIT,
            remaining: 0,
            isLimitReached: true,
        };
    }
}
