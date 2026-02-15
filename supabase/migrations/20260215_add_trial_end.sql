-- トライアル期間管理用カラムを追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_end timestamptz;

-- コメント
COMMENT ON COLUMN profiles.trial_end IS 'Stripe無料トライアル終了日時（trial_period_days使用時にwebhookから書き込み）';
