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
      console.log('User metadata:', data.user.user_metadata);

      // user_metadata の password_set フラグをチェック
      const hasPasswordSet = data.user.user_metadata?.password_set === true;

      if (hasPasswordSet) {
        console.log('Password already set, redirecting to dashboard');
        return NextResponse.redirect(`${origin}/dashboard`);
      } else {
        console.log('Password not set, redirecting to password setup');
        return NextResponse.redirect(`${origin}/setup-password`);
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/dashboard`);
}
