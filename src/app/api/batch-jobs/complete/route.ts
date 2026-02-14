import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { devLog } from '@/lib/logger';

const CompleteBatchSchema = z.object({
    batchId: z.string().uuid(),
});

export async function POST(request: Request) {
    return await apiGuard(
        request,
        CompleteBatchSchema,
        async (data, user) => {
            if (!user) {
                return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
            }

            const { batchId } = data;
            const supabase = await createClient();

            // Check if job exists and belongs to user
            const { data: job, error: fetchError } = await supabase
                .from('batch_jobs')
                .select('id')
                .eq('id', batchId)
                .eq('user_id', user.id)
                .single();

            if (fetchError || !job) {
                return NextResponse.json({ error: 'バッチジョブが見つかりません' }, { status: 404 });
            }

            const { error } = await supabase
                .from('batch_jobs')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', batchId);

            if (error) {
                devLog.error('Batch Complete Error:', error);
                return NextResponse.json({ error: 'ステータス更新に失敗しました' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        },
        { requireAuth: true }
    );
}
