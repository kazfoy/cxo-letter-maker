-- URL分析結果の永続キャッシュテーブル
-- インメモリキャッシュのL2として、コールドスタート後もキャッシュを維持
CREATE TABLE IF NOT EXISTS url_analysis_cache (
  url_hash TEXT PRIMARY KEY,           -- SHA256(正規化URL)
  url TEXT NOT NULL,                   -- 元URL（デバッグ用）
  data JSONB NOT NULL,                 -- CachedUrlData (extractedContent, extractedFacts, extractedSources)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- 期限切れエントリ検索用インデックス
CREATE INDEX IF NOT EXISTS idx_url_analysis_cache_expires
  ON url_analysis_cache (expires_at);

-- RLSを有効化（サービスロールキーのみアクセス）
ALTER TABLE url_analysis_cache ENABLE ROW LEVEL SECURITY;

-- サービスロール用ポリシー（APIサーバーからのみアクセス）
CREATE POLICY "Service role full access on url_analysis_cache"
  ON url_analysis_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 期限切れエントリを一括削除するRPC
CREATE OR REPLACE FUNCTION cleanup_expired_url_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM url_analysis_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
