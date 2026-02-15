'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { type PlanType, getDailyBatchLimit } from '@/config/subscriptionPlans';
import { devLog } from '@/lib/logger';

export type UserPlan = PlanType;

export function useUserPlan() {
    const { user } = useAuth();
    const [plan, setPlan] = useState<UserPlan>('free'); // Default to free
    const [loading, setLoading] = useState(true);
    const [trialEnd, setTrialEnd] = useState<Date | null>(null);

    useEffect(() => {
        async function fetchPlan() {
            if (!user) {
                setPlan('free');
                setTrialEnd(null);
                setLoading(false);
                return;
            }

            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('profiles')
                    .select('plan, trial_end')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    devLog.error('Failed to fetch user plan:', error);
                    // Default to free on error
                } else if (data) {
                    setPlan(data.plan as UserPlan);
                    setTrialEnd(data.trial_end ? new Date(data.trial_end) : null);
                }
            } catch (err) {
                devLog.error('Error fetching plan:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchPlan();
    }, [user]);

    const isTrialing = trialEnd !== null && trialEnd > new Date();
    const trialDaysRemaining = isTrialing
        ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)
        : null;

    return {
        plan,
        loading,
        isPro: plan === 'pro',
        isPremium: plan === 'premium',
        isFree: plan === 'free',
        dailyBatchLimit: getDailyBatchLimit(plan),
        isTrialing,
        trialDaysRemaining,
    };
}
