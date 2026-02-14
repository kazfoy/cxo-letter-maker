'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { devLog } from '@/lib/logger';

const GUEST_DAILY_LIMIT = 3;
const STORAGE_KEY = 'cxo_guest_limit';

export interface GuestUsage {
    count: number;
    limit: number;
    remaining: number;
    isLimitReached: boolean;
}

export function useGuestLimit() {
    const { user } = useAuth();
    const [usage, setUsage] = useState<GuestUsage | null>(null);
    const [loading, setLoading] = useState(false);

    // LocalStorageから利用状況を取得
    const fetchUsage = useCallback(async () => {
        if (user) {
            setUsage(null);
            return;
        }

        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const stored = localStorage.getItem(STORAGE_KEY);
            let currentCount = 0;

            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.date === today) {
                    currentCount = parsed.count;
                } else {
                    // 日付が変わっていたらリセット
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 0, date: today }));
                }
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 0, date: today }));
            }

            setUsage({
                count: currentCount,
                limit: GUEST_DAILY_LIMIT,
                remaining: Math.max(0, GUEST_DAILY_LIMIT - currentCount),
                isLimitReached: currentCount >= GUEST_DAILY_LIMIT
            });
        } catch (error) {
            devLog.error('Failed to access localStorage:', error);
            // エラー時は制限なしとして振る舞うか、安全側に倒す
        } finally {
            setLoading(false);
        }
    }, [user]);

    // 利用回数をインクリメント (API呼び出し成功後に呼ぶ)
    const incrementUsage = useCallback(() => {
        if (user) return;

        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(STORAGE_KEY);
        let newCount = 1;

        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.date === today) {
                newCount = parsed.count + 1;
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, date: today }));

        // Stateも更新
        setUsage({
            count: newCount,
            limit: GUEST_DAILY_LIMIT,
            remaining: Math.max(0, GUEST_DAILY_LIMIT - newCount),
            isLimitReached: newCount >= GUEST_DAILY_LIMIT
        });
    }, [user]);

    useEffect(() => {
        fetchUsage();

        // ウィンドウフォーカス時に再チェック（日付変更対応）
        const handleFocus = () => fetchUsage();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchUsage]);

    return {
        usage,
        loading,
        refetch: fetchUsage,
        increment: incrementUsage
    };
}

