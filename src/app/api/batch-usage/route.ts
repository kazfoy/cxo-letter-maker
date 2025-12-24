/**
 * CSV一括生成の日次使用量を取得するAPI
 */

import { NextResponse } from 'next/server';
import { authGuard } from '@/lib/api-guard';
import { checkDailyBatchUsage } from '@/lib/dailyLimitChecker';

export async function GET() {
  return await authGuard(async (user) => {
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const usage = await checkDailyBatchUsage(user.id);

    return NextResponse.json({
      usedToday: usage.usedToday,
      dailyLimit: usage.dailyLimit,
      remaining: usage.remaining,
      isLimitReached: usage.isLimitReached,
      userPlan: usage.userPlan,
    });
  });
}
