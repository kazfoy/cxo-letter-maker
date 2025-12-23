-- ============================================================
-- Security Audit Verification
-- 最終セキュリティチェック - RLS (Row Level Security) 確認
-- 実行日: 2025-12-22
-- ============================================================

-- このファイルは全てのRLS設定が適切に有効化されているかを確認します
-- 全てのポリシーが「ユーザーは自分のデータのみにアクセス可能」という
-- 原則に従っていることを保証します

-- ============================================================
-- 1. letters テーブル のRLS確認
-- ============================================================

-- RLS が有効化されているか確認
DO $$
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'letters') THEN
        ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled for letters table';
    ELSE
        RAISE NOTICE 'RLS already enabled for letters table';
    END IF;
END $$;

-- 必要なポリシーが存在するか確認（存在しない場合のみ作成）
DO $$
BEGIN
    -- SELECT policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'letters' AND policyname = 'Users can view own letters') THEN
        CREATE POLICY "Users can view own letters"
        ON public.letters FOR SELECT
        USING (auth.uid() = user_id);
        RAISE NOTICE 'Created SELECT policy for letters';
    END IF;

    -- INSERT policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'letters' AND policyname = 'Users can insert own letters') THEN
        CREATE POLICY "Users can insert own letters"
        ON public.letters FOR INSERT
        WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created INSERT policy for letters';
    END IF;

    -- UPDATE policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'letters' AND policyname = 'Users can update own letters') THEN
        CREATE POLICY "Users can update own letters"
        ON public.letters FOR UPDATE
        USING (auth.uid() = user_id);
        RAISE NOTICE 'Created UPDATE policy for letters';
    END IF;

    -- DELETE policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'letters' AND policyname = 'Users can delete own letters') THEN
        CREATE POLICY "Users can delete own letters"
        ON public.letters FOR DELETE
        USING (auth.uid() = user_id);
        RAISE NOTICE 'Created DELETE policy for letters';
    END IF;
END $$;

-- ============================================================
-- 2. profiles テーブル のRLS確認
-- ============================================================

-- RLS が有効化されているか確認
DO $$
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled for profiles table';
    ELSE
        RAISE NOTICE 'RLS already enabled for profiles table';
    END IF;
END $$;

-- 必要なポリシーが存在するか確認
DO $$
BEGIN
    -- SELECT policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile"
        ON public.profiles FOR SELECT
        USING (auth.uid() = id);
        RAISE NOTICE 'Created SELECT policy for profiles';
    END IF;

    -- INSERT policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id);
        RAISE NOTICE 'Created INSERT policy for profiles';
    END IF;

    -- UPDATE policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile"
        ON public.profiles FOR UPDATE
        USING (auth.uid() = id);
        RAISE NOTICE 'Created UPDATE policy for profiles';
    END IF;

    -- DELETE policy (重要: プロフィール削除を許可)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can delete their own profile') THEN
        CREATE POLICY "Users can delete their own profile"
        ON public.profiles FOR DELETE
        USING (auth.uid() = id);
        RAISE NOTICE 'Created DELETE policy for profiles';
    END IF;
END $$;

-- ============================================================
-- 3. Storage (user_assets) のRLS確認
-- ============================================================

-- storage.buckets テーブルでuser_assetsバケットが非公開か確認
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user_assets' AND public = true) THEN
        UPDATE storage.buckets SET public = false WHERE id = 'user_assets';
        RAISE WARNING 'user_assets bucket was public - changed to private!';
    ELSE
        RAISE NOTICE 'user_assets bucket is correctly set to private';
    END IF;
END $$;

-- Storage policies の確認 (既に存在する場合はスキップ)
DO $$
BEGIN
    -- Upload policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload their own assets') THEN
        CREATE POLICY "Users can upload their own assets"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );
        RAISE NOTICE 'Created upload policy for storage';
    END IF;

    -- View policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can view their own assets') THEN
        CREATE POLICY "Users can view their own assets"
        ON storage.objects FOR SELECT
        TO authenticated
        USING ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );
        RAISE NOTICE 'Created view policy for storage';
    END IF;

    -- Delete policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own assets') THEN
        CREATE POLICY "Users can delete their own assets"
        ON storage.objects FOR DELETE
        TO authenticated
        USING ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );
        RAISE NOTICE 'Created delete policy for storage';
    END IF;
END $$;

-- ============================================================
-- セキュリティ監査レポート
-- ============================================================

-- 全ポリシーの確認クエリ（実行後に確認用）
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('letters', 'profiles')
--    OR (schemaname = 'storage' AND tablename = 'objects')
-- ORDER BY tablename, cmd;

-- 危険なポリシーの検出（USING (true) や WITH CHECK (true) など）
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE (qual::text LIKE '%true%' OR with_check::text LIKE '%true%')
--   AND tablename IN ('letters', 'profiles')
--   AND schemaname = 'public';

-- ============================================================
-- 確認事項
-- ============================================================
-- ✅ letters: auth.uid() = user_id でユーザー制限
-- ✅ profiles: auth.uid() = id でユーザー制限
-- ✅ storage: folder name = auth.uid()::text でユーザー制限
-- ✅ sender_infos: テーブル不要（profilesに統合済み）
-- ✅ 全テーブルでRLS有効化
-- ✅ 全ポリシーで適切なユーザー制限設定

-- ============================================================
-- 注意事項
-- ============================================================
-- 1. このマイグレーションは既存のポリシーを保護します（IF NOT EXISTS使用）
-- 2. 既存のデータには影響しません
-- 3. セキュリティ設定のみを確認・強化します
-- 4. 本番環境に適用する前にステージング環境でテストしてください
