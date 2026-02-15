-- ============================================================
-- profiles.plan カラムの直接書き換え防止
-- plan, subscription_status, stripe_customer_id は
-- Stripe webhook (service_role) 経由のみ更新可能とする
-- ============================================================

-- 1. 既存の広すぎるUPDATEポリシーを削除
-- (複数名でポリシーが存在する可能性があるため、両方試行)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. 保護カラムを除外した新しいUPDATEポリシーを作成
-- ユーザーは自分のプロフィールの「安全なカラム」のみ更新可能
CREATE POLICY "Users can update own profile safe columns"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. トリガー関数: 保護カラムの変更をブロック
-- service_role（webhookなど）以外からのplan等の変更を防止
CREATE OR REPLACE FUNCTION public.protect_plan_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- current_setting('role') が 'authenticated' の場合、
  -- 保護カラムの変更をブロックする
  -- service_role (webhook) からの更新はこのチェックをバイパスする
  IF current_setting('role', true) = 'authenticated' THEN
    -- plan カラムの変更を検知
    IF OLD.plan IS DISTINCT FROM NEW.plan THEN
      RAISE EXCEPTION 'plan カラムは直接変更できません。Stripe経由で更新してください。';
    END IF;

    -- subscription_status カラムの変更を検知
    IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status THEN
      RAISE EXCEPTION 'subscription_status カラムは直接変更できません。';
    END IF;

    -- stripe_customer_id カラムの変更を検知
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      RAISE EXCEPTION 'stripe_customer_id カラムは直接変更できません。';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. トリガーを設定（既存のものがあれば置換）
DROP TRIGGER IF EXISTS protect_plan_columns_trigger ON public.profiles;
CREATE TRIGGER protect_plan_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_plan_columns();

-- ============================================================
-- 検証クエリ（手動で実行して確認）
-- ============================================================
-- 以下をSupabase SQL Editorで実行して検証:
--
-- 1. RLSポリシーの確認:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'profiles';
--
-- 2. トリガーの確認:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'profiles';
