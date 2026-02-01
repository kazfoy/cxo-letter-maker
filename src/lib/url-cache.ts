/**
 * URL分析結果キャッシュ（24時間TTL）
 * 特定ドメインへのアクセス集中を防ぐためのインメモリキャッシュ
 */

import { devLog } from '@/lib/logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// キャッシュTTL: 24時間
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// クリーンアップ間隔: 10分
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * URLを正規化してキャッシュキーとして使用
 * - hostname のみ小文字化（パスは大文字小文字を保持）
 * - 末尾スラッシュ除去
 * - fragment（#以降）は除外
 * - pathname/query はそのまま保持
 */
function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);
    // hostname のみ小文字化
    const hostname = parsed.hostname.toLowerCase();
    // pathname の末尾スラッシュを除去（ルートパスを除く）
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    // fragment は除外、query はそのまま
    return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}${pathname}${parsed.search}`;
  } catch {
    // パース失敗時は元のURLをそのまま使用
    return url;
  }
}

/**
 * キャッシュから分析結果を取得
 * @param url 対象URL
 * @returns キャッシュされた分析結果、またはnull
 */
export function getCachedAnalysis<T>(url: string): T | null {
  const key = normalizeUrlForCache(url);
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  devLog.log('[Cache] Hit:', key);
  return entry.data;
}

/**
 * 分析結果をキャッシュに保存
 * @param url 対象URL
 * @param data キャッシュするデータ
 */
export function setCachedAnalysis<T>(url: string, data: T): void {
  const key = normalizeUrlForCache(url);
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  devLog.log('[Cache] Set:', key);
}

/**
 * 期限切れエントリを削除
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    devLog.log('[Cache] Cleanup: removed', removedCount, 'expired entries');
  }
}

// 10分ごとに期限切れエントリをクリーンアップ
// サーバーレス環境ではコールドスタート時にリセットされるが許容範囲
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

// キャッシュデータ型（analyze-input用）
export interface CachedUrlData {
  extractedContent: string;
  extractedFacts: import('@/types/analysis').ExtractedFacts | null;
  extractedSources: import('@/types/analysis').InformationSource[];
}
