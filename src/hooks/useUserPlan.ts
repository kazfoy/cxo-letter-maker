'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { type PlanType, getDailyBatchLimit } from '@/config/subscriptionPlans';
import { devLog } from '@/lib/logger';

export type UserPlan = PlanType;

export function useUserPlan() {
    const { user } = useAuth();
    const [plan, setPlan] = useState<UserPlan>('free');
    const [loading, setLoading] = useState(true);
    const [trialEnd, setTrialEnd] = useState<Date | null>(null);
    const [teamId, setTeamId] = useState<string | null>(null);
    const [teamName, setTeamName] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPlan() {
            if (!user) {
                setPlan('free');
                setTrialEnd(null);
                setTeamId(null);
                setTeamName(null);
                setLoading(false);
                return;
            }

            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('profiles')
                    .select('plan, trial_end, team_id')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    devLog.error('Failed to fetch user plan:', error);
                } else if (data) {
                    let resolvedPlan = data.plan as UserPlan;
                    setTrialEnd(data.trial_end ? new Date(data.trial_end) : null);

                    // チーム所属時はチームのプランを確認
                    if (data.team_id) {
                        setTeamId(data.team_id);
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const { data: team } = await (supabase as any)
                                .from('teams')
                                .select('plan, subscription_status, name')
                                .eq('id', data.team_id)
                                .single();

                            if (team) {
                                setTeamName(team.name);
                                const teamActive = team.subscription_status === 'active' || team.subscription_status === 'trialing';
                                if (teamActive && ['team', 'business'].includes(team.plan)) {
                                    // チームプランが有効なら、チームのプランを使用
                                    resolvedPlan = team.plan as UserPlan;
                                }
                            }
                        } catch (err) {
                            devLog.warn('Failed to fetch team plan:', err);
                        }
                    } else {
                        setTeamId(null);
                        setTeamName(null);
                    }

                    setPlan(resolvedPlan);
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

    const isPaidPlan = ['pro', 'premium', 'team', 'business'].includes(plan);

    return {
        plan,
        loading,
        isPro: isPaidPlan,
        isPremium: plan === 'premium' || plan === 'business',
        isFree: plan === 'free',
        isTeamPlan: plan === 'team' || plan === 'business',
        teamId,
        teamName,
        dailyBatchLimit: getDailyBatchLimit(plan),
        isTrialing,
        trialDaysRemaining,
    };
}
