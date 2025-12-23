import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js'; // Use admin client for webhook updates
import { getErrorMessage } from '@/lib/errorUtils';

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
        console.error('Webhook signature verification failed.', message);
        return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // userIdをメタデータから取得
                const userId = session.metadata?.userId;
                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;

                if (userId && subscriptionId) {
                    // サブスクリプション詳細を取得
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                    await supabase
                        .from('profiles')
                        .update({
                            stripe_customer_id: customerId,
                            plan: 'pro',
                            subscription_status: subscription.status,
                        })
                        .eq('id', userId);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata?.userId;

                // Note: subscription object usually doesn't carry metadata from checkout unless explicitly copied.
                // If metadata is missing, we might need to find user by stripe_customer_id

                let targetUserId = userId;
                if (!targetUserId) {
                    // Find user by stripe_customer_id
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', subscription.customer as string)
                        .single();
                    targetUserId = profile?.id;
                }

                if (targetUserId) {
                    const status = subscription.status;
                    // active or trialing => pro
                    // past_due, canceled, unpaid => free (or handle gracefully)
                    const plan = (status === 'active' || status === 'trialing') ? 'pro' : 'free';

                    await supabase
                        .from('profiles')
                        .update({
                            subscription_status: status,
                            plan: plan,
                        })
                        .eq('id', targetUserId);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                let targetUserId = subscription.metadata?.userId;
                if (!targetUserId) {
                    // Find user by stripe_customer_id
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', subscription.customer as string)
                        .single();
                    targetUserId = profile?.id;
                }

                if (targetUserId) {
                    await supabase
                        .from('profiles')
                        .update({
                            subscription_status: 'canceled',
                            plan: 'free',
                        })
                        .eq('id', targetUserId);
                }
                break;
            }
        }
    } catch (error: unknown) {
        console.error('Webhook handler failed:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
