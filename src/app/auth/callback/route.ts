import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const origin = requestUrl.origin;

  console.log('========== AUTH CALLBACK START ==========');
  console.log('Request URL:', requestUrl.href);
  console.log('Code present:', !!code);
  console.log('Next parameter:', next);

  if (code) {
    const supabase = await createClient();
    console.log('Exchanging code for session...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ Callback error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    console.log('✅ Session established successfully');
    console.log('User ID:', data.user?.id);
    console.log('User email:', data.user?.email);
    console.log('User metadata:', JSON.stringify(data.user?.user_metadata, null, 2));
    
    // nextパラメータが指定されている場合はそれを使用（最優先）
    if (next) {
      const redirectUrl = `${origin}${next}`;
      console.log('➡️  Redirecting to next parameter:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }

    // nextパラメータが無い場合の処理
    // Magic Link経由の認証 = 新規登録または再認証の可能性
    // パスワード設定済みフラグをチェック
    const hasPasswordSet = data.user?.user_metadata?.password_set === true;
    
    if (hasPasswordSet) {
      // パスワード設定済み = 既存ユーザーの再ログイン → ダッシュボードへ
      console.log('✅ Password already set, redirecting to dashboard');
      const redirectUrl = `${origin}/dashboard`;
      console.log('➡️  Redirecting to:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    } else {
      // パスワード未設定 = 新規登録 → パスワード設定画面へ
      // これがMagic Link経由の新規登録のデフォルト動作
      console.log('🔐 Password not set (or flag not set), redirecting to setup-password');
      console.log('This is likely a new user registration via Magic Link');
      const redirectUrl = `${origin}/setup-password`;
      console.log('➡️  Redirecting to:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // codeが無い場合は /login へリダイレクト
  console.log('❌ No code parameter, redirecting to login');
  console.log('========== AUTH CALLBACK END ==========');
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
