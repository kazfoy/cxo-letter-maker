import { createClient } from '@/utils/supabase/server';
import { type PlanType } from '@/config/subscriptionPlans';
import { devLog } from '@/lib/logger';
import type { AnalysisDepth } from '@/lib/urlAnalysis';

export async function checkSubscriptionStatus(userId: string): Promise<{
    isPro: boolean;
    isPremium: boolean;
    plan: PlanType;
}> {
    try {
        const supabase = await createClient();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('plan, subscription_status, team_id')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            devLog.warn('Subscription check failed:', error);
            return { isPro: false, isPremium: false, plan: 'free' };
        }

        let planType = (profile.plan || 'free') as PlanType;
        let activeStatus = profile.subscription_status === 'active' || profile.subscription_status === 'trialing';

        // チームに所属している場合、チームのプランを確認
        if (profile.team_id) {
            const teamPlan = await getTeamPlan(supabase, profile.team_id);
            if (teamPlan) {
                // チームプランが個人プランより上位なら、チームプランを使用
                const teamTier = (['team', 'business'].includes(teamPlan.plan)) ? 2 : 0;
                const individualTier = planType === 'pro' ? 1 : planType === 'premium' ? 2 : 0;
                if (teamTier > individualTier) {
                    planType = teamPlan.plan as PlanType;
                    activeStatus = teamPlan.isActive;
                }
            }
        }

        const isPaidAndActive = activeStatus;
        const isPro = isPaidAndActive && ['pro', 'team', 'business'].includes(planType);
        const isPremium = isPaidAndActive && ['premium', 'business'].includes(planType);

        return { isPro, isPremium, plan: planType };
    } catch (err) {
        devLog.error('Subscription check error:', err);
        return { isPro: false, isPremium: false, plan: 'free' };
    }
}

/**
 * チームのプラン情報を取得
 */
async function getTeamPlan(
    supabase: Awaited<ReturnType<typeof createClient>>,
    teamId: string
): Promise<{ plan: string; isActive: boolean } | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: team, error } = await (supabase as any)
            .from('teams')
            .select('plan, subscription_status')
            .eq('id', teamId)
            .single();

        if (error || !team) return null;

        return {
            plan: team.plan,
            isActive: team.subscription_status === 'active' || team.subscription_status === 'trialing',
        };
    } catch {
        return null;
    }
}

/**
 * プランに基づく分析深度を返す
 * Free/Guest: basic（トップページのみ）
 * Pro/Premium: deep（サブルート探索 + 記事クロール + Google検索フォールバック）
 */
export function getAnalysisDepth(plan: PlanType): AnalysisDepth {
    return ['pro', 'premium', 'team', 'business'].includes(plan) ? 'deep' : 'basic';
}

/**
 * プランに基づく生成機能の制限を返す
 */
export function getGenerationLimits(plan: PlanType) {
    if (['pro', 'premium', 'team', 'business'].includes(plan)) {
        return {
            modes: ['draft', 'complete', 'event'] as const,
            qualityGate: true,
            variations: true,
            maxSubjects: 5,
            citationTracking: true,
        };
    }
    return {
        modes: ['draft'] as const,
        qualityGate: false,
        variations: false,
        maxSubjects: 1,
        citationTracking: false,
    };
}
