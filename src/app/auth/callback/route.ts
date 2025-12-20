import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard'; // デフォルトは /dashboard
  const origin = requestUrl.origin;

  console.log('========== AUTH CALLBACK START ==========');
  console.log('Request URL:', requestUrl.href);
  console.log('Code present:', !!code);
  console.log('Next parameter:', next);

  if (code) {
    const supabase = await createClient();
    console.log('Exchanging code for session...');
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ Callback error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    console.log('✅ Session established successfully');
  }

  // nextパラメータに基づいてリダイレクト
  const redirectUrl = `${origin}${next}`;
  console.log('➡️  Redirecting to:', redirectUrl);
  console.log('========== AUTH CALLBACK END ==========');
  return NextResponse.redirect(redirectUrl);
}
