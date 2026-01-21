# セキュリティ監査レポート

**監査日**: 2025年1月  
**プロジェクト**: CxO Letter Maker (Next.js + Supabase)  
**監査者**: セキュリティエンジニア

---

## 監査サマリー

本監査では、**7件の高リスク**、**5件の中リスク**、**3件の低リスク**を発見しました。

---

## 🔴 高リスク

### 1. APIルートでの認証チェック不足

**リスクレベル**: 高  
**ファイル名**: `src/app/api/*/route.ts` (全APIルート)

**問題の内容**:
- すべてのAPIルート（`/api/generate`, `/api/edit`, `/api/improve`, `/api/analyze-url`, `/api/analyze-source`, `/api/assist`, `/api/suggest-structure`）で、ユーザー認証チェックが実装されていません
- 未認証ユーザーがAPIを直接呼び出して、高額なAI API（Google Gemini）を悪用できる可能性があります
- 攻撃者はAPIを連打して、DDoS攻撃や高額課金を引き起こす可能性があります

**修正案**:
```typescript
// src/app/api/generate/route.ts の例
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 認証チェックを追加
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    // ... 既存の処理
  } catch (error) {
    // ...
  }
}
```

**影響範囲**: 全7つのAPIルート

---

### 2. SSRF (Server-Side Request Forgery) 脆弱性

**リスクレベル**: 高  
**ファイル名**: 
- `src/app/api/analyze-url/route.ts`
- `src/app/api/analyze-source/route.ts`

**問題の内容**:
- URL検証が不十分で、内部ネットワーク（`127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`）へのアクセスが可能です
- 攻撃者が内部サービス（データベース、管理画面など）にアクセスしたり、ポートスキャンを行ったりできる可能性があります
- `file://` プロトコルを使用してローカルファイルシステムにアクセスできる可能性があります

**修正案**:
```typescript
// URL検証関数を追加
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // プロトコルチェック（http/httpsのみ許可）
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // 内部ネットワークアドレスのブロック
    const hostname = urlObj.hostname.toLowerCase();
    const internalPatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];
    
    if (internalPatterns.some(pattern => pattern.test(hostname))) {
      return false;
    }
    
    // ドメインのホワイトリスト（必要に応じて）
    // const allowedDomains = ['example.com', 'example.org'];
    // if (!allowedDomains.some(domain => hostname.endsWith(domain))) {
    //   return false;
    // }
    
    return true;
  } catch {
    return false;
  }
}

// analyze-url/route.ts で使用
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 });
    }

    // URL検証を追加
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: '無効なURLです。外部の公開URLのみアクセス可能です。' },
        { status: 400 }
      );
    }

    // タイムアウトとサイズ制限を追加
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // ... 既存の処理
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'リクエストがタイムアウトしました' },
          { status: 408 }
        );
      }
      throw error;
    }
  } catch (error) {
    // ...
  }
}
```

---

### 3. 入力検証（バリデーション）不足

**リスクレベル**: 高  
**ファイル名**: 全APIルート

**問題の内容**:
- Zodなどのバリデーションライブラリが使用されていません
- ユーザー入力がそのままAIプロンプトに埋め込まれており、プロンプトインジェクション攻撃のリスクがあります
- 不正なデータ型や長すぎる入力によるDoS攻撃の可能性があります

