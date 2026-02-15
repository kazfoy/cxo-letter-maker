/**
 * API ガードユーティリティ
 * 認証チェック、Zodバリデーション、レート制限を統合
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { checkRateLimitAsync, type RateLimitConfig } from './rate-limit';
import type { User } from '@supabase/supabase-js';
import { devLog } from './logger';

/**
 * APIガードのオプション
 */
export interface ApiGuardOptions {
  rateLimit?: RateLimitConfig;
  requireAuth?: boolean; // デフォルト: true
}

/**
 * API ガード関数
 * 認証チェック、入力バリデーション、レート制限を自動で実行
 *
 * @param request リクエストオブジェクト
 * @param schema Zodスキーマ
 * @param handler 実際の処理を行うハンドラー関数
 * @param options オプション設定
 * @returns レスポンス
 */
export async function apiGuard<T extends z.ZodType>(
  request: Request,
  schema: T,
  handler: (data: z.infer<T>, user: User | null) => Promise<Response | NextResponse>,
  options: ApiGuardOptions = {}
): Promise<Response | NextResponse> {
  try {
    const requireAuth = options.requireAuth !== false; // デフォルトは true

    // 1. 認証チェック
    let user: User | null = null;
    if (requireAuth) {
      const supabase = await createClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        devLog.warn('Unauthorized API access attempt');
        return NextResponse.json(
          { error: '認証が必要です' },
          { status: 401 }
        );
      }

      user = authUser;

      // 2. レート制限チェック（Supabase永続化版）
      if (options.rateLimit) {
        const isLimited = await checkRateLimitAsync(user.id, options.rateLimit);
        if (isLimited) {
          devLog.warn('Rate limit exceeded');
          return NextResponse.json(
            { error: 'リクエストが多すぎます。しばらく待ってから再試行してください' },
            { status: 429 }
          );
        }
      }
    }

    // 3. リクエストボディの取得とバリデーション
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '無効なJSON形式です' },
        { status: 400 }
      );
    }

    // 4. Zodバリデーション
    const parseResult = schema.safeParse(body);
    if (!parseResult.success) {
      devLog.warn('Validation failed');
      return NextResponse.json(
        {
          error: '入力値が正しくありません',
          details: parseResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 5. ハンドラーを実行
    // requireAuth が false の場合、user は null の可能性がある
    // ハンドラー側で user を使う場合は注意が必要
    return await handler(parseResult.data, user);
  } catch (error) {
    devLog.error('API guard error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 軽量版 API ガード（認証チェックのみ）
 * バリデーションが不要な場合に使用
 */
export async function authGuard(
  handler: (user: User | null) => Promise<Response | NextResponse>,
  options: ApiGuardOptions = {}
): Promise<Response | NextResponse> {
  try {
    const requireAuth = options.requireAuth !== false; // デフォルトは true

    // 1. 認証チェック
    let user: User | null = null;

    if (requireAuth) {
      const supabase = await createClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        devLog.warn('Unauthorized API access attempt');
        return NextResponse.json(
          { error: '認証が必要です' },
          { status: 401 }
        );
      }

      user = authUser;

      // 2. レート制限チェック（Supabase永続化版、認証ユーザーのみ）
      if (options.rateLimit) {
        const isLimited = await checkRateLimitAsync(user.id, options.rateLimit);
        if (isLimited) {
          devLog.warn('Rate limit exceeded');
          return NextResponse.json(
            { error: 'リクエストが多すぎます。しばらく待ってから再試行してください' },
            { status: 429 }
          );
        }
      }
    }

    // 3. ハンドラーを実行
    return await handler(user);
  } catch (error) {
    devLog.error('Auth guard error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
