/**
 * サーバーサイド環境変数バリデーション（Zodスキーマ）
 *
 * 初回アクセス時にバリデーションを実行し、不足・不正な環境変数を検出する。
 * ビルド時の評価を避けるためモジュールスコープでは実行せず、遅延初期化を使用。
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  // Google AI（いずれか1つ以上必須）
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  GOOGLE_GEMINI_API_KEY: z.string().min(1).optional(),

  // Google Search（オプション: 企業ニュース検索用）
  GOOGLE_SEARCH_API_KEY: z.string().min(1).optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().min(1).optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ID_PRO_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_ID_PREMIUM_MONTHLY: z.string().min(1).optional(),
}).refine(
  (data) => data.GOOGLE_GENERATIVE_AI_API_KEY || data.GOOGLE_GEMINI_API_KEY,
  { message: 'GOOGLE_GENERATIVE_AI_API_KEY または GOOGLE_GEMINI_API_KEY のいずれかが必要です' }
);

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _serverEnv: ServerEnv | null = null;

/**
 * サーバーサイド環境変数を取得（初回アクセス時にバリデーション）
 */
export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error('❌ 環境変数バリデーション失敗:\n' + missing);
    throw new Error(`環境変数が不足または不正です:\n${missing}`);
  }

  _serverEnv = result.data;
  return _serverEnv;
}

/**
 * Gemini API キーを取得
 * GOOGLE_GENERATIVE_AI_API_KEY を優先、フォールバックとして GOOGLE_GEMINI_API_KEY を使用
 */
export function getGeminiApiKey(): string {
  const env = getServerEnv();
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GEMINI_API_KEY;
  if (!key) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GEMINI_API_KEY must be set');
  }
  return key;
}

/**
 * Google Search API設定を取得（未設定の場合はnull）
 */
export function getGoogleSearchConfig(): { apiKey: string; engineId: string } | null {
  const env = getServerEnv();
  if (!env.GOOGLE_SEARCH_API_KEY || !env.GOOGLE_SEARCH_ENGINE_ID) {
    return null;
  }
  return {
    apiKey: env.GOOGLE_SEARCH_API_KEY,
    engineId: env.GOOGLE_SEARCH_ENGINE_ID,
  };
}
