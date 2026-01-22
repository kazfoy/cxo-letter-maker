'use client';

import React, { useState } from 'react';
import type { ExtractedFacts, ExtractedFactItem } from '@/types/analysis';

interface FactsDisplayProps {
  facts: ExtractedFacts;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * ファクトアイテムからコンテンツ文字列を取得するヘルパー
 */
function getFactContent(item: string | ExtractedFactItem): string {
  if (typeof item === 'string') {
    return item;
  }
  return item.content;
}

const CATEGORY_CONFIG: Record<keyof ExtractedFacts, { label: string; icon: string; color: string }> = {
  numbers: {
    label: '数値情報',
    icon: '#️⃣',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  properNouns: {
    label: '固有名詞',
    icon: '🏷️',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  recentMoves: {
    label: '最近の動き',
    icon: '📰',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  hiringTrends: {
    label: '採用動向',
    icon: '👥',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  companyDirection: {
    label: '会社の方向性',
    icon: '🎯',
    color: 'bg-rose-50 border-rose-200 text-rose-700',
  },
};

export function FactsDisplay({ facts, className = '', defaultExpanded = false }: FactsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // ファクトがあるかどうかをチェック
  const hasFacts = Object.values(facts).some(arr => arr.length > 0);
  const totalFactCount = Object.values(facts).reduce((sum, arr) => sum + arr.length, 0);

  if (!hasFacts) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">ファクトが抽出されませんでした</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          URLから具体的な情報を取得できませんでした。業界一般の仮説でレターを作成します。
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* ヘッダー（折りたたみトリガー） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-slate-800">抽出されたファクト</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {totalFactCount}件
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ファクト一覧（展開時） */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {(Object.keys(CATEGORY_CONFIG) as Array<keyof ExtractedFacts>).map((category) => {
            const items = facts[category];
            if (!items || items.length === 0) return null;

            const config = CATEGORY_CONFIG[category];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{config.icon}</span>
                  <span className="text-xs font-semibold text-slate-600">{config.label}</span>
                  <span className="text-xs text-slate-400">({items.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item, i) => {
                    const content = getFactContent(item);
                    return (
                      <span
                        key={i}
                        className={`inline-block px-2.5 py-1 rounded-md text-xs border ${config.color}`}
                      >
                        {content}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * コンパクト版（インライン表示用）
 */
export function FactsCompact({ facts, className = '' }: { facts: ExtractedFacts; className?: string }) {
  const hasFacts = Object.values(facts).some(arr => arr.length > 0);
  const totalFactCount = Object.values(facts).reduce((sum, arr) => sum + arr.length, 0);

  if (!hasFacts) {
    return (
      <span className={`text-xs text-slate-400 ${className}`}>
        ファクトなし
      </span>
    );
  }

  // 最初の3つのファクトを表示
  const allFacts = Object.values(facts).flat().slice(0, 3);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-slate-500">
        ファクト {totalFactCount}件:
      </span>
      {allFacts.map((fact, i) => {
        const content = getFactContent(fact);
        return (
          <span
            key={i}
            className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs truncate max-w-32"
            title={content}
          >
            {content}
          </span>
        );
      })}
      {totalFactCount > 3 && (
        <span className="text-xs text-slate-400">+{totalFactCount - 3}</span>
      )}
    </div>
  );
}
