import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing. Please set it in your .env.local file.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Stripe APIバージョン（型定義が追いついていない場合はLatestApiVersionでキャスト）
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    typescript: true,
});
