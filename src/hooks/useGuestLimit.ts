'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

    const fetchUsage = useCallback(async () => {
        if (user) {
            setUsage(null);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/guest/usage');
            if (res.ok) {
                const data = await res.json();
                setUsage(data);
            }
        } catch (error) {
            console.error('Failed to fetch guest usage:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    return { usage, loading, refetch: fetchUsage };
}
