# 認証フロー刷新: Magic Link + パスワード設定方式

## 概要

リダイレクトループと認証の不確実性を解消するため、認証フローを完全に刷新しました。

### 変更前の問題点
- メール+パスワードでの直接登録は、メール確認の有無が不明確
- リダイレクトが複雑で、ループが発生しやすい
- パスワード設定のタイミングが曖昧

### 新しい認証フロー
1. **新規登録**: メールアドレスのみ入力 → Magic Link送信
2. **メールリンククリック**: `/auth/callback` でセッション確立
3. **パスワード設定**: `/setup-password` でパスワードを設定
4. **完了**: ダッシュボードへ

## 実装詳細

### 1. ログインページ (`src/app/login/page.tsx`)

#### タブUI実装
- 「ログイン」と「新規登録」をタブで切り替え
- それぞれ独立したフォーム

#### ログインタブ
- Email + Password入力
- `signInWithPassword` でログイン
- 成功時は `/dashboard` へリダイレクト

#### 新規登録タブ
- Emailのみ入力
- `signInWithOtp` でMagic Link送信
- 送信成功時は専用の確認画面を表示

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

#### Magic Link送信完了画面
- 📧アイコンと明確なメッセージ
- 送信先メールアドレスを表示
- 「ログイン画面に戻る」ボタン

### 2. 認証コールバック (`src/app/auth/callback/route.ts`)

#### 処理フロー
1. URLのcodeパラメータを取得
2. `exchangeCodeForSession` でセッション確立
3. エラー時は `/login` へリダイレクト
4. 成功時は `/setup-password` へリダイレクト

```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code);

if (error) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
}

if (data.user) {
  // Magic Link経由 = パスワード未設定と判断
  return NextResponse.redirect(`${origin}/setup-password`);
}
```

#### 設計判断
- Magic Linkでcallbackに来る = 新規登録または再認証
- パスワードログインの場合はcallbackを経由しない
- したがって、callbackに来た場合は `/setup-password` へリダイレクト
- パスワード設定済みの場合は `/setup-password` で判定して `/dashboard` へ

### 3. パスワード設定画面 (`src/app/setup-password/page.tsx`)

#### 認証ガード
```typescript
useEffect(() => {
  if (!user && !loading) {
    router.push('/login');
  }
}, [user, loading, router]);
```
- ログインしていない場合は `/login` へリダイレクト

#### フォーム
- パスワード入力
- パスワード確認（一致チェック）
- 最小6文字のバリデーション

#### パスワード設定処理
```typescript
const { data, error } = await supabase.auth.updateUser({
  password: password,
});
```

#### プロフィール作成
```typescript
// プロフィールが存在しない場合は作成
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', user.id)
  .single();

if (!profile) {
  await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
    });
}
```

#### 完了後
- 成功メッセージ表示
- 1秒後に `/dashboard` へリダイレクト

### 4. ミドルウェア (`middleware.ts`)

#### 目的
- ルート保護（未認証ユーザーのアクセス制御）
- セッション更新
- リダイレクトループの防止

#### パブリックルート
```typescript
const publicRoutes = [
  '/login',
  '/auth/callback',
  '/',
  '/_next',
  '/api',
];
```

これらのルートは未認証でもアクセス可能。

#### 保護ルート
パブリックルート以外はすべて認証が必要。

```typescript
if (!user) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/login';
  redirectUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(redirectUrl);
}
```

#### セッション更新
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
```

リクエストごとにセッションを更新し、最新の認証状態を保持。

#### リダイレクトループ防止
- `/login`, `/auth/callback` はパブリックルートとして除外
- `/setup-password` は認証必須だがリダイレクト先にはしない
- ミドルウェアのログで遷移を追跡可能

## 認証フロー全体図

### 新規登録フロー
```
1. ユーザー: /login (新規登録タブ)
   ↓ メールアドレス入力
2. システム: signInWithOtp 実行
   ↓ Magic Link送信
3. ユーザー: メールのリンクをクリック
   ↓
4. システム: /auth/callback
   ↓ exchangeCodeForSession
5. システム: /setup-password へリダイレクト
   ↓
6. ユーザー: パスワード設定
   ↓ updateUser({ password })
7. システム: /dashboard へリダイレクト
   ↓
8. 完了: ダッシュボード表示
```

### ログインフロー（既存ユーザー）
```
1. ユーザー: /login (ログインタブ)
   ↓ Email + Password入力
