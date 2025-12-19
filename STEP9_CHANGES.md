# Step 9: 認証フローとリダイレクトの修正

## 問題点

新規登録後に `/login` ページに戻ってしまい、適切にダッシュボードへ遷移できない問題がありました。

## 実装内容

### 1. 新規登録処理の改善

**ファイル**: `src/app/login/page.tsx`

#### 変更点:

1. **Supabaseを直接呼び出し**
   - AuthContextの `signUpWithPassword` を使うのではなく、ページ内で直接 `supabase.auth.signUp()` を呼び出すように変更
   - レスポンスの `data.session` を確認して、適切な処理を分岐

2. **ケースA: 即時ログイン成功** (`data.session` が存在する場合)
   ```typescript
   if (data.session) {
     // メール確認不要の設定
     setMessage({ type: 'success', text: 'アカウントを作成しました...' });
     setTimeout(() => {
       router.push('/dashboard'); // ダッシュボードへリダイレクト
     }, 500);
   }
   ```

3. **ケースB: メール確認待ち** (`data.session` がnull, `data.user` が存在)
   ```typescript
   else if (data.user && !data.session) {
     // メール確認必要
     setAwaitingConfirmation(true); // 確認画面を表示
     setMessage({ type: 'success', text: '確認メールを送信しました' });
   }
   ```

4. **メール確認待ち専用UI**
   - `awaitingConfirmation` が true の場合、フォームを非表示にして専用の確認画面を表示
   - 大きな📧アイコンと明確なメッセージ
   - 送信先メールアドレスを表示
   - 「ログイン画面に戻る」ボタンで元の画面に復帰可能

### 2. ログイン処理の改善

1. **直接Supabaseを呼び出し**
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password,
   });
   ```

2. **エラーメッセージの改善**
   - `Invalid login credentials` → 「メールアドレスまたはパスワードが正しくありません」
   - `Email not confirmed` → 「メールアドレスが確認されていません。確認メールをご確認ください」
   - より具体的で分かりやすいエラーメッセージを日本語で表示

3. **リダイレクトの明確化**
   ```typescript
   setTimeout(() => {
     router.push('/dashboard');
   }, 500);
   ```
   - 成功メッセージを表示してから500ms後にリダイレクト
   - ユーザーが状況を理解できるようにする

### 3. ログイン済みユーザーのガード処理

```typescript
useEffect(() => {
  if (user) {
    console.log('User already logged in, redirecting to dashboard');
    router.push('/dashboard');
  }
}, [user, router]);
```

- ログイン済みユーザーが `/login` ページにアクセスした場合、自動的に `/dashboard` へリダイレクト
- 不要なログイン画面の表示を防ぐ

### 4. 詳細なログ出力

すべての認証フローで詳細なコンソールログを出力：

```typescript
console.log('Starting signup process...');
console.log('Signup response:', { hasUser: !!data.user, hasSession: !!data.session });
console.log('Session exists - redirecting to dashboard');
console.log('Email confirmation required - showing confirmation message');
```

- デバッグが容易になる
- 各処理のステップを明確に追跡可能

## テスト方法

### テストケース1: メール確認不要モード（即時ログイン）

1. Supabase設定でメール確認を無効化
2. `/login` で新規登録
3. **期待結果**:
   - 「アカウントを作成しました」メッセージ表示
   - 500ms後に `/dashboard` へリダイレクト
   - ログイン状態になっている

### テストケース2: メール確認必須モード

1. Supabase設定でメール確認を有効化
2. `/login` で新規登録
3. **期待結果**:
   - 📧アイコンと「確認メールを送信しました」画面が表示される
   - フォームは表示されない
   - メールアドレスが表示される
   - ページ遷移しない（/loginのまま）

### テストケース3: ログイン

1. 既存アカウントでログイン
2. **期待結果**:
   - 「ログインしました」メッセージ表示
   - 500ms後に `/dashboard` へリダイレクト

### テストケース4: ログインエラー

1. 間違ったパスワードでログイン
2. **期待結果**:
   - 「メールアドレスまたはパスワードが正しくありません」と日本語で表示

### テストケース5: ログイン済みユーザーのガード

1. ログイン済みの状態で `/login` にアクセス
2. **期待結果**:
   - 自動的に `/dashboard` にリダイレクトされる
   - ログイン画面は表示されない

## コンソール出力例

### 成功時（即時ログイン）
```
Starting signup process...
Signup response: { hasUser: true, hasSession: true }
Session exists - redirecting to dashboard
```

### 成功時（メール確認必要）
```
Starting signup process...
Signup response: { hasUser: true, hasSession: false }
Email confirmation required - showing confirmation message
```

### ログイン成功時
```
Starting signin process...
Signin successful, redirecting to dashboard
```

## 変更ファイル

- `src/app/login/page.tsx` - 認証フローを完全に書き換え

## 修正の効果

1. **明確なユーザー誘導**: メール確認が必要な場合、専用画面で明確に案内
2. **適切なリダイレクト**: どのケースでも `/login` に戻らず、適切なページへ遷移
3. **エラーメッセージの改善**: 具体的で分かりやすい日本語メッセージ
4. **ログイン済みユーザーの保護**: 不要なログイン画面表示を防ぐ
5. **デバッグ容易性**: 詳細なコンソールログで問題の特定が簡単

## 以前の問題との違い

**以前**:
- AuthContextの `signUpWithPassword` が `window.location.href` でリダイレクト
- セッションの有無を確認せずに一律処理
- メール確認待ちの状態が曖昧
- エラーメッセージが英語のまま

**現在**:
- `router.push()` で適切にリダイレクト
- セッションの有無を確認して分岐処理
- メール確認待ちは専用UIで明確に案内
- すべて日本語で分かりやすいメッセージ
