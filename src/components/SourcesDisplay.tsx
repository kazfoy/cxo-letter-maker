'use client';

import React, { useState } from 'react';
import type { InformationSource, SourceCategory } from '@/types/analysis';
import type { Citation } from '@/types/generate-v2';

interface SourcesDisplayProps {
  sources?: InformationSource[];
  citations?: Citation[];  // Phase 6: 本文使用箇所
  hasUrl: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  corporate: '企業情報',
  news: 'ニュース',
  recruit: '採用',
  ir: 'IR',
  product: '製品',
  other: 'その他',
};

const CATEGORY_COLORS: Record<SourceCategory, string> = {
  corporate: 'bg-blue-50 text-blue-700 border-blue-200',
  news: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recruit: 'bg-purple-50 text-purple-700 border-purple-200',
  ir: 'bg-amber-50 text-amber-700 border-amber-200',
  product: 'bg-rose-50 text-rose-700 border-rose-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

export function SourcesDisplay({
  sources,
  citations,
  hasUrl,
  defaultExpanded = false,
  className = '',
}: SourcesDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 状態分岐
  // 1. URLが未入力の場合
  if (!hasUrl) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-sm font-medium">情報ソース（AI生成の根拠）</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          URLを入れると根拠を表示できます
        </p>
      </div>
    );
  }

  // 2. URLあり & sources===undefined: 取得中
  if (sources === undefined) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm">情報ソースを取得中…</span>
        </div>
      </div>
    );
  }

  // 3. URLあり & sources.length===0: 取得失敗
  if (sources.length === 0) {
    return (
      <div className={`bg-slate-50 border border-slate-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">情報ソースを取得できませんでした</span>
        </div>
      </div>
    );
  }

  // 4. sourcesあり: 通常表示

  // 主な情報ソースとその他を分離
  const primarySources = sources.filter(s => s.isPrimary);
  const otherSources = sources.filter(s => !s.isPrimary);

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* ヘッダー（折りたたみトリガー） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="font-semibold text-slate-800">情報ソース（AI生成の根拠）</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {sources.length}件
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

      {/* ソース一覧（展開時） */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* 主な情報ソース */}
          {primarySources.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">⭐</span>
                <span className="text-xs font-semibold text-slate-600">参照したページ</span>
              </div>
              <div className="space-y-2">
                {primarySources.map((source, i) => (
                  <SourceItem key={i} source={source} />
                ))}
              </div>
            </div>
          )}

          {/* その他の情報ソース */}
          {otherSources.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📄</span>
                <span className="text-xs font-semibold text-slate-600">その他の情報ソース</span>
              </div>
              <div className="space-y-2">
                {otherSources.map((source, i) => (
                  <SourceItem key={i} source={source} />
                ))}
              </div>
            </div>
          )}

          {/* Phase 6: 本文での利用箇所 */}
          {citations && citations.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📝</span>
                <span className="text-xs font-semibold text-slate-600">本文での利用箇所</span>
              </div>
              <div className="space-y-2">
                {citations.map((citation, i) => (
                  <CitationItem key={i} citation={citation} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceItem({ source }: { source: InformationSource }) {
  const categoryLabel = CATEGORY_LABELS[source.category];
  const categoryColor = CATEGORY_COLORS[source.category];

  // URLからドメインを取得
  let domain = '';
  try {
    domain = new URL(source.url).hostname;
  } catch {
    domain = source.url;
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors group"
    >
      {/* カテゴリバッジ */}
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${categoryColor}`}>
        {categoryLabel}
      </span>

      {/* タイトルとURL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">
          {source.title || domain}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {source.url}
        </p>
      </div>

      {/* 外部リンクアイコン */}
      <svg
        className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

/**
 * Phase 6: 本文使用箇所を表示するコンポーネント
 */
function CitationItem({ citation }: { citation: Citation }) {
  // 引用文を50文字で切り詰め
  const truncatedSentence = citation.sentence.length > 50
    ? citation.sentence.substring(0, 47) + '...'
    : citation.sentence;

  return (
    <div className="flex items-start gap-2 text-sm py-2 px-3 bg-slate-50 rounded-lg">
      <span className="text-slate-400 flex-shrink-0">・</span>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700">「{truncatedSentence}」</span>
        {citation.sourceUrl ? (
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
          >
            [出典: {citation.sourceTitle || 'リンク'}]
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : (
          <span className="ml-2 text-xs text-slate-400">[quoteKey: {citation.quoteKey}]</span>
        )}
      </div>
    </div>
  );
}
