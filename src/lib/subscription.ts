import { createClient } from '@/utils/supabase/server';

export async function checkSubscriptionStatus(userId: string): Promise<{ isPro: boolean; plan: string }> {
    try {
        const supabase = await createClient();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('plan, subscription_status')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            console.warn('Subscription check failed:', error);
            return { isPro: false, plan: 'free' };
        }

        // Proプランの条件: planが'pro' かつ subscription_statusが'active'または'trialing'
        // ※要件に応じて柔軟に変更（past_dueを許容するかなど）
        const isPro = profile.plan === 'pro' &&
            (profile.subscription_status === 'active' || profile.subscription_status === 'trialing');

        return { isPro, plan: profile.plan };
    } catch (err) {
        console.error('Subscription check error:', err);
        return { isPro: false, plan: 'free' };
    }
}
