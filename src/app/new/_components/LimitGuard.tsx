'use client';

import Link from 'next/link';
import { useLetterStore } from '@/stores/letterStore';
import { useUiStore } from '@/stores/uiStore';

export function LimitGuard() {
  const isDemoMode = useLetterStore((s) => s.isDemoMode);
  const { showLimitModal, setShowLimitModal } = useUiStore();

  if (!showLimitModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700"></div>
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-stone-900 mb-2 text-center">
          {isDemoMode ? 'デモをお楽しみいただけましたか？' : 'あと少しで完成です！'}
        </h3>
        <p className="text-stone-600 mb-6 leading-relaxed text-center">
          無料登録すると今すぐ続きを作成できます。<br />
          <span className="text-xs text-stone-400">30秒で完了・クレジットカード不要</span>
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <ul className="space-y-2.5">
            {[
              <>1日<strong>10回</strong>まで生成可能（ゲストの3倍以上）</>,
              <>作成したレターの<strong>履歴を保存</strong>して再利用</>,
              <><strong>AI自動編集</strong>で文面を何度でも調整</>,
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                <svg className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 text-center"
          >
            無料で登録して続ける
          </Link>
          <button
            onClick={() => setShowLimitModal(false)}
            className="block w-full py-3 px-4 text-stone-400 hover:text-stone-600 text-sm font-medium transition-colors"
          >
            登録不要で明日また使う
          </button>
        </div>
      </div>
    </div>
  );
}
