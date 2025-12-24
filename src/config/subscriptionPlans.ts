/**
 * Subscription Plans Configuration
 *
 * プラン体系の定義を一元管理するための設定ファイル
 * プランの制限値や価格を変更する際は、このファイルのみを修正すること
 */

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
}

/**
 * プラン定義
 */
export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    label: 'Free',
    dailyBatchLimit: 0, // CSV一括生成不可
    price: 0,
    description: '個人利用向けの無料プラン',
    features: [
      '手紙の個別生成（無制限）',
      '基本的なAI生成機能',
      '履歴の保存（最新10件）',
    ],
  },
  pro: {
    label: 'Pro',
    dailyBatchLimit: 100, // 100件/日
    price: 2980,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
    description: 'ビジネス利用向けプラン',
    features: [
      '手紙の個別生成（無制限）',
      'CSV一括生成（100件/日）',
      '高度なAI生成機能',
      '履歴の無制限保存',
      '優先サポート',
    ],
  },
  premium: {
    label: 'Premium',
    dailyBatchLimit: 1000, // 1000件/日
    price: 9800,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM,
    description: '大規模営業活動向けプラン',
    features: [
      '手紙の個別生成（無制限）',
      'CSV一括生成（1000件/日）',
      '高度なAI生成機能',
      '履歴の無制限保存',
      '優先サポート',
      '専任担当者によるサポート',
    ],
  },
} as const;

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
export const MAX_BATCH_SIZE_PER_REQUEST = 50;
