import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Note: middleware runs in Edge runtime, so we inline devLog here
const isDevelopment = process.env.NODE_ENV === 'development';
const devLog = {
  log: (...args: any[]) => {
    if (isDevelopment) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (isDevelopment) console.warn(...args);
  },
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションを更新（重要: これによりセッションが最新の状態に保たれる）
  const { data: { user }, error } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  devLog.log('========== MIDDLEWARE ==========');
  devLog.log('Path:', pathname);
  devLog.log('Has user:', !!user);

  // パブリックルート（未認証でもアクセス可能）
  const publicRoutes = new Set(['/login', '/auth/callback', '/', '/new', '/terms', '/privacy']);

  // 正確な一致のみ許可（"/"で全ルートがマッチするのを防ぐ）
  if (publicRoutes.has(pathname)) {
    // トップページ: ログイン済みユーザーは /dashboard にリダイレクト

    return response;
  }

  // 静的アセット系はstartsWithで判定
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return response;
  }

  // /setup-password は特別な処理
  // Magic Link経由の初回アクセス時は認証済みだが、パスワード設定が必要
  // 認証済みユーザーはアクセス可能、未認証ユーザーは /login へ
  if (pathname === '/setup-password' || pathname.startsWith('/setup-password')) {
    if (!user) {
      // 未認証の場合は /login にリダイレクト
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', pathname);
      devLog.log('Redirecting to login from setup-password (no auth)');
      return NextResponse.redirect(redirectUrl);
    }
    // 認証済みユーザーは /setup-password にアクセス可能
    devLog.log('Allowing access to setup-password (authenticated user)');
    return response;
  }

  // 認証が必要なルート
  if (!user) {
    // 未認証の場合は /login にリダイレクト
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    devLog.log('Redirecting to login from:', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ゲストIDの付与（未認証ユーザーかつCookieがない場合）
  if (!user && !request.cookies.get('guest_id')) {
    const guestId = crypto.randomUUID();
    response.cookies.set('guest_id', guestId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1年間有効
      httpOnly: true,
      sameSite: 'lax',
    });
    devLog.log('Generated new guest_id:', guestId);
  }

  // 認証済みユーザーは通過
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
