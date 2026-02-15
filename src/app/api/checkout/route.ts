import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/errorUtils';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { authGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';
import { PlanType, getPlanConfig } from '@/config/subscriptionPlans';
import { devLog } from '@/lib/logger';

export async function POST(request: Request) {
    return await authGuard(async (user) => {
        try {
            if (!user || !user.email) {
                return NextResponse.json({ error: 'User email is required' }, { status: 400 });
            }

            const { planType = 'pro' } = await request.json();
            devLog.log(`[Checkout API] planType received: ${planType}`);

            // USE getPlanConfig for robust environment variable resolution
            const plan = getPlanConfig(planType as PlanType);
            devLog.log(`[Checkout API] Resolved plan configuration:`, {
                label: plan.label,
                hasPriceId: !!plan.stripePriceId,
                priceId: plan.stripePriceId?.substring(0, 8) + '...' // Log partially for privacy, but confirm it exists
            });

            if (!plan || !plan.stripePriceId) {
                const envVarName = planType === 'pro' ? 'STRIPE_PRICE_ID_PRO_MONTHLY' : 'STRIPE_PRICE_ID_PREMIUM_MONTHLY';
                const errorMsg = `Stripe Price ID is missing for plan: ${planType}. Please check if ${envVarName} is set in your environment variables (.env.local).`;
                devLog.error(`[Checkout API Error] ${errorMsg}`);
                return NextResponse.json({
                    error: 'Invalid plan selected or Stripe configuration is missing',
                    details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
                }, { status: 400 });
            }

            const priceId = plan.stripePriceId;
            devLog.log(`[Checkout API] Proceeding with priceId: ${priceId}`);

            // 既存のCustomerIDを取得するか確認
            // (ここでは簡単のため、毎回Checkoutで顧客を作成するのではなく、
            //  既存のStripe Customer IDがあればそれを使うのがベストだが、
            //  実装簡易化のため、emailで既存顧客を検索するか、メタデータで紐付ける)

            const supabase = await createClient();
            const { data: profile } = await supabase
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', user.id)
                .single();

            const customerId = profile?.stripe_customer_id;

            // リダイレクト先のベースURLを動的に決定
            const origin = request.headers.get('origin');
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000';

            // Checkout Session作成
            const sessionParams: Stripe.Checkout.SessionCreateParams = {
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${baseUrl}/checkout/success?plan=${planType}`,
                cancel_url: `${baseUrl}/dashboard/settings?canceled=true`,
                // ユーザーIDをメタデータに含める（Webhookで紐付けに使用）
                metadata: {
                    userId: user.id,
                },
                // 既存顧客IDがあれば使用、なければemailをCustomer emailとしてセット（新規作成される）
                customer: customerId || undefined,
                customer_email: customerId ? undefined : user.email,

                // サブスクリプションデータにもメタデータを入れる（念のため）
                subscription_data: {
                    metadata: {
                        userId: user.id,
                    },
                    trial_period_days: 7,
                },
            };

            const session = await stripe.checkout.sessions.create(sessionParams);

            return NextResponse.json({ url: session.url });
        } catch (error: unknown) {
            devLog.error('Checkout error:', error);
            return NextResponse.json(
                { error: 'Failed to create checkout session', details: getErrorMessage(error) },
                { status: 500 }
            );
        }
    });
}