**修正案**:
```typescript
// 例: src/app/api/generate/route.ts
import { z } from 'zod';

const GenerateRequestSchema = z.object({
  myCompanyName: z.string().max(200).optional(),
  myName: z.string().max(100).optional(),
  myServiceDescription: z.string().max(2000),
  companyName: z.string().max(200),
  position: z.string().max(100).optional(),
  name: z.string().max(100),
  background: z.string().max(5000).optional(),
  problem: z.string().max(5000).optional(),
  solution: z.string().max(5000).optional(),
  caseStudy: z.string().max(5000).optional(),
  offer: z.string().max(2000).optional(),
  freeformInput: z.string().max(10000).optional(),
  model: z.enum(['flash', 'pro']).default('flash'),
  mode: z.enum(['sales', 'event']).default('sales'),
  inputComplexity: z.enum(['simple', 'detailed']).default('detailed'),
  // ... その他のフィールド
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // バリデーション
    const validatedData = GenerateRequestSchema.parse(body);
    
    // プロンプトインジェクション対策: ユーザー入力をエスケープ
    const sanitizeForPrompt = (text: string): string => {
      // プロンプトの区切り文字をエスケープ
      return text
        .replace(/```/g, '\\`\\`\\`')
        .replace(/---/g, '\\-\\-\\-')
        .replace(/\n{3,}/g, '\n\n'); // 連続する改行を制限
    };
    
    // 使用時
    const prompt = `...${sanitizeForPrompt(validatedData.companyName)}...`;
    
    // ... 既存の処理
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '入力データが無効です', details: error.errors },
        { status: 400 }
      );
    }
    // ...
  }
}
```

**推奨**: `package.json` に `zod` を追加
```bash
npm install zod
```

---

### 4. Rate Limit（レート制限）未実装

**リスクレベル**: 高  
**ファイル名**: 全APIルート

**問題の内容**:
- APIの連打によるDDoS攻撃や高額課金リスクへの対策が実装されていません
- 攻撃者が短時間に大量のリクエストを送信して、Google Gemini APIの使用量を増やし、高額な請求を発生させる可能性があります

**修正案**:
```typescript
// lib/rateLimit.ts を新規作成
import { NextRequest, NextResponse } from 'next/server';

