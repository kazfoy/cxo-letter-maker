/**
 * レート制限ユーティリティ（Supabase永続化 + インメモリフォールバック）
 *
 * サーバーレス環境でもレート制限が継続されるよう、
 * Supabase rate_limit_logs テーブルをプライマリストアとして使用。
 * DB障害時はインメモリフォールバックで動作。
 */

import { getSupabaseAdmin } from './supabase-admin';
import { devLog } from './logger';

// インメモリフォールバック用
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const limitStore = new Map<string, RateLimitEntry>();

// フォールバック用クリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limitStore.entries()) {
    if (now > entry.resetAt) {
      limitStore.delete(key);
    }
  }
}, 60000);

export interface RateLimitConfig {
  windowMs?: number;     // タイムウィンドウ（ミリ秒）
  maxRequests?: number;  // タイムウィンドウ内の最大リクエスト数
  endpoint?: string;     // エンドポイント識別子（ログ用）
}

/**
 * レート制限をチェックする（Supabase永続化版）
 * @param identifier ユーザー識別子（ユーザーID or IP）
 * @param config レート制限の設定
 * @returns レート制限に引っかかった場合は true
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<boolean> {
  const windowMs = config.windowMs || 60000;
  const maxRequests = config.maxRequests || 10;
  const endpoint = config.endpoint || 'unknown';

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabaseAdmin.from('rate_limit_logs') as any)
      .select('id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart);

    if (error) {
      devLog.error('Rate limit DB check failed, falling back to in-memory:', error);
      return checkRateLimitInMemory(identifier, config);
    }

    const currentCount = count || 0;

    if (currentCount >= maxRequests) {
      return true; // 制限超過
    }

    // リクエストをログに記録
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabaseAdmin.from('rate_limit_logs') as any)
      .insert({
        identifier,
        endpoint,
      });

    if (insertError) {
      devLog.error('Rate limit log insert failed:', insertError);
    }

    return false;
  } catch (error) {
    devLog.error('Rate limit check error, falling back to in-memory:', error);
    return checkRateLimitInMemory(identifier, config);
  }
}

/**
 * レート制限をチェックする（インメモリ版 - フォールバック＋同期API互換）
 * @param identifier ユーザー識別子
 * @param config レート制限の設定
 * @returns レート制限に引っかかった場合は true
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): boolean {
  return checkRateLimitInMemory(identifier, config);
}

function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig = {}
): boolean {
  const windowMs = config.windowMs || 60000;
  const maxRequests = config.maxRequests || 10;

  const now = Date.now();
  const entry = limitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    limitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return false;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return true;
  }

  return false;
}

/**
 * レート制限情報を取得する
 * @param identifier ユーザー識別子
 * @returns レート制限の詳細情報
 */
export function getRateLimitInfo(identifier: string) {
  const entry = limitStore.get(identifier);
  const now = Date.now();

  if (!entry || now > entry.resetAt) {
    return {
      count: 0,
      remaining: 10,
      resetAt: now + 60000,
    };
  }

  return {
    count: entry.count,
    remaining: Math.max(0, 10 - entry.count),
    resetAt: entry.resetAt,
  };
}
