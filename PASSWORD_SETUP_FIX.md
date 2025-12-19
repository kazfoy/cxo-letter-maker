# Magic Link → パスワード設定フロー修正

## 問題

Magic Linkをクリックした後、パスワード設定画面 (`/setup-password`) に遷移せず、直接ダッシュボードに行ってしまう問題が発生していました。

### 原因

コールバック処理で「パスワードが設定済みかどうか」を判定していなかったため、すべてのMagic Linkユーザーが同じルート（`/setup-password`）に送られていました。しかし、実際の動作では何らかの理由でダッシュボードに遷移していました。

## 解決策

Supabaseの `user_metadata` を使用してパスワード設定状態を管理します。

### 実装方法

#### 1. パスワード設定時にメタデータフラグを設定

**ファイル**: `src/app/setup-password/page.tsx`

```typescript
const { data, error } = await supabase.auth.updateUser({
  password: password,
  data: {
    password_set: true, // ← このフラグを設定
  },
});
```

**ポイント**:
- `updateUser` の `data` パラメータで `user_metadata` を更新
- `password_set: true` フラグを設定してパスワード設定済みを記録

#### 2. コールバック処理でフラグをチェック

**ファイル**: `src/app/auth/callback/route.ts`

```typescript
// セッション確立後、user_metadata をチェック
const hasPasswordSet = data.user.user_metadata?.password_set === true;

if (hasPasswordSet) {
  // パスワード設定済み → ダッシュボードへ
  console.log('Password already set, redirecting to dashboard');
  return NextResponse.redirect(`${origin}/dashboard`);
} else {
  // パスワード未設定 → パスワード設定画面へ
  console.log('Password not set, redirecting to password setup');
  return NextResponse.redirect(`${origin}/setup-password`);
}
```

**ポイント**:
- `data.user.user_metadata?.password_set` をチェック
- `true` なら既にパスワード設定済み → `/dashboard`
- `false` または未設定なら → `/setup-password`

## フロー図

### 新規登録（初回）

```
1. /login → 「新規登録」タブ
   ↓ Magic Link送信
2. メールのリンクをクリック
   ↓
3. /auth/callback
   ↓ user_metadata.password_set をチェック
   ↓ → undefined (未設定)
4. /setup-password へリダイレクト
   ↓ パスワード入力
   ↓ updateUser({ password, data: { password_set: true } })
5. /dashboard へ遷移
```

### 再ログイン（Magic Link）

```
1. /login → 「新規登録」タブ
   ↓ Magic Link送信（既存ユーザー）
2. メールのリンクをクリック
   ↓
3. /auth/callback
   ↓ user_metadata.password_set をチェック
   ↓ → true (設定済み)
4. /dashboard へ直接リダイレクト
   ↓
5. パスワード設定画面はスキップ！
```

### パスワードログイン

```
1. /login → 「ログイン」タブ
   ↓ Email + Password
2. signInWithPassword
   ↓ 認証成功
3. /dashboard へ直接遷移
   ↓
4. /auth/callback は経由しない
```

## user_metadata とは

Supabaseの `user_metadata` は、ユーザーごとに任意のデータを保存できるフィールドです。

### 特徴
- ✅ ユーザーが自由に更新可能
- ✅ JSON形式で任意のデータを保存
- ✅ `auth.users` テーブルに保存
- ✅ `updateUser()` で簡単に更新

### 使用例

```typescript
// 設定
await supabase.auth.updateUser({
  data: {
    password_set: true,
    theme: 'dark',
    language: 'ja',
  }
});

// 取得
const { data: { user } } = await supabase.auth.getUser();
console.log(user.user_metadata.password_set); // true
console.log(user.user_metadata.theme); // 'dark'
```

## なぜこの方法が確実か

### 1. Supabaseネイティブ機能
- データベーステーブルを追加する必要なし
- Supabaseが管理してくれる

### 2. セッションと同期
- セッション情報に含まれる
- 毎回クエリする必要なし

### 3. シンプル
- フラグ1つで判定
- 実装がシンプルで保守しやすい

## 代替案との比較

### ❌ 代替案1: profiles テーブルにフラグを追加

```sql
ALTER TABLE profiles ADD COLUMN password_set BOOLEAN DEFAULT FALSE;
```

**デメリット**:
- テーブル変更が必要
- 追加のクエリが必要
- user_metadata で十分

### ❌ 代替案2: identities テーブルをチェック

```typescript
const hasPassword = user.identities?.some(i => i.provider === 'email');
```

**デメリット**:
- Magic Linkも `email` プロバイダーを使う
- パスワードの有無を区別できない

### ✅ 採用案: user_metadata

```typescript
const hasPasswordSet = user.user_metadata?.password_set === true;
```

**メリット**:
- シンプル
- 追加のテーブル不要
- 確実に判定できる

## テスト手順

### テスト1: 新規ユーザー（初回Magic Link）

1. `/login` → 「新規登録」タブ
2. メールアドレス入力 → Magic Link送信
3. メールのリンクをクリック
4. **期待結果**: `/setup-password` に遷移
5. パスワード入力 → 「パスワードを設定して完了」
6. **期待結果**: `/dashboard` に遷移
7. **コンソールログ確認**:
   ```
   User authenticated: user-id-123
   User metadata: {}
   Password not set, redirecting to password setup
   ```

### テスト2: 既存ユーザー（2回目以降のMagic Link）

1. 一度パスワード設定済みのユーザーでログアウト
2. `/login` → 「新規登録」タブ（または再度Magic Link）
3. メールアドレス入力 → Magic Link送信
4. メールのリンクをクリック
5. **期待結果**: `/dashboard` に直接遷移（パスワード設定画面スキップ）
6. **コンソールログ確認**:
   ```
   User authenticated: user-id-123
   User metadata: { password_set: true }
   Password already set, redirecting to dashboard
   ```

### テスト3: パスワードログイン

1. `/login` → 「ログイン」タブ
2. Email + Password入力
3. **期待結果**: `/dashboard` に直接遷移
4. **コンソールログ確認**: `/auth/callback` は経由しない

## デバッグ方法

### コンソールログで確認

**コールバック処理**:
```typescript
console.log('User authenticated:', data.user.id);
console.log('User metadata:', data.user.user_metadata);
```

**パスワード設定時**:
```typescript
console.log('Password updated successfully');
console.log('Password_set flag set to true');
```

### ブラウザでメタデータを確認

```javascript
// ブラウザのコンソールで実行
const { data } = await supabase.auth.getUser();
console.log(data.user.user_metadata);
// 期待: { password_set: true }
```

## トラブルシューティング

### 問題: パスワード設定後もMagic Linkで `/setup-password` に行く

**原因**: `password_set` フラグが設定されていない

**解決方法**:
1. ブラウザコンソールでメタデータを確認
2. 手動でフラグを設定:
   ```javascript
   await supabase.auth.updateUser({
     data: { password_set: true }
   });
   ```

### 問題: 常にダッシュボードに行く

**原因**: すべてのユーザーが `password_set: true` になっている

**解決方法**:
1. 新規ユーザーで試す
2. または、既存ユーザーのメタデータをリセット:
   ```javascript
   await supabase.auth.updateUser({
     data: { password_set: false }
   });
   ```

## まとめ

✅ **Supabaseで完全に実現可能**
✅ **user_metadata を使用したシンプルな実装**
✅ **パスワード設定状態を確実に判定**
✅ **追加のテーブル不要**

この実装により、Magic Linkをクリックした後、確実にパスワード設定画面に遷移するようになりました。
