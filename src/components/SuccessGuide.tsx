'use client';

import { useState, useEffect } from 'react';

const SEEN_KEY = 'cxo_success_guide_seen';

interface SuccessGuideProps {
  isFirstGeneration: boolean;
}

const STEPS = [
  {
    number: 1,
    title: 'レターを確認・編集する',
    description: '生成されたレターを読み、必要に応じて自動編集で調整しましょう。',
    isCurrent: true,
  },
  {
    number: 2,
    title: 'コピーまたはダウンロードする',
    description: 'コピーボタンでクリップボードに取得、またはWord形式でダウンロードできます。',
    isCurrent: false,
  },
  {
    number: 3,
    title: '送付して結果を記録する',
    description: 'レターを送付したら、ステータスを更新して成果を追跡しましょう。',
    isCurrent: false,
  },
];

export function SuccessGuide({ isFirstGeneration }: SuccessGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen && isFirstGeneration) {
      setIsExpanded(true);
      localStorage.setItem(SEEN_KEY, 'true');
    }
  }, [isFirstGeneration]);

  return (
    <div className="mt-6 border border-amber-200 rounded-lg bg-amber-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-bold text-stone-800">成功への3ステップ</span>
        </div>
        <svg
          className={`w-4 h-4 text-stone-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  step.isCurrent
                    ? 'bg-amber-700 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {step.number}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-stone-800">{step.title}</p>
                  {step.isCurrent && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-800 rounded">
                      今ここ
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
