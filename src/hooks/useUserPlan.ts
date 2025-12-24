'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { type PlanType, getDailyBatchLimit } from '@/config/subscriptionPlans';

export type UserPlan = PlanType;

export function useUserPlan() {
    const { user } = useAuth();
    const [plan, setPlan] = useState<UserPlan>('free'); // Default to free
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPlan() {
            if (!user) {
                setPlan('free');
                setLoading(false);
                return;
            }

            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('profiles')
                    .select('plan')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('Failed to fetch user plan:', error);
                    // Default to free on error
                } else if (data) {
                    setPlan(data.plan as UserPlan);
                }
            } catch (err) {
                console.error('Error fetching plan:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchPlan();
    }, [user]);

    return {
        plan,
        loading,
        isPro: plan === 'pro',
        isPremium: plan === 'premium',
        isFree: plan === 'free',
        dailyBatchLimit: getDailyBatchLimit(plan),
    };
}
