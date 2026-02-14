import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { apiGuard } from '@/lib/api-guard';
import { devLog } from '@/lib/logger';

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
            const batchId = uuidv4();
            const supabase = await createClient();

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
