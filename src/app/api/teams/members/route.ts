/**
 * チームメンバー管理API
 * GET: チームメンバー一覧を取得
 * DELETE: メンバーを削除
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

      // ユーザーのチームを確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (!profile?.team_id) {
        return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
      }

      // チームメンバーを取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members, error: membersError } = await (supabase as any)
        .from('team_members')
        .select('id, user_id, role, joined_at')
        .eq('team_id', profile.team_id)
        .order('joined_at', { ascending: true });

      if (membersError) {
        devLog.warn('Members fetch failed:', membersError);
        return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 });
      }

      if (!members || members.length === 0) {
        return NextResponse.json({ members: [] });
      }

      // 各メンバーのプロフィール情報を取得
      const memberIds = members.map((m: { user_id: string }) => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', memberIds);

      if (profilesError) {
        devLog.warn('Profiles fetch failed:', profilesError);
      }

      // プロフィール情報をマージ
      const profileMap = new Map(
        (profiles ?? []).map((p: { id: string; email: string | null; display_name: string | null }) => [p.id, p])
      );

      const enrichedMembers = members.map((member: { user_id: string; id: string; role: string; joined_at: string }) => {
        const memberProfile = profileMap.get(member.user_id) as { email?: string | null; display_name?: string | null } | undefined;
        return {
          id: member.id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.joined_at,
          email: memberProfile?.email ?? null,
          name: memberProfile?.display_name ?? null,
        };
      });

      return NextResponse.json({ members: enrichedMembers });
    } catch (error) {
      devLog.error('Members GET error:', getErrorMessage(error));
      return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 });
    }
  });
}

export async function DELETE(request: Request) {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const body = await request.json();
      const { userId } = body;

      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'ユーザーIDは必須です' }, { status: 400 });
      }

      const supabase = await createClient();

      // ユーザーのチームとロールを確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (!profile?.team_id) {
        return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
      }

      // 操作者がadminか確認
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership, error: membershipError } = await (supabase as any)
        .from('team_members')
        .select('role')
        .eq('team_id', profile.team_id)
        .eq('user_id', user.id)
        .single();

      if (membershipError || !membership || membership.role !== 'admin') {
        return NextResponse.json({ error: 'メンバーを削除する権限がありません。管理者のみ削除できます' }, { status: 403 });
      }

      // チームのオーナーは削除不可
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team, error: teamError } = await (supabase as any)
        .from('teams')
        .select('owner_id')
        .eq('id', profile.team_id)
        .single();

      if (teamError || !team) {
        return NextResponse.json({ error: 'チーム情報の取得に失敗しました' }, { status: 500 });
      }

      if (team.owner_id === userId) {
        return NextResponse.json({ error: 'チームオーナーを削除することはできません' }, { status: 403 });
      }

      // 対象ユーザーがチームメンバーか確認
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: targetMember, error: targetError } = await (supabase as any)
        .from('team_members')
        .select('id')
        .eq('team_id', profile.team_id)
        .eq('user_id', userId)
        .single();

      if (targetError || !targetMember) {
        return NextResponse.json({ error: '指定されたユーザーはチームメンバーではありません' }, { status: 404 });
      }

      // メンバーを削除
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('team_members')
        .delete()
        .eq('team_id', profile.team_id)
        .eq('user_id', userId);

      if (deleteError) {
        devLog.error('Member deletion failed:', deleteError);
        return NextResponse.json({ error: 'メンバーの削除に失敗しました' }, { status: 500 });
      }

      // 削除されたユーザーのprofiles.team_idをnullに更新
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ team_id: null } as never)
        .eq('id', userId);

      if (profileUpdateError) {
        devLog.warn('Profile team_id clear failed:', profileUpdateError);
        // メンバー削除は成功しているので警告のみ
      }

      devLog.log('Member removed from team:', userId);

      return NextResponse.json({ success: true });
    } catch (error) {
      devLog.error('Members DELETE error:', getErrorMessage(error));
      return NextResponse.json({ error: 'メンバーの削除に失敗しました' }, { status: 500 });
    }
  });
}
