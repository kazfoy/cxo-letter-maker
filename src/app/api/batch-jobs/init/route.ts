import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { apiGuard } from '@/lib/api-guard';
import { devLog } from '@/lib/logger';
import { type PlanType, getMaxBatchSizePerRequest } from '@/config/subscriptionPlans';

const ABSOLUTE_MAX_BATCH_SIZE = 500;

const InitBatchSchema = z.object({
    totalCount: z.number().int().positive().max(ABSOLUTE_MAX_BATCH_SIZE, {
        message: `一度にアップロードできるのは最大${ABSOLUTE_MAX_BATCH_SIZE}件です`,
    }),
});

export async function POST(request: Request) {
    return await apiGuard(
        request,
        InitBatchSchema,
        async (data, user) => {
            if (!user) {
                return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
            }

            const { totalCount } = data;
            const supabase = await createClient();

            // ユーザーのプランを取得して件数上限をチェック
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                devLog.error('Failed to fetch user profile for batch limit check:', profileError);
                return NextResponse.json({ error: 'プラン情報の取得に失敗しました' }, { status: 500 });
            }

            const userPlan = (profile.plan || 'free') as PlanType;
            const maxPerRequest = getMaxBatchSizePerRequest(userPlan);

            // Freeプランはバッチ生成不可
            if (maxPerRequest === 0) {
                return NextResponse.json(
                    { error: 'CSV一括生成機能はProプラン以上で利用可能です。' },
                    { status: 403 }
                );
            }

            // プラン別上限チェック
            if (totalCount > maxPerRequest) {
                return NextResponse.json(
                    { error: `一度にアップロードできるのは最大${maxPerRequest}件です（${userPlan === 'pro' ? 'Proプラン' : 'Premiumプラン'}）` },
                    { status: 400 }
                );
            }

            const batchId = uuidv4();

            const { error } = await supabase.from('batch_jobs').insert({
                id: batchId,
                user_id: user.id,
                status: 'processing',
                total_count: totalCount,
                processed_count: 0,
                failure_count: 0
            });

            if (error) {
                devLog.error('Batch Init Error:', error);
                return NextResponse.json({ error: `バッチジョブの作成に失敗しました: ${error.message}` }, { status: 500 });
            }

            return NextResponse.json({ batchId });
        },
        { requireAuth: true }
    );
}
