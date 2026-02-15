/**
 * URL分析結果キャッシュ（L1: インメモリ / L2: Supabase）
 * L1: 24時間TTL、コールドスタートで消失
 * L2: 7日間TTL、永続的
 */

import { createHash } from 'crypto';
import { devLog } from '@/lib/logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// L1: インメモリキャッシュ
const cache = new Map<string, CacheEntry<unknown>>();

// L1 TTL: 24時間
const L1_TTL_MS = 24 * 60 * 60 * 1000;

// L2 TTL: 7日間
const L2_TTL_DAYS = 7;

// クリーンアップ間隔: 10分
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * URLを正規化してキャッシュキーとして使用
 */
function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}${pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * 正規化URLのSHA256ハッシュを生成
 */
function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

/**
 * キャッシュから分析結果を取得（L1 → L2 フォールスルー）
 */
export async function getCachedAnalysis<T>(url: string): Promise<T | null> {
  const key = normalizeUrlForCache(url);

  // L1: インメモリ確認
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry) {
    if (Date.now() <= entry.expiresAt) {
      devLog.log('[Cache L1] Hit:', key);
      return entry.data;
    }
    cache.delete(key);
  }

  // L2: Supabase確認
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabase = getSupabaseAdmin();
    const urlHash = hashUrl(key);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any)
      .from('url_analysis_cache')
      .select('data')
      .eq('url_hash', urlHash)
      .gt('expires_at', new Date().toISOString())
      .single() as { data: { data: unknown } | null; error: unknown };

    if (error || !row) {
      return null;
    }

    // L2ヒット → L1にも書き戻し
    const result = row.data as T;
    cache.set(key, { data: result, expiresAt: Date.now() + L1_TTL_MS });
    devLog.log('[Cache L2] Hit:', key);
    return result;
  } catch (error) {
    devLog.warn('[Cache L2] Read error:', error);
    return null;
  }
}

/**
 * 分析結果をキャッシュに保存（L1 + L2 同時書き込み）
 */
export async function setCachedAnalysis<T>(url: string, data: T): Promise<void> {
  const key = normalizeUrlForCache(url);

  // L1: インメモリに即座に保存
  cache.set(key, { data, expiresAt: Date.now() + L1_TTL_MS });
  devLog.log('[Cache L1] Set:', key);

  // L2: Supabaseに非同期保存（失敗しても動作に影響なし）
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabase = getSupabaseAdmin();
    const urlHash = hashUrl(key);
    const expiresAt = new Date(Date.now() + L2_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('url_analysis_cache')
      .upsert(
        { url_hash: urlHash, url: key, data, expires_at: expiresAt },
        { onConflict: 'url_hash' }
      );

    if (error) {
      devLog.warn('[Cache L2] Write error:', error.message);
    } else {
      devLog.log('[Cache L2] Set:', key);
    }
  } catch (error) {
    devLog.warn('[Cache L2] Write error:', error);
  }
}

/**
 * 期限切れエントリを削除（L1のみ。L2はRPCで定期実行）
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
    devLog.log('[Cache L1] Cleanup: removed', removedCount, 'expired entries');
  }
}

if (typeof globalThis !== 'undefined') {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

// キャッシュデータ型（analyze-input用）
export interface CachedUrlData {
  extractedContent: string;
  extractedFacts: import('@/types/analysis').ExtractedFacts | null;
  extractedSources: import('@/types/analysis').InformationSource[];
}
