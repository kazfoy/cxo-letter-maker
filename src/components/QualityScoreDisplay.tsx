'use client';

import React from 'react';
import type { DetailedQualityScore } from '@/lib/qualityGate';

interface QualityScoreDisplayProps {
  score: DetailedQualityScore;
  className?: string;
}

const BREAKDOWN_LABELS: Record<keyof DetailedQualityScore['breakdown'], string> = {
  specificity: '具体性',
  empathy: '共感性',
  ctaClarity: 'CTA明確さ',
  fiveElementsComplete: '5要素充足',
  noNgExpressions: '表現品質',
};

const MAX_SCORE_PER_ITEM = 20;

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getProgressBarColor(value: number, max: number): string {
  const percentage = (value / max) * 100;
  if (percentage >= 80) return 'bg-green-500';
  if (percentage >= 50) return 'bg-amber-500';
  return 'bg-red-400';
}

export function QualityScoreDisplay({ score, className = '' }: QualityScoreDisplayProps) {
  const { total, breakdown, suggestions } = score;

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>
      {/* 合計スコア */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-700">品質スコア</h4>
        <div className={`text-2xl font-bold ${getScoreColor(total)}`}>
          {total}
          <span className="text-sm text-slate-400 font-normal ml-1">/ 100</span>
        </div>
      </div>

      {/* 総合プログレスバー */}
      <div className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(total)}`}
          style={{ width: `${total}%` }}
        />
      </div>

      {/* 5軸の内訳 */}
      <div className="space-y-3 mb-4">
        {(Object.keys(breakdown) as Array<keyof typeof breakdown>).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-24 flex-shrink-0">
              {BREAKDOWN_LABELS[key]}
            </span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(breakdown[key], MAX_SCORE_PER_ITEM)}`}
                style={{ width: `${(breakdown[key] / MAX_SCORE_PER_ITEM) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-8 text-right">
              {breakdown[key]}/{MAX_SCORE_PER_ITEM}
            </span>
          </div>
        ))}
      </div>

      {/* 改善ポイント */}
      {suggestions.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            改善ポイント
          </h5>
          <ul className="space-y-1">
            {suggestions.map((suggestion, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * コンパクト版（PreviewAreaのヘッダーに表示用）
 */
export function QualityScoreBadge({ score, className = '' }: QualityScoreDisplayProps) {
  const { total } = score;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
      total >= 80 ? 'bg-green-50 text-green-700' :
      total >= 60 ? 'bg-amber-50 text-amber-700' :
      'bg-red-50 text-red-700'
    } ${className}`}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs font-semibold">{total}</span>
    </div>
  );
}
