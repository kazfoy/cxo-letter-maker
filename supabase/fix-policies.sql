-- Database Security Policy Fixes
-- このファイルは手動でSupabase SQLエディタで実行する必要があります

-- ========================================
-- 1. profiles テーブルの DELETE ポリシー追加
-- ========================================
-- 現状: profiles テーブルに DELETE ポリシーが不足している
-- 対策: ユーザーが自分のプロフィールを削除できるポリシーを追加

-- 既存のポリシーを確認（オプション）
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- DELETE ポリシーの追加
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- ========================================
-- 確認クエリ
-- ========================================
-- ポリシーが正しく作成されたか確認
-- SELECT * FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'DELETE';

-- ========================================
-- 注意事項
-- ========================================
-- 1. このSQLファイルは本番環境のSupabaseダッシュボードで実行してください
-- 2. 実行前に必ずバックアップを取得してください
-- 3. 実行後、確認クエリで正しく適用されたか確認してください
-- 4. profiles テーブルの既存データには影響しません
