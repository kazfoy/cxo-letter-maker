import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Callback error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    // セッションが確立された後、パスワード設定状態をチェック
    if (data.user) {
      console.log('User authenticated:', data.user.id);

      // ユーザーのメタデータまたは最終サインイン方法をチェック
      // Magic Link経由の初回ログインの場合、パスワード設定画面へ
      // app_metadata.provider が 'email' でidentities[0].identity_data にパスワードがない場合
      const hasPassword = data.user.app_metadata?.providers?.includes('email') &&
                         data.user.identities?.some(identity =>
                           identity.identity_data?.sub !== undefined
                         );

      // より確実な判定: profiles テーブルに password_set フラグがあるかチェック
      // または、単純に /setup-password に必ずリダイレクトし、そちらで判定する方法も

      // Magic Linkでのログイン時は、パスワード未設定と仮定して /setup-password へ
      // パスワードでログインした場合は、auth.callback は通常通過しないため、
      // ここに来る = Magic Link = パスワード未設定の可能性が高い
      console.log('Redirecting to password setup page');
      return NextResponse.redirect(`${origin}/setup-password`);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/dashboard`);
}
