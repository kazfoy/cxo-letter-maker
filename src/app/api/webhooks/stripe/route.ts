import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js'; // Use admin client for webhook updates
import { getErrorMessage } from '@/lib/errorUtils';
import { devLog } from '@/lib/logger';

// Admin client required to update other users' profiles (bypass RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not set');
        }
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        devLog.error('Webhook signature verification failed.', message);
        return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const planType = session.metadata?.planType || 'pro';
                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;

                if (userId && subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const isTeamPlan = planType === 'team' || planType === 'business';

                    if (isTeamPlan) {
                        // チームプランの場合: teamsテーブルを作成/更新
                        const maxSeats = planType === 'business' ? 20 : 5;
                        const { data: team, error: teamError } = await supabase
                            .from('teams')
                            .insert({
                                name: `${userId}のチーム`,
                                owner_id: userId,
                                plan: planType,
                                stripe_customer_id: customerId,
                                stripe_subscription_id: subscriptionId,
                                subscription_status: subscription.status,
                                max_seats: maxSeats,
                            })
                            .select('id')
                            .single();

                        if (teamError) {
                            devLog.error(`[Webhook] Failed to create team for user ${userId}:`, teamError.message);
                            return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
                        }

                        if (team) {
                            // オーナーをadminとしてチームに追加
                            const { error: memberError } = await supabase
                                .from('team_members')
                                .insert({
                                    team_id: team.id,
                                    user_id: userId,
                                    role: 'admin',
                                });
                            if (memberError) {
                                devLog.error(`[Webhook] Failed to add team member for user ${userId}:`, memberError.message);
                            }

                            // profilesにteam_idを設定
                            const { error: profileError } = await supabase
                                .from('profiles')
                                .update({
                                    stripe_customer_id: customerId,
                                    team_id: team.id,
                                    subscription_status: subscription.status,
                                    ...(subscription.trial_end ? { trial_end: new Date(subscription.trial_end * 1000).toISOString() } : {}),
                                })
                                .eq('id', userId);
                            if (profileError) {
                                devLog.error(`[Webhook] Failed to update profile for user ${userId}:`, profileError.message);
                                return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
                            }
                        }
                    } else {
                        // 個人プランの場合: profilesを更新
                        const updateData: Record<string, unknown> = {
                            stripe_customer_id: customerId,
                            plan: planType,
                            subscription_status: subscription.status,
                        };

                        if (subscription.trial_end) {
                            updateData.trial_end = new Date(subscription.trial_end * 1000).toISOString();
                        }

                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update(updateData)
                            .eq('id', userId);
                        if (updateError) {
                            devLog.error(`[Webhook] Failed to update profile for user ${userId}:`, updateError.message);
                            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
                        }
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata?.userId;
                const planType = subscription.metadata?.planType;
                const isTeamPlan = planType === 'team' || planType === 'business';

                const status = subscription.status;
                const isActive = status === 'active' || status === 'trialing';

                if (isTeamPlan) {
                    // チームプラン: teamsテーブルを更新
                    const { error: teamUpdateError } = await supabase
                        .from('teams')
                        .update({
                            subscription_status: status,
                            plan: isActive ? planType : 'free',
                        })
                        .eq('stripe_subscription_id', subscription.id);
                    if (teamUpdateError) {
                        devLog.error(`[Webhook] Failed to update team subscription:`, teamUpdateError.message);
                        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
                    }
                } else {
                    // 個人プラン: profilesを更新
                    let targetUserId = userId;
                    if (!targetUserId) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('stripe_customer_id', subscription.customer as string)
                            .single();
                        targetUserId = profile?.id;
                    }

                    if (targetUserId) {
                        const plan = isActive ? (planType || 'pro') : 'free';

                        const updateData: Record<string, unknown> = {
                            subscription_status: status,
                            plan: plan,
                        };

                        if (subscription.trial_end) {
                            updateData.trial_end = new Date(subscription.trial_end * 1000).toISOString();
                        } else {
                            updateData.trial_end = null;
                        }

                        const { error: profileUpdateError } = await supabase
                            .from('profiles')
                            .update(updateData)
                            .eq('id', targetUserId);
                        if (profileUpdateError) {
                            devLog.error(`[Webhook] Failed to update profile for user ${targetUserId}:`, profileUpdateError.message);
                            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
                        }
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const planType = subscription.metadata?.planType;
                const isTeamPlan = planType === 'team' || planType === 'business';

                if (isTeamPlan) {
                    // チームプラン: teamsテーブルを更新
                    const { error: teamCancelError } = await supabase
                        .from('teams')
                        .update({
                            subscription_status: 'canceled',
                        })
                        .eq('stripe_subscription_id', subscription.id);
                    if (teamCancelError) {
                        devLog.error(`[Webhook] Failed to cancel team subscription:`, teamCancelError.message);
                        return NextResponse.json({ error: 'Failed to cancel team' }, { status: 500 });
                    }
                } else {
                    // 個人プラン: profilesを更新
                    let targetUserId = subscription.metadata?.userId;
                    if (!targetUserId) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('stripe_customer_id', subscription.customer as string)
                            .single();
                        targetUserId = profile?.id;
                    }

                    if (targetUserId) {
                        const { error: cancelError } = await supabase
                            .from('profiles')
                            .update({
                                subscription_status: 'canceled',
                                plan: 'free',
                            })
                            .eq('id', targetUserId);
                        if (cancelError) {
                            devLog.error(`[Webhook] Failed to cancel profile for user ${targetUserId}:`, cancelError.message);
                            return NextResponse.json({ error: 'Failed to cancel profile' }, { status: 500 });
                        }
                    }
                }
                break;
            }
        }
    } catch (error: unknown) {
        devLog.error('Webhook handler failed:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
