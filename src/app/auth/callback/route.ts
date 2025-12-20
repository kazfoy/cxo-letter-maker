import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next'); // 次の遷移先パラメータを取得
  const origin = requestUrl.origin;

  console.log('========== AUTH CALLBACK START ==========');
  console.log('Request URL:', requestUrl.href);
  console.log('Code present:', !!code);
  console.log('Next parameter:', next || 'none');

  if (code) {
    const supabase = await createClient();
    console.log('Exchanging code for session...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ Callback error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    console.log('✅ Session established successfully');

    // nextパラメータが指定されている場合は優先的に使用
    if (next) {
      console.log('➡️  Redirecting to next parameter:', next);
      const redirectUrl = `${origin}${next}`;
      console.log('Full redirect URL:', redirectUrl);
      console.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }

    // nextがない場合は、従来通りpassword_setフラグをチェック
    if (data.user) {
      console.log('User ID:', data.user.id);
      console.log('User email:', data.user.email);
      console.log('User metadata:', JSON.stringify(data.user.user_metadata, null, 2));
      console.log('User app_metadata:', JSON.stringify(data.user.app_metadata, null, 2));

      // user_metadata の password_set フラグをチェック
      const hasPasswordSet = data.user.user_metadata?.password_set === true;
      console.log('password_set flag:', hasPasswordSet);

      if (hasPasswordSet) {
        console.log('✅ Password already set');
        console.log('➡️  Redirecting to: /dashboard');
        const redirectUrl = `${origin}/dashboard`;
        console.log('Full redirect URL:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      } else {
        console.log('❌ Password NOT set');
        console.log('➡️  Redirecting to: /setup-password');
        const redirectUrl = `${origin}/setup-password`;
        console.log('Full redirect URL:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  console.log('⚠️  No code found, redirecting to dashboard');
  console.log('========== AUTH CALLBACK END ==========');
  return NextResponse.redirect(`${origin}/dashboard`);
}
