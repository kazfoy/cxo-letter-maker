/**
 * クライアントIPアドレス取得ユーティリティ
 *
 * Vercel / リバースプロキシ環境に対応し、
 * x-forwarded-for → x-real-ip の優先順で取得する。
 */

import { headers } from 'next/headers';

/**
 * クライアントIPアドレスを取得する
 * 取得不可の場合は 'unknown' を返す（呼び出し側で fail-closed 判定に使う）
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  // Vercel / Cloudflare / nginx 等のプロキシが付与する標準ヘッダー
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // カンマ区切りの最初のIPが実クライアント
    return forwarded.split(',')[0].trim();
  }

  const realIp = headersList.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}