// 簡易的なインメモリレート制限（本番環境ではRedis推奨）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  request: NextRequest,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1分
): { success: boolean; remaining: number; resetAt: number } {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    // 新しいウィンドウ
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  
  if (record.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { success: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

// 使用例: src/app/api/generate/route.ts
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // レート制限チェック
  const limitResult = rateLimit(request, 10, 60000); // 1分間に10リクエスト
  
  if (!limitResult.success) {
    return NextResponse.json(
      { 
        error: 'リクエストが多すぎます',
        retryAfter: Math.ceil((limitResult.resetAt - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(limitResult.remaining),
          'X-RateLimit-Reset': String(limitResult.resetAt),
        }
      }
    );
  }
  
  // ... 既存の処理
}
```

**推奨**: 本番環境では `@upstash/ratelimit` や `@vercel/kv` を使用

---

### 5. 機密情報のログ出力

**リスクレベル**: 高  
**ファイル名**: 
- `src/app/auth/callback/route.ts`
- `middleware.ts`
- `src/app/setup-password/SetupPasswordClient.tsx`

**問題の内容**:
- `console.log` にユーザーID、メールアドレス、ユーザーメタデータが出力されています
- 本番環境のログに個人情報が記録され、ログ漏洩時にGDPR違反や個人情報保護法違反のリスクがあります

**修正案**:
```typescript
// src/app/auth/callback/route.ts
// 修正前
console.log('User ID:', data.user?.id);
console.log('User email:', data.user?.email);
console.log('User metadata:', JSON.stringify(data.user?.user_metadata, null, 2));

// 修正後（本番環境ではログを最小限に）
if (process.env.NODE_ENV === 'development') {
  console.log('User authenticated:', data.user?.id?.substring(0, 8) + '...');
} else {
  // 本番環境では個人情報を含まないログのみ
  console.log('User authenticated successfully');
}
```

**推奨**: 本番環境では構造化ログ（例: `pino`, `winston`）を使用し、個人情報はマスクまたは除外

---

### 6. 認証コールバックでのオープンリダイレクト脆弱性

**リスクレベル**: 高  
**ファイル名**: `src/app/auth/callback/route.ts`

**問題の内容**:
- `next` パラメータが検証されずにそのままリダイレクト先として使用されています
- 攻撃者が `https://evil.com` などの外部サイトにリダイレクトする可能性があります

**修正案**:
```typescript
// src/app/auth/callback/route.ts
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const origin = requestUrl.origin;

  // ... 認証処理 ...

  if (next) {
    // リダイレクト先の検証
    try {
      const nextUrl = new URL(next, origin);
      // 同一オリジンのみ許可
      if (nextUrl.origin !== origin) {
        console.error('Invalid redirect origin:', nextUrl.origin);
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      // パスの検証（相対パスのみ許可）
      if (!nextUrl.pathname.startsWith('/')) {
        console.error('Invalid redirect path:', nextUrl.pathname);
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      // 危険なパスのブロック
      const dangerousPaths = ['/api/', '/auth/callback'];
      if (dangerousPaths.some(path => nextUrl.pathname.startsWith(path))) {
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      
      const redirectUrl = `${origin}${nextUrl.pathname}${nextUrl.search}`;
      return NextResponse.redirect(redirectUrl);
    } catch {
      // URL解析に失敗した場合はダッシュボードへ
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }
  
  // ... 既存の処理
}
```

---

### 7. ProfilesテーブルのDELETEポリシー不足

**リスクレベル**: 高  
**ファイル名**: `supabase/schema.sql`, `supabase/profiles-schema.sql`

**問題の内容**:
- `profiles` テーブルにDELETEポリシーが定義されていません
- ユーザーが自分のプロフィールを削除できない（または削除できるがRLSで保護されていない）可能性があります

**修正案**:
```sql
-- supabase/profiles-schema.sql に追加
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);
```

---

## 🟡 中リスク

### 8. APIキーのログ出力

**リスクレベル**: 中  
**ファイル名**: 全APIルート

**問題の内容**:
- APIキーの長さがログに出力されています（完全なキーではないが、情報漏洩のリスク）

**修正案**:
```typescript
// 修正前
console.log("API Key configured:", apiKey ? "Yes (Length: " + apiKey.length + ")" : "No");

// 修正後
if (process.env.NODE_ENV === 'development') {
  console.log("API Key configured:", apiKey ? "Yes" : "No");
} else {
  // 本番環境ではログを出さない
}
```

---

### 9. JSON.parse のエラーハンドリング不足

**リスクレベル**: 中  
**ファイル名**: 
- `src/app/api/analyze-source/route.ts`
- `src/app/api/assist/route.ts`
- `src/app/api/suggest-structure/route.ts`
- `src/lib/supabaseHistoryUtils.ts`

**問題の内容**:
- `JSON.parse()` で不正なJSONをパースしようとすると、アプリケーションがクラッシュする可能性があります
- 一部の箇所ではtry-catchで処理されていますが、エラーメッセージが不十分です

**修正案**:
```typescript
// 例: src/app/api/analyze-source/route.ts
let urls: string[] = [];
if (urlsJson) {
  try {
    const parsed = JSON.parse(urlsJson);
    if (!Array.isArray(parsed)) {
      const errorResponse = createErrorResponse(ErrorCodes.INVALID_URL_FORMAT);
      return NextResponse.json(errorResponse, { status: getHttpStatus(ErrorCodes.INVALID_URL_FORMAT) });
    }
    // 各URLが文字列であることを検証
    if (!parsed.every(url => typeof url === 'string')) {
      const errorResponse = createErrorResponse(ErrorCodes.INVALID_URL_FORMAT);
      return NextResponse.json(errorResponse, { status: getHttpStatus(ErrorCodes.INVALID_URL_FORMAT) });
    }
    urls = parsed;
  } catch (error) {
    console.error('JSON parse error:', error);
    const errorResponse = createErrorResponse(ErrorCodes.INVALID_URL_FORMAT);
    return NextResponse.json(errorResponse, { status: getHttpStatus(ErrorCodes.INVALID_URL_FORMAT) });
  }
}
```

---

### 10. 外部URL取得時のタイムアウト未設定

**リスクレベル**: 中  
**ファイル名**: 
- `src/app/api/analyze-url/route.ts`
- `src/app/api/analyze-source/route.ts`

**問題の内容**:
- `fetch()` にタイムアウトが設定されていないため、応答の遅いURLでリクエストが長時間ブロックされる可能性があります

**修正案**: SSRF対策の修正案（上記2）を参照

---

### 11. レスポンスサイズ制限不足

**リスクレベル**: 中  
**ファイル名**: 
- `src/app/api/analyze-url/route.ts`
- `src/app/api/analyze-source/route.ts`

**問題の内容**:
- 大きなHTMLレスポンスをメモリに読み込むことで、DoS攻撃のリスクがあります

**修正案**:
```typescript
// レスポンスサイズを制限（例: 5MB）
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  signal: controller.signal,
});

// Content-Lengthをチェック
const contentLength = response.headers.get('content-length');
if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
  return NextResponse.json(
    { error: 'レスポンスサイズが大きすぎます' },
    { status: 413 }
  );
}

// ストリーミング読み込みでサイズを制限
const reader = response.body?.getReader();
const chunks: Uint8Array[] = [];
let totalSize = 0;

if (reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    totalSize += value.length;
    if (totalSize > MAX_RESPONSE_SIZE) {
      reader.cancel();
      return NextResponse.json(
        { error: 'レスポンスサイズが大きすぎます' },
        { status: 413 }
      );
    }
    chunks.push(value);
  }
  
  const html = new TextDecoder().decode(Buffer.concat(chunks));
  // ... 既存の処理
}
```

---

### 12. MiddlewareでのAPIルート除外

**リスクレベル**: 中  
**ファイル名**: `middleware.ts`

**問題の内容**:
- Middlewareで `/api` パスが認証チェックから除外されていますが、APIルート自体で認証チェックが行われていないため、未認証アクセスが可能です

**修正案**: 上記1のAPIルート認証チェックを実装

---

## 🟢 低リスク

### 13. XSSリスク（低）

**リスクレベル**: 低  
**ファイル名**: `src/components/PreviewArea.tsx`

**問題の内容**:
- AIが生成したコンテンツを `textarea` で表示しているため、直接的なXSSリスクは低いです
- ただし、将来的に `dangerouslySetInnerHTML` を使用する場合は注意が必要です

**現状**: 問題なし（`textarea` を使用しているため安全）

**推奨**: 今後、Markdownレンダリングなどを追加する場合は、`react-markdown` や `marked` などの安全なライブラリを使用し、`dangerouslySetInnerHTML` は使用しない

---

### 14. CORS設定

**リスクレベル**: 低  
**ファイル名**: 全APIルート

**問題の内容**:
- Next.jsのAPIルートはデフォルトで同一オリジンのみアクセス可能ですが、明示的なCORS設定がない

**推奨**: 必要に応じて明示的にCORSヘッダーを設定
```typescript
export async function POST(request: Request) {
  // ... 処理
  
  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

---

### 15. 環境変数の検証不足

**リスクレベル**: 低  
**ファイル名**: 全APIルート

**問題の内容**:
- 環境変数が設定されていない場合、エラーメッセージが不十分

**修正案**:
```typescript
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set!");
  return NextResponse.json(
    { error: 'サーバー設定エラー' },
    { status: 500 }
  );
}
```

---

## ✅ 問題なし（適切に実装されている箇所）

### 1. Supabase RLS (Row Level Security)

**ファイル名**: `supabase/schema.sql`

**確認内容**:
- `letters` テーブルと `profiles` テーブルでRLSが有効化されています
- SELECT, INSERT, UPDATE, DELETEポリシーが適切に設定されています（`profiles` のDELETEポリシーは上記7で指摘）
- `auth.uid() = user_id` による適切なユーザー分離が実装されています

**評価**: ✅ 適切に実装されています（DELETEポリシーの追加を推奨）

---

### 2. 認証フロー

**ファイル名**: `src/app/auth/callback/route.ts`, `middleware.ts`

**確認内容**:
- Magic Link認証が適切に実装されています
- Middlewareで保護されたルートへのアクセス制御が実装されています
- セッション管理が適切に行われています

**評価**: ✅ 基本的に適切ですが、オープンリダイレクト対策が必要（上記6）

---

### 3. データベーススキーマ

**ファイル名**: `supabase/schema.sql`

**確認内容**:
- 外部キー制約が適切に設定されています
- インデックスが適切に設定されています
- トリガーによる自動更新が実装されています

**評価**: ✅ 適切に実装されています

---

## 修正優先度

### 即座に修正すべき（高リスク）
1. ✅ APIルートでの認証チェック追加
2. ✅ SSRF対策の実装
3. ✅ 入力検証（Zod）の実装
4. ✅ Rate Limitの実装
5. ✅ 機密情報のログ出力削除
6. ✅ オープンリダイレクト対策
7. ✅ ProfilesテーブルのDELETEポリシー追加

### 早期に修正すべき（中リスク）
8. ✅ APIキーのログ出力削除
9. ✅ JSON.parseのエラーハンドリング強化
10. ✅ 外部URL取得時のタイムアウト設定
11. ✅ レスポンスサイズ制限
12. ✅ MiddlewareとAPIルートの認証整合性

### 改善推奨（低リスク）
13. ✅ XSS対策の継続監視
14. ✅ CORS設定の明示化
15. ✅ 環境変数の検証強化

---

## まとめ

本プロジェクトは基本的なセキュリティ対策（RLS、認証フロー）は適切に実装されていますが、**APIレイヤーでのセキュリティ対策が不足**しています。特に、**認証チェック、入力検証、Rate Limit、SSRF対策**は即座に実装すべきです。

修正後は、再度セキュリティ監査を実施することを推奨します。









