/**
 * レート制限ユーティリティ（簡易インメモリ版）
 * 本番環境では Redis などの永続化ストレージの使用を推奨
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limitStore = new Map<string, RateLimitEntry>();

// クリーンアップ: 期限切れエントリを定期的に削除
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limitStore.entries()) {
    if (now > entry.resetAt) {
      limitStore.delete(key);
    }
  }
}, 60000); // 1分ごとにクリーンアップ

export interface RateLimitConfig {
  windowMs?: number; // タイムウィンドウ（ミリ秒）
  maxRequests?: number; // タイムウィンドウ内の最大リクエスト数
}

/**
 * レート制限をチェックする
 * @param identifier ユーザー識別子（通常はユーザーID）
 * @param config レート制限の設定
 * @returns レート制限に引っかかった場合は true
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): boolean {
  const windowMs = config.windowMs || 60000; // デフォルト: 1分
  const maxRequests = config.maxRequests || 10; // デフォルト: 10リクエスト

  const now = Date.now();
  const entry = limitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    // 新しいウィンドウを開始
    limitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return false;
  }

  // カウントをインクリメント
  entry.count++;

  // 制限を超えた場合
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
