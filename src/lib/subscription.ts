import { createClient } from '@/utils/supabase/server';
import { type PlanType } from '@/config/subscriptionPlans';

export async function checkSubscriptionStatus(userId: string): Promise<{
    isPro: boolean;
    isPremium: boolean;
    plan: PlanType;
}> {
    try {
        const supabase = await createClient();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('plan, subscription_status')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            console.warn('Subscription check failed:', error);
            return { isPro: false, isPremium: false, plan: 'free' };
        }

        const planType = (profile.plan || 'free') as PlanType;
        const activeStatus = profile.subscription_status === 'active' || profile.subscription_status === 'trialing';

        // Proプランの条件: planが'pro' かつ subscription_statusが'active'または'trialing'
        const isPro = planType === 'pro' && activeStatus;

        // Premiumプランの条件: planが'premium' かつ subscription_statusが'active'または'trialing'
        const isPremium = planType === 'premium' && activeStatus;

        return { isPro, isPremium, plan: planType };
    } catch (err) {
        console.error('Subscription check error:', err);
        return { isPro: false, isPremium: false, plan: 'free' };
    }
}
