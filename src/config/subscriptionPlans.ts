/**
 * Subscription Plans Configuration
 *
 * プラン体系の定義を一元管理するための設定ファイル
 * プランの制限値や価格を変更する際は、このファイルのみを修正すること
 */

import { MODEL_DEFAULT } from '@/lib/gemini';

export type PlanType = 'free' | 'pro' | 'premium';

export interface PlanConfig {
  /** プラン名（表示用） */
  label: string;
  /** 1日あたりのCSV一括生成可能件数 */
  dailyBatchLimit: number;
  /** 月額料金（円） */
  price: number;
  /** Stripe Price ID（環境変数から取得） */
  stripePriceId?: string;
  /** プランの説明 */
  description: string;
  /** 機能一覧 */
  features: string[];
  /** 使用AIモデルID */
  modelId: string;
}

/**
 * プラン定義
 * ※ Stripe Price ID は環境変数から動的に取得することを推奨（Next.jsのサーバーサイドでの評価タイミングの問題回避）
 */
export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    label: 'Free',
    dailyBatchLimit: 0,
    price: 0,
    modelId: MODEL_DEFAULT,
    description: '個人利用向けの無料プラン',
    features: [
      '手紙の個別生成（無制限）',
      '基本的なAI生成機能',
      '履歴の保存（最新10件）',
    ],
  },
  pro: {
    label: 'Pro',
    dailyBatchLimit: 100,
    price: 980,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
    modelId: MODEL_DEFAULT,
    description: '本格的な営業活動に最適なプラン',
    features: [
      '手紙の個別生成（無制限）',
      'CSV一括生成（100件/日）',
      '全履歴の無制限保存',
      '最新AI（Gemini 2.5）による高度な生成',
      '優先メールサポート',
    ],
  },
  premium: {
    label: 'Premium',
    dailyBatchLimit: 1000,
    price: 9800,
    stripePriceId: process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY,
    modelId: MODEL_DEFAULT, // TODO: Premium専用モデル（gemini-3系）が利用可能になり次第差し替え
    description: '大規模な営業活動を行う法人向けプラン',
    features: [
      '手紙の個別生成（無制限）',
      'CSV一括生成（1,000件/日）',
      '全履歴の無制限保存',
      '最新AI（Gemini 2.5）による高度な生成',
      '優先メールサポート（最優先対応）',
    ],
  },
} as const;

/**
 * 堅牢なプラン設定取得関数
 * 環境変数が定義されていない場合のエラーハンドリングを行う
 */
export function getPlanConfig(planType: PlanType): PlanConfig {
  const plan = PLANS[planType];

  // サーバーサイドでの実行時、環境変数を再評価
  const stripePriceId =
    planType === 'pro' ? process.env.STRIPE_PRICE_ID_PRO_MONTHLY :
      planType === 'premium' ? process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY :
        undefined;

  return {
    ...plan,
    stripePriceId: stripePriceId || plan.stripePriceId,
  };
}

/**
 * プラン名の配列
 */
export const PLAN_NAMES: PlanType[] = ['free', 'pro', 'premium'];

/**
 * プランの比較順序（下位プラン < 上位プラン）
 */
export const PLAN_TIER: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

/**
 * ユーティリティ関数: プランの取得
 */
export function getPlan(planType: PlanType): PlanConfig {
  return PLANS[planType];
}

/**
 * ユーティリティ関数: プランの比較
 * @returns planA > planB なら true
 */
export function isPlanHigherThan(planA: PlanType, planB: PlanType): boolean {
  return PLAN_TIER[planA] > PLAN_TIER[planB];
}

/**
 * ユーティリティ関数: 日次制限の取得
 */
export function getDailyBatchLimit(planType: PlanType): number {
  return PLANS[planType].dailyBatchLimit;
}

/**
 * ユーティリティ関数: 価格の取得（表示用フォーマット）
 */
export function getFormattedPrice(planType: PlanType): string {
  const price = PLANS[planType].price;
  if (price === 0) return '無料';
  return `¥${price.toLocaleString()}/月`;
}

/**
 * Free プランの履歴保存上限
 */
export const FREE_HISTORY_LIMIT = 10;

/**
 * 1回のバッチ生成リクエストあたりの最大件数
 * （APIのパフォーマンス保護のため）
 */
export const MAX_BATCH_SIZE_PER_REQUEST = 1000;
