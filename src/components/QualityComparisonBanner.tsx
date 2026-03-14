'use client';

import { Sparkles, Lock } from 'lucide-react';
import { useCheckout } from '@/hooks/useCheckout';

interface QualityComparisonBannerProps {
  /** レターが生成済みかどうか */
  hasLetter: boolean;
}

/**
 * FreeユーザーにPro品質の差を可視化するバナー
 * レター生成後に表示し、アップグレードを促す
 */
export function QualityComparisonBanner({ hasLetter }: QualityComparisonBannerProps) {
  const { handleUpgrade, loading } = useCheckout();

  if (!hasLetter) return null;

  return (
    <div className="mt-4 border border-amber-200 bg-gradient-to-r from-amber-50 to-white rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-900">Proプランならもっと高品質に</h3>
      </div>

      {/* 比較グリッド */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* 分析深度 */}
        <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
          <p className="text-[11px] font-medium text-stone-400 mb-1">分析深度</p>
          <p className="text-stone-600 font-medium">1ページ分析</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-[11px] font-medium text-amber-600 mb-1">Pro</p>
          <p className="text-amber-900 font-bold">12ページ深層分析</p>
        </div>

        {/* 品質スコア */}
        <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
          <p className="text-[11px] font-medium text-stone-400 mb-1">品質スコア</p>
          <p className="text-stone-400 font-medium">--</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-[11px] font-medium text-amber-600 mb-1">Pro</p>
          <p className="text-amber-900 font-bold">80点以上を自動保証</p>
        </div>

        {/* バリエーション */}
        <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
          <p className="text-[11px] font-medium text-stone-400 mb-1">バリエーション</p>
          <p className="text-stone-400 font-medium">なし</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 relative overflow-hidden">
          <p className="text-[11px] font-medium text-amber-600 mb-1">Pro</p>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-600" />
            <p className="text-amber-900 font-bold">3種同時生成</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => handleUpgrade('pro')}
        disabled={loading}
        className="w-full py-3 px-4 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-lg font-bold text-sm hover:from-amber-800 hover:to-amber-900 transition-all shadow-md active:scale-95 disabled:opacity-50"
      >
        {loading ? '処理中...' : '7日間無料でProを試す'}
      </button>
    </div>
  );
}
