import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { authGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    return await authGuard(async (user) => {
        try {
            if (!user || !user.email) {
                return NextResponse.json({ error: 'User email is required' }, { status: 400 });
            }

            const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
            if (!priceId) {
                return NextResponse.json({ error: 'Stripe configuration is missing' }, { status: 500 });
            }

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

            let customerId = profile?.stripe_customer_id;

            // リダイレクト先のベースURLを動的に決定
            const origin = request.headers.get('origin');
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000';

            // Checkout Session作成
            const sessionParams: any = {
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${baseUrl}/checkout/success`,
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
                },
            };

            const session = await stripe.checkout.sessions.create(sessionParams);

            return NextResponse.json({ url: session.url });
        } catch (error: any) {
            console.error('Checkout error:', error);
            return NextResponse.json(
                { error: 'Failed to create checkout session', details: error.message },
                { status: 500 }
            );
        }
    });
}
