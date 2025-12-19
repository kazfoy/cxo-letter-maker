import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  console.log('Middleware:', pathname, 'User:', user?.id || 'none');

  // パブリックルート（未認証でもアクセス可能）
  const publicRoutes = [
    '/login',
    '/auth/callback',
    '/',
    '/_next',
    '/api',
  ];

  // パスがパブリックルートのいずれかで始まる場合は通過
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return response;
  }

  // 認証が必要なルート
  if (!user) {
    // 未認証の場合は /login にリダイレクト
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    console.log('Redirecting to login from:', pathname);
    return NextResponse.redirect(redirectUrl);
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
