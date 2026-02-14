import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// パブリックルート（認証チェック不要 = Supabase呼び出し不要）
const PUBLIC_ROUTES = new Set([
  '/login',
  '/auth/callback',
  '/',
  '/new',
  '/terms',
  '/privacy',
  '/tokusho',
]);

// 認証チェックが不要なパスプレフィックス
const PUBLIC_PREFIXES = ['/_next', '/api'];

/**
 * パスが認証チェック不要かどうかを判定する（Supabase呼び出し前に高速判定）
 */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * 認証が必要なルートでのみ Supabase クライアントを作成し、getUser を呼び出す。
 * パブリックルートでは外部通信を一切行わない。
 */
async function getAuthUser(request: NextRequest, response: NextResponse) {
  let mutableResponse = response;

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
          mutableResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            mutableResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: mutableResponse };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 高速パス: パブリックルートは Supabase 呼び出しをスキップ ---
  if (isPublicPath(pathname)) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  // --- 認証が必要なルート: ここで初めて Supabase を呼び出す ---
  const baseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const { user, response } = await getAuthUser(request, baseResponse);

  // /setup-password は認証済みユーザーのみアクセス可能
  if (pathname === '/setup-password' || pathname.startsWith('/setup-password')) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // その他の保護ルート: 未認証ならログインへリダイレクト
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

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
