/**
 * チーム招待API
 * POST: メンバーを招待
 * GET: 保留中の招待一覧を取得
 */

import { NextResponse } from 'next/server';
import { authGuard } from '@/lib/api-guard';
import { createClient } from '@/utils/supabase/server';
import { devLog } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorUtils';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const body = await request.json();

      // 招待承諾アクション
      if (body.action === 'accept' && body.token) {
        return await handleAcceptInvitation(user, body.token);
      }

      const { email } = body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
      }

      const normalizedEmail = email.trim().toLowerCase();

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership, error: membershipError } = await (supabase as any)
        .from('team_members')
        .select('role')
        .eq('team_id', profile.team_id)
        .eq('user_id', user.id)
        .single();

      if (membershipError || !membership || membership.role !== 'admin') {
        return NextResponse.json({ error: '招待する権限がありません。管理者のみ招待できます' }, { status: 403 });
      }

      // チーム情報を取得（max_seats確認）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team, error: teamError } = await (supabase as any)
        .from('teams')
        .select('id, max_seats')
        .eq('id', profile.team_id)
        .single();

      if (teamError || !team) {
        return NextResponse.json({ error: 'チーム情報の取得に失敗しました' }, { status: 500 });
      }

      // 現在のメンバー数を確認
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: memberCount, error: countError } = await (supabase as any)
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id);

      if (countError) {
        devLog.warn('Member count failed:', countError);
        return NextResponse.json({ error: 'メンバー数の確認に失敗しました' }, { status: 500 });
      }

      if ((memberCount ?? 0) >= team.max_seats) {
        return NextResponse.json({
          error: `チームの最大人数（${team.max_seats}名）に達しています。プランをアップグレードしてください`,
        }, { status: 403 });
      }

      // 既に招待済みでないか確認（pending状態）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingInvite } = await (supabase as any)
        .from('team_invitations')
        .select('id')
        .eq('team_id', profile.team_id)
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        return NextResponse.json({ error: 'このメールアドレスには既に招待を送信済みです' }, { status: 409 });
      }

      // 既にチームメンバーでないか確認
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingMembers } = await (supabase as any)
        .from('team_members')
        .select('user_id')
        .eq('team_id', profile.team_id);

      if (existingMembers && existingMembers.length > 0) {
        // メンバーのメールアドレスを確認
        for (const member of existingMembers) {
          const { data: memberProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', member.user_id)
            .single();

          if (memberProfile?.email === normalizedEmail) {
            return NextResponse.json({ error: 'このユーザーは既にチームメンバーです' }, { status: 409 });
          }
        }
      }

      // 招待トークンを生成
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

      // 招待を作成
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invitation, error: inviteError } = await (supabase as any)
        .from('team_invitations')
        .insert({
          team_id: profile.team_id,
          email: normalizedEmail,
          invited_by: user.id,
          status: 'pending',
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select('id, email, status, expires_at, created_at')
        .single();

      if (inviteError || !invitation) {
        devLog.error('Invitation creation failed:', inviteError);
        return NextResponse.json({ error: '招待の作成に失敗しました' }, { status: 500 });
      }

      devLog.log('Invitation created for:', normalizedEmail);

      return NextResponse.json({ invitation }, { status: 201 });
    } catch (error) {
      devLog.error('Invite POST error:', getErrorMessage(error));
      return NextResponse.json({ error: '招待の送信に失敗しました' }, { status: 500 });
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // トークンベースの招待情報取得（認証不要 — 招待承諾ページ用）
  if (token) {
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invite, error } = await (supabase as any)
        .from('team_invitations')
        .select('id, team_id, email, invited_by, status, expires_at')
        .eq('token', token)
        .single();

      if (error || !invite) {
        return NextResponse.json({ error: 'この招待は見つかりません' }, { status: 404 });
      }

      // チーム名を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: team } = await (supabase as any)
        .from('teams')
        .select('name')
        .eq('id', invite.team_id)
        .single();

      // 招待者のメールを取得
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', invite.invited_by)
        .single();

      return NextResponse.json({
        invitation: {
          team_name: team?.name || '不明',
          inviter_email: inviterProfile?.email || '不明',
          status: invite.status,
          expires_at: invite.expires_at,
        },
      });
    } catch (error) {
      devLog.error('Invite token lookup error:', getErrorMessage(error));
      return NextResponse.json({ error: '招待情報の取得に失敗しました' }, { status: 500 });
    }
  }

  // 認証済みユーザーのチーム招待一覧取得
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const supabase = await createClient();

      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (!profile?.team_id) {
        return NextResponse.json({ error: 'チームに所属していません' }, { status: 403 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invitations, error: inviteError } = await (supabase as any)
        .from('team_invitations')
        .select('id, email, status, invited_by, expires_at, created_at')
        .eq('team_id', profile.team_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inviteError) {
        devLog.warn('Invitations fetch failed:', inviteError);
        return NextResponse.json({ error: '招待一覧の取得に失敗しました' }, { status: 500 });
      }

      return NextResponse.json({ invitations: invitations ?? [] });
    } catch (error) {
      devLog.error('Invite GET error:', getErrorMessage(error));
      return NextResponse.json({ error: '招待一覧の取得に失敗しました' }, { status: 500 });
    }
  });
}

/**
 * 招待承諾処理
 */
async function handleAcceptInvitation(
  user: { id: string; email?: string },
  token: string
): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // 招待を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invite, error: inviteError } = await (supabase as any)
      .from('team_invitations')
      .select('id, team_id, email, status, expires_at')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'この招待は見つかりません' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'この招待は既に処理されています' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'この招待は期限切れです' }, { status: 400 });
    }

    // チームにメンバーとして追加
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from('team_members')
      .insert({
        team_id: invite.team_id,
        user_id: user.id,
        role: 'member',
      });

    if (memberError) {
      devLog.error('Failed to add team member:', memberError);
      return NextResponse.json({ error: 'チームへの参加に失敗しました' }, { status: 500 });
    }

    // profilesにteam_idを設定
    await supabase
      .from('profiles')
      .update({ team_id: invite.team_id })
      .eq('id', user.id);

    // 招待ステータスを更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    devLog.log(`User ${user.id} accepted invitation to team ${invite.team_id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    devLog.error('Accept invitation error:', getErrorMessage(error));
    return NextResponse.json({ error: '招待の承諾に失敗しました' }, { status: 500 });
  }
}
