-- ============================================================
-- IPベースレート制限の永続化テーブル
-- サーバーレス環境でもレート制限が継続されるようにする
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,      -- IP or user ID
  endpoint TEXT NOT NULL,         -- API endpoint path
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 高速検索用インデックス（identifier + 時刻範囲）
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_time
  ON public.rate_limit_logs (identifier, created_at DESC);

-- endpoint別の検索用
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint_time
  ON public.rate_limit_logs (endpoint, created_at DESC);

-- RLS無効（service_role / server-side onlyで使用）
-- このテーブルはフロントエンドからアクセスさせない
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- service_role のみアクセス可能（認証ユーザーには非公開）
-- ポリシーなし = 認証ユーザーはアクセス不可、service_role はRLSバイパス

-- 自動クリーンアップ: 24時間以上前のレコードを削除する関数
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limit_logs
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 手動クリーンアップ用（cron等で定期実行推奨）
-- SELECT public.cleanup_rate_limit_logs();

COMMENT ON TABLE public.rate_limit_logs IS 'IPベースのレート制限ログ。サーバーレス環境での永続化用。';
