'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export function useCheckout() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async (planType: string = 'pro') => {
        try {
            setLoading(true);
            setError(null);

            if (!user) {
                // If not logged in, redirect to login with redirect back to this page
                const currentPath = window.location.pathname;
                router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
                return;
            }

            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, planType })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                throw new Error('決済URLの取得に失敗しました');
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            setError(err.message || '予期せぬエラーが発生しました');
            alert('エラーが発生しました: ' + (err.message || '予期せぬエラーが発生しました'));
        } finally {
            setLoading(false);
        }
    };

    return {
        handleUpgrade,
        loading,
        error
    };
}
