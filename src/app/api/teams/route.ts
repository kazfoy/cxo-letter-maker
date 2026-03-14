/**
 * チーム管理API
 * GET: ユーザーのチーム情報を取得
 * POST: 新規チームを作成
 */

import { NextResponse } from 'next/server';
import { authGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';
import { devLog } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorUtils';

export async function GET() {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const supabase = await createClient();

      // プロフィールからteam_idを取得
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        devLog.warn('Profile fetch failed:', profileError);
        return NextResponse.json({ error: 'プロフィールが見つかりません' }, { status: 404 });
      }

      if (!profile.team_id) {
        return NextResponse.json({ team: null });
      }

      // チーム情報を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team, error: teamError } = await (supabase as any)
        .from('teams')
        .select('id, name, owner_id, plan, max_seats, subscription_status, created_at')
        .eq('id', profile.team_id)
        .single();

      if (teamError || !team) {
        devLog.warn('Team fetch failed:', teamError);
        return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });
      }

      // メンバー数を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error: countError } = await (supabase as any)
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id);

      if (countError) {
        devLog.warn('Member count failed:', countError);
      }

      return NextResponse.json({
        team: {
          ...team,
          memberCount: count ?? 0,
        },
      });
    } catch (error) {
      devLog.error('Team GET error:', getErrorMessage(error));
      return NextResponse.json({ error: 'チーム情報の取得に失敗しました' }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const body = await request.json();
      const { name } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'チーム名は必須です' }, { status: 400 });
      }

      if (name.trim().length > 100) {
        return NextResponse.json({ error: 'チーム名は100文字以内で入力してください' }, { status: 400 });
      }

      const supabase = await createClient();

      // 既にチームに所属していないか確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (profile?.team_id) {
        return NextResponse.json({ error: '既にチームに所属しています' }, { status: 409 });
      }

      // チームを作成
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team, error: teamError } = await (supabase as any)
        .from('teams')
        .insert({
          name: name.trim(),
          owner_id: user.id,
          plan: 'free',
          max_seats: 5,
        })
        .select('id, name, owner_id, plan, max_seats, created_at')
        .single();

      if (teamError || !team) {
        devLog.error('Team creation failed:', teamError);
        return NextResponse.json({ error: 'チームの作成に失敗しました' }, { status: 500 });
      }

      // オーナーをadminとしてteam_membersに追加
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: memberError } = await (supabase as any)
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) {
        devLog.error('Team member insert failed:', memberError);
        // チームは作成済みなのでロールバック
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('teams').delete().eq('id', team.id);
        return NextResponse.json({ error: 'チームメンバーの登録に失敗しました' }, { status: 500 });
      }

      // プロフィールのteam_idを更新
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ team_id: team.id } as never)
        .eq('id', user.id);

      if (profileError) {
        devLog.error('Profile update failed:', profileError);
        // ロールバック
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('teams').delete().eq('id', team.id);
        return NextResponse.json({ error: 'プロフィールの更新に失敗しました' }, { status: 500 });
      }

      devLog.log('Team created:', team.id);

      return NextResponse.json({
        team: {
          ...team,
          memberCount: 1,
        },
      }, { status: 201 });
    } catch (error) {
      devLog.error('Team POST error:', getErrorMessage(error));
      return NextResponse.json({ error: 'チームの作成に失敗しました' }, { status: 500 });
    }
  });
}

/**
 * PATCH: チーム情報を更新（名前変更など）
 */
export async function PATCH(request: Request) {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const body = await request.json();
      const { name } = body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'チーム名は必須です' }, { status: 400 });
      }

      const supabase = await createClient();

      // ユーザーのチームを確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (!profile?.team_id) {
        return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
      }

      // オーナーかadminかチェック
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team } = await (supabase as any)
        .from('teams')
        .select('owner_id')
        .eq('id', profile.team_id)
        .single();

      if (!team || team.owner_id !== user.id) {
        return NextResponse.json({ error: 'チーム名を変更する権限がありません' }, { status: 403 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('teams')
        .update({ name: name.trim() })
        .eq('id', profile.team_id);

      if (updateError) {
        devLog.error('Team update failed:', updateError);
        return NextResponse.json({ error: 'チーム名の更新に失敗しました' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      devLog.error('Team PATCH error:', getErrorMessage(error));
      return NextResponse.json({ error: 'チーム情報の更新に失敗しました' }, { status: 500 });
    }
  });
}
