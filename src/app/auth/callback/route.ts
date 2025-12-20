import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { devLog } from '@/lib/logger';

/**
 * nextパラメータの検証（オープンリダイレクト対策）
 * 同一オリジンかつ相対パス（/で始まる）のみ許可
 */
function validateNextParameter(next: string | null, origin: string): string | null {
  if (!next) return null;

  // 相対パス（/で始まる）のみ許可
  if (!next.startsWith('/')) {
    devLog.warn('Invalid next parameter: must start with /', next);
    return null;
  }

  // プロトコルを含む絶対URLを拒否
  if (next.includes('://')) {
    devLog.warn('Invalid next parameter: absolute URL not allowed', next);
    return null;
  }

  // 許可されたパスのホワイトリスト
  const allowedPaths = ['/dashboard', '/setup-password', '/'];
  const isAllowed = allowedPaths.some(path => next === path || next.startsWith(`${path}/`) || next.startsWith(`${path}?`));

  if (!isAllowed) {
    devLog.warn('Invalid next parameter: not in allowed paths', next);
    return null;
  }

  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextParam = requestUrl.searchParams.get('next');
  const origin = requestUrl.origin;

  devLog.log('========== AUTH CALLBACK START ==========');
  devLog.log('Code present:', !!code);

  if (code) {
    const supabase = await createClient();
    devLog.log('Exchanging code for session...');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      devLog.error('Callback error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    devLog.log('Session established successfully');

    // nextパラメータの検証（オープンリダイレクト対策）
    const validatedNext = validateNextParameter(nextParam, origin);

    // nextパラメータが指定されている場合はそれを使用（最優先）
    if (validatedNext) {
      const redirectUrl = `${origin}${validatedNext}`;
      devLog.log('Redirecting to validated next parameter:', validatedNext);
      devLog.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }

    // nextパラメータが無い場合の処理
    // Magic Link経由の認証 = 新規登録または再認証の可能性
    // パスワード設定済みフラグをチェック
    const hasPasswordSet = data.user?.user_metadata?.password_set === true;

    if (hasPasswordSet) {
      // パスワード設定済み = 既存ユーザーの再ログイン → ダッシュボードへ
      devLog.log('Password already set, redirecting to dashboard');
      const redirectUrl = `${origin}/dashboard`;
      devLog.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    } else {
      // パスワード未設定 = 新規登録 → パスワード設定画面へ
      // これがMagic Link経由の新規登録のデフォルト動作
      devLog.log('Password not set, redirecting to setup-password');
      const redirectUrl = `${origin}/setup-password`;
      devLog.log('========== AUTH CALLBACK END ==========');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // codeが無い場合は /login へリダイレクト
  devLog.warn('No code parameter, redirecting to login');
  devLog.log('========== AUTH CALLBACK END ==========');
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