2. システム: signInWithPassword 実行
   ↓ 認証成功
3. システム: /dashboard へリダイレクト
   ↓
4. 完了: ダッシュボード表示
```

### パスワードリセットフロー（将来的に実装可能）
```
1. ユーザー: /login → 「パスワードを忘れた」
   ↓ メールアドレス入力
2. システム: resetPasswordForEmail
   ↓ リセットリンク送信
3. ユーザー: メールのリンクをクリック
   ↓
4. システム: /auth/callback
   ↓ exchangeCodeForSession
5. システム: /setup-password へリダイレクト
   ↓
6. ユーザー: 新しいパスワード設定
   ↓
7. 完了
```

## ミドルウェアによるルート保護

| ルート | 認証不要 | 認証必要 | 備考 |
|--------|---------|---------|------|
| `/` | ✅ | - | トップページ |
| `/login` | ✅ | - | ログイン画面 |
| `/auth/callback` | ✅ | - | 認証コールバック |
| `/setup-password` | - | ✅ | パスワード設定 |
| `/dashboard` | - | ✅ | ダッシュボード |
| `/dashboard/*` | - | ✅ | サブページ |

## テスト手順

### 1. 新規登録テスト

1. `/login` にアクセス
2. 「新規登録」タブをクリック
3. メールアドレスを入力
4. 「登録用リンクを送信」ボタンをクリック
5. **期待結果**: 📧 確認画面が表示される
6. メールを確認し、リンクをクリック
7. **期待結果**: `/setup-password` に遷移
8. パスワードを入力（2回）
9. 「パスワードを設定して完了」ボタンをクリック
10. **期待結果**: `/dashboard` に遷移

### 2. ログインテスト

1. `/login` にアクセス
2. 「ログイン」タブ（デフォルト）
3. Email + Passwordを入力
4. 「ログイン」ボタンをクリック
5. **期待結果**: `/dashboard` に遷移

### 3. 未認証アクセステスト

1. ログアウト状態で `/dashboard` にアクセス
2. **期待結果**: `/login?redirect=/dashboard` にリダイレクト

### 4. パスワード設定済みユーザーの `/setup-password` アクセス

1. ログイン済み + パスワード設定済みの状態で `/setup-password` にアクセス
2. パスワード設定フォームが表示される
3. パスワードを入力して送信
4. **期待結果**: パスワードが更新され、 `/dashboard` へ遷移

## コンソールログ

### 新規登録時
```
Sending magic link to: user@example.com
Magic link sent successfully
```

### メールリンククリック時
```
Middleware: /auth/callback User: none
Callback: User authenticated: user-id-123
Callback: Redirecting to password setup page
Middleware: /setup-password User: user-id-123
```

### パスワード設定時
```
Updating user password...
Password updated successfully
Creating profile... (if needed)
```

### ログイン時
```
Starting signin process...
Signin successful, redirecting to dashboard
Middleware: /dashboard User: user-id-123
```

## トラブルシューティング

### リダイレクトループが発生する

**原因**: ミドルウェアの設定またはパブリックルートの定義が不適切

**解決方法**:
1. ブラウザのコンソールログで遷移を確認
2. `middleware.ts` のログ出力を確認
3. `/auth/callback` がパブリックルートに含まれているか確認

### Magic Linkが届かない

**原因**: Supabaseのメール設定またはスパムフォルダ

**解決方法**:
1. Supabaseダッシュボード → Authentication → Email Templates を確認
2. 迷惑メールフォルダを確認
3. ローカル開発の場合、Supabase Inbucket を使用

### パスワード設定後もダッシュボードに行けない

**原因**: セッション更新の問題またはミドルウェアの認証チェック

**解決方法**:
1. ブラウザのCookieを確認（`sb-*-auth-token`）
2. `/dashboard` へのアクセス時のミドルウェアログを確認
3. 必要に応じてログアウト→再ログインを試す

## メリット

1. **確実な認証**: Magic Linkでメール確認が確実に完了
2. **明確なフロー**: パスワード設定のタイミングが明確
3. **リダイレクトループ解消**: ミドルウェアで適切にルート保護
4. **良好なUX**: タブUIで直感的な操作
5. **デバッグしやすい**: 詳細なコンソールログ

## 今後の拡張性

- パスワードリセット機能の追加
- ソーシャルログイン（Google, GitHub等）の追加
- 2要素認証（2FA）の追加
- セッション管理画面（アクティブセッション一覧）
