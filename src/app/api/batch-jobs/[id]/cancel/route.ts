import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: batchId } = await params;
        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        // Update batch job status to cancelled
        const { error: updateError } = await supabase
            .from('batch_jobs')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', batchId)
            .eq('user_id', user.id)
            .eq('status', 'running'); // Only cancel if currently running

        if (updateError) {
            console.error('Cancel Error:', updateError);
            return NextResponse.json({ error: 'キャンセルに失敗しました' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '生成を中断しました' });
    } catch (error) {
        console.error('Cancel API Error:', error);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
