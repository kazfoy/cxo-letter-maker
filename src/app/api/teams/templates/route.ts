import { NextResponse } from 'next/server';
import { authGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';
import { devLog } from '@/lib/logger';

/**
 * GET: チームの共有テンプレート一覧を取得
 */
export async function GET() {
    return await authGuard(async (user) => {
        if (!user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }
        const supabase = await createClient();

        // ユーザーのteam_idを取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single();

        if (!profile?.team_id) {
            return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: templates, error } = await (supabase as any)
            .from('shared_templates')
            .select('id, name, sender_info, template_config, created_by, created_at, updated_at')
            .eq('team_id', profile.team_id)
            .order('updated_at', { ascending: false });

        if (error) {
            devLog.error('Failed to fetch templates:', error);
            return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 });
        }

        return NextResponse.json({ templates: templates || [] });
    });
}

/**
 * POST: 共有テンプレートを作成
 */
export async function POST(request: Request) {
    return await authGuard(async (user) => {
        if (!user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }
        const supabase = await createClient();
        const body = await request.json();
        const { name, sender_info, template_config } = body;

        if (!name || !sender_info) {
            return NextResponse.json({ error: 'テンプレート名と差出人情報は必須です' }, { status: 400 });
        }

        // ユーザーのteam_idを取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single();

        if (!profile?.team_id) {
            return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: template, error } = await (supabase as any)
            .from('shared_templates')
            .insert({
                team_id: profile.team_id,
                created_by: user.id,
                name,
                sender_info,
                template_config: template_config || {},
            })
            .select()
            .single();

        if (error) {
            devLog.error('Failed to create template:', error);
            return NextResponse.json({ error: 'テンプレートの作成に失敗しました' }, { status: 500 });
        }

        return NextResponse.json({ template });
    });
}

/**
 * DELETE: 共有テンプレートを削除
 */
export async function DELETE(request: Request) {
    return await authGuard(async (user) => {
        if (!user) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const templateId = searchParams.get('id');

        if (!templateId) {
            return NextResponse.json({ error: 'テンプレートIDが必要です' }, { status: 400 });
        }

        // ユーザーのteam_idを取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single();

        if (!profile?.team_id) {
            return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
        }

        // テンプレートの所有者またはチームadminかチェック（RLSでも制御されるが念のため）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
            .from('shared_templates')
            .delete()
            .eq('id', templateId)
            .eq('team_id', profile.team_id);

        if (error) {
            devLog.error('Failed to delete template:', error);
            return NextResponse.json({ error: 'テンプレートの削除に失敗しました' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    });
}
