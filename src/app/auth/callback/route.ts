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
    
    // nextパラメータが指定されている場合はそれを使用
    if (next) {
      const redirectUrl = `${origin}${next}`;
      console.log('➡️  Redirecting to next parameter:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }

    // nextパラメータが無い場合、ユーザーのメタデータをチェック
    // パスワード未設定の場合は /setup-password へ、設定済みの場合は /dashboard へ
    const hasPasswordSet = data.user?.user_metadata?.password_set === true;
    
    if (hasPasswordSet) {
      console.log('✅ Password already set, redirecting to dashboard');
      const redirectUrl = `${origin}/dashboard`;
      console.log('➡️  Redirecting to:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    } else {
      console.log('🔐 Password not set, redirecting to setup-password');
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
