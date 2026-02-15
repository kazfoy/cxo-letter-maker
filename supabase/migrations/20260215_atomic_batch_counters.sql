-- ============================================================
-- バッチカウンターのアトミックインクリメント関数
-- SELECT→UPDATE のrace conditionを解消
-- ============================================================

-- 成功時: processed_count + success_count を同時にインクリメント
CREATE OR REPLACE FUNCTION public.increment_batch_success(job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.batch_jobs
  SET
    processed_count = COALESCE(processed_count, 0) + 1,
    success_count = COALESCE(success_count, 0) + 1,
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 失敗時: processed_count + failure_count を同時にインクリメント
CREATE OR REPLACE FUNCTION public.increment_batch_failure(job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.batch_jobs
  SET
    processed_count = COALESCE(processed_count, 0) + 1,
    failure_count = COALESCE(failure_count, 0) + 1,
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_batch_success IS 'バッチ成功時のアトミックカウンターインクリメント';
COMMENT ON FUNCTION public.increment_batch_failure IS 'バッチ失敗時のアトミックカウンターインクリメント';
