import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';

const InitBatchSchema = z.object({
    totalCount: z.number().int().positive(),
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
            const batchId = crypto.randomUUID();
            const supabase = await createClient();

            const { error } = await supabase.from('batch_jobs').insert({
                id: batchId,
                user_id: user.id,
                status: 'running',
                total_count: totalCount,
                completed_count: 0,
                failed_count: 0
            });

            if (error) {
                console.error('Batch Init Error:', error);
                return NextResponse.json({ error: 'バッチジョブの作成に失敗しました' }, { status: 500 });
            }

            return NextResponse.json({ batchId });
        },
        { requireAuth: true }
    );
}
