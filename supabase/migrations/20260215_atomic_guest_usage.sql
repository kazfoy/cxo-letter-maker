-- ゲスト利用カウントのアトミックインクリメントRPC
-- read-then-write のレースコンディションを防止
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_guest_id TEXT,
  p_usage_date DATE DEFAULT CURRENT_DATE,
  p_daily_limit INTEGER DEFAULT 3
)
RETURNS TABLE(
  new_count INTEGER,
  was_allowed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- UPSERT + RETURNING で1文でアトミックに処理
  INSERT INTO guest_usage (guest_id, usage_date, count, updated_at)
  VALUES (p_guest_id, p_usage_date, 1, now())
  ON CONFLICT (guest_id, usage_date)
  DO UPDATE SET
    count = guest_usage.count + 1,
    updated_at = now()
  WHERE guest_usage.count < p_daily_limit  -- 制限超過時はインクリメントしない
  RETURNING guest_usage.count INTO v_count;

  -- RETURNING に値がない = 制限超過で更新されなかった
  IF v_count IS NULL THEN
    -- 現在のカウントを取得
    SELECT gu.count INTO v_count
    FROM guest_usage gu
    WHERE gu.guest_id = p_guest_id AND gu.usage_date = p_usage_date;

    v_count := COALESCE(v_count, p_daily_limit);
    RETURN QUERY SELECT v_count, FALSE;
  ELSE
    RETURN QUERY SELECT v_count, TRUE;
  END IF;
END;
$$;
