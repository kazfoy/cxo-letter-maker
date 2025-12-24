import { createClient } from '@/utils/supabase/server';
import { getDailyBatchLimit, type PlanType } from '@/config/subscriptionPlans';

export interface DailyUsageResult {
  /** 本日の使用済み件数 */
  usedToday: number;
  /** プラン別の日次上限 */
  dailyLimit: number;
  /** 残り利用可能件数 */
  remaining: number;
  /** 上限に達しているか */
  isLimitReached: boolean;
  /** ユーザーのプラン */
  userPlan: PlanType;
}

/**
 * 本日のCSV一括生成使用量を取得
 */
export async function checkDailyBatchUsage(userId: string): Promise<DailyUsageResult> {
  try {
    const supabase = await createClient();

    // 1. ユーザーのプラン情報を取得
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile:', profileError);
      // デフォルトはFreeプラン
      return {
        usedToday: 0,
        dailyLimit: 0,
        remaining: 0,
        isLimitReached: true,
        userPlan: 'free',
      };
    }

    const userPlan = (profile.plan || 'free') as PlanType;
    const dailyLimit = getDailyBatchLimit(userPlan);

    // Freeプランはそもそも一括生成不可
    if (userPlan === 'free') {
      return {
        usedToday: 0,
        dailyLimit: 0,
        remaining: 0,
        isLimitReached: true,
        userPlan: 'free',
      };
    }

    // 2. 本日の日付範囲を計算（UTC基準）
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStart = tomorrow.toISOString();

    // 3. 本日作成されたbatch_idを持つレターの件数をカウント
    const { count, error: countError } = await supabase
      .from('letters')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('batch_id', 'is', null)
      .gte('created_at', todayStart)
      .lt('created_at', tomorrowStart);

    if (countError) {
      console.error('Failed to count today\'s batch usage:', countError);
      // エラー時は安全側に倒して制限に達していると判定
      return {
        usedToday: dailyLimit,
        dailyLimit,
        remaining: 0,
        isLimitReached: true,
        userPlan,
      };
    }

    const usedToday = count || 0;
    const remaining = Math.max(0, dailyLimit - usedToday);
    const isLimitReached = usedToday >= dailyLimit;

    return {
      usedToday,
      dailyLimit,
      remaining,
      isLimitReached,
      userPlan,
    };
  } catch (error) {
    console.error('Error checking daily batch usage:', error);
    // エラー時は安全側に倒す
    return {
      usedToday: 0,
      dailyLimit: 0,
      remaining: 0,
      isLimitReached: true,
      userPlan: 'free',
    };
  }
}

/**
 * リクエストされた件数が日次制限内かチェック
 * @returns エラーメッセージ（制限内ならnull）
 */
export async function validateDailyBatchLimit(
  userId: string,
  requestedCount: number
): Promise<{ allowed: boolean; errorMessage?: string; usage?: DailyUsageResult }> {
  const usage = await checkDailyBatchUsage(userId);

  // Freeプランは一括生成不可
  if (usage.userPlan === 'free') {
    return {
      allowed: false,
      errorMessage:
        'CSV一括生成機能はProプラン以上で利用可能です。Proプランにアップグレードしてください。',
      usage,
    };
  }

  // 既に上限に達している
  if (usage.isLimitReached) {
    let upgradeMessage = '';
    if (usage.userPlan === 'pro') {
      upgradeMessage = ' Premiumプランなら1,000件/日まで生成可能です。';
    }

    const planName = usage.userPlan === 'pro' ? 'Proプラン' : '本日';
    return {
      allowed: false,
      errorMessage: `${planName}の上限（${usage.dailyLimit}件）に達しました。${upgradeMessage}`,
      usage,
    };
  }

  // リクエスト件数が残り枠を超える
  if (requestedCount > usage.remaining) {
    let upgradeMessage = '';
    if (usage.userPlan === 'pro') {
      upgradeMessage = ' Premiumプランなら1,000件/日まで生成可能です。';
    }

    return {
      allowed: false,
      errorMessage: `本日の残り枠（${usage.remaining}件）を超えています。リクエスト件数を${usage.remaining}件以下に減らすか、明日再度お試しください。${upgradeMessage}`,
      usage,
    };
  }

  // 制限内
  return {
    allowed: true,
    usage,
  };
}
