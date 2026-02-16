'use client';

import React, { useState, useMemo } from 'react';
import type { InformationSource, SourceCategory } from '@/types/analysis';
import type { Citation } from '@/types/generate-v2';

interface SourcesDisplayProps {
  sources?: InformationSource[];
  citations?: Citation[];  // Phase 6: 本文使用箇所
  hasUrl: boolean;
  defaultExpanded?: boolean;
  className?: string;
  bodyText?: string;  // Phase 6: 本文（citation位置計算用）
}

const CATEGORY_LABELS: Record<SourceCategory, string> = {
  corporate: 'コーポレート（企業概要・経営方針）',
  news: 'プレスリリース・ニュース',
  recruit: '採用情報',
  ir: 'IR・決算情報',
  product: '製品・サービス情報',
  other: 'その他',
};

/** 表示するソースの最大件数 */
const MAX_DISPLAY_SOURCES = 6;

const CATEGORY_COLORS: Record<SourceCategory, string> = {
  corporate: 'bg-blue-50 text-blue-700 border-blue-200',
  news: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recruit: 'bg-teal-50 text-teal-700 border-teal-200',
  ir: 'bg-purple-50 text-purple-700 border-purple-200',
  product: 'bg-rose-50 text-rose-700 border-rose-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

/**
 * 一覧ページ判定（具体性の低いURL）
 */
function isListingPageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    // パスの深さが2以下で、newsroom/news/ir等で終わる場合は一覧ページ
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length <= 2) {
      const lastPart = pathParts[pathParts.length - 1] || '';
      if (['news', 'newsroom', 'ir', 'press', 'topics', 'release'].includes(lastPart)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ソースとcitationを紐づけて表示用データを構築
 */
interface SourceWithCitations {
  source: InformationSource;
  citations: Citation[];
  isUsedInLetter: boolean;
}

export function SourcesDisplay({
  sources,
  citations,
  hasUrl,
  defaultExpanded = false,
  className = '',
  bodyText,
}: SourcesDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // ソースとcitationを紐づけて表示用データを構築
  const sourcesWithCitations = useMemo((): SourceWithCitations[] => {
    if (!sources || sources.length === 0) return [];

    // citationのsourceUrlでグループ化
    const citationsByUrl = new Map<string, Citation[]>();
    if (citations) {
      for (const citation of citations) {
        if (citation.sourceUrl) {
          const existing = citationsByUrl.get(citation.sourceUrl) || [];
          existing.push(citation);
          citationsByUrl.set(citation.sourceUrl, existing);
        }
      }
    }

    // ソースにcitationを紐づけ
    const result: SourceWithCitations[] = sources.map(source => ({
      source,
      citations: citationsByUrl.get(source.url) || [],
      isUsedInLetter: citationsByUrl.has(source.url),
    }));

    // ソート: 1. レターで使用された 2. 一覧ページでない 3. isPrimary
    return result.sort((a, b) => {
      // レターで使用されたソースを優先
      if (a.isUsedInLetter !== b.isUsedInLetter) {
        return a.isUsedInLetter ? -1 : 1;
      }
      // 一覧ページでないソースを優先
      const aIsListing = isListingPageUrl(a.source.url);
      const bIsListing = isListingPageUrl(b.source.url);
      if (aIsListing !== bIsListing) {
        return aIsListing ? 1 : -1;
      }
      // isPrimaryを優先
      if (a.source.isPrimary !== b.source.isPrimary) {
        return a.source.isPrimary ? -1 : 1;
      }
      return 0;
    });
  }, [sources, citations]);

  // 表示用ソース（一覧ページは除外、citationがあるものを優先）
  const displayData = useMemo(() => {
    // citationがあるソースを優先表示
    const usedSources = sourcesWithCitations.filter(s => s.isUsedInLetter);
    const unusedSources = sourcesWithCitations.filter(s => !s.isUsedInLetter);

    // 一覧ページは除外（具体的な記事がある場合）
    const specificSources = usedSources.filter(s => !isListingPageUrl(s.source.url));
    const listingSources = usedSources.filter(s => isListingPageUrl(s.source.url));

    // 具体的なソースを優先、なければ一覧ページも表示
    let displaySources: SourceWithCitations[] = [];
    if (specificSources.length > 0) {
      displaySources = specificSources.slice(0, MAX_DISPLAY_SOURCES);
    } else if (listingSources.length > 0) {
      displaySources = listingSources.slice(0, MAX_DISPLAY_SOURCES);
    } else {
      // citationがない場合は通常のソースから
      const specificUnused = unusedSources.filter(s => !isListingPageUrl(s.source.url));
      displaySources = specificUnused.slice(0, MAX_DISPLAY_SOURCES);
    }

    const remaining = sourcesWithCitations.length - displaySources.length;
    return { displaySources, remaining };
  }, [sourcesWithCitations]);

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
  const { displaySources, remaining } = displayData;

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* ヘッダー（折りたたみトリガー） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="font-semibold text-slate-800">情報ソース（AI生成の根拠）</span>
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
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
          {/* 参照したページ（citationと紐づけて表示） */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🔗</span>
              <span className="text-xs font-semibold text-slate-600">
                参照したページ
                {remaining > 0 && (
                  <span className="text-slate-400 font-normal ml-1">
                    （他{remaining}件）
                  </span>
                )}
              </span>
            </div>
            <div className="space-y-3">
              {displaySources.map((item, i) => (
                <SourceItemWithCitations
                  key={i}
                  source={item.source}
                  citations={item.citations}
                  bodyText={bodyText}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ソースとその利用箇所を表示するコンポーネント
 */
function SourceItemWithCitations({
  source,
  citations,
  bodyText,
}: {
  source: InformationSource;
  citations: Citation[];
  bodyText?: string;
}) {
  const categoryLabel = CATEGORY_LABELS[source.category];
  const categoryColor = CATEGORY_COLORS[source.category];

  // URLからホスト+パスを抽出（ページ単位）
  let displayPath = source.url;
  try {
    const urlObj = new URL(source.url);
    const fullPath = urlObj.hostname + urlObj.pathname;
    displayPath = fullPath.length > 60
      ? fullPath.substring(0, 57) + '...'
      : fullPath;
  } catch {
    displayPath = source.url;
  }

  // 本文での位置を計算
  const getLocationLabel = (sentence: string): string | null => {
    if (!bodyText || !sentence) return null;

    const searchText = sentence.replace(/\.\.\.$/g, '').substring(0, 20);
    const index = bodyText.indexOf(searchText);

    if (index === -1) return null;

    const ratio = index / bodyText.length;
    if (ratio < 0.2) return '冒頭';
    if (ratio < 0.5) return '前半';
    if (ratio < 0.8) return '中盤';
    return '終盤';
  };

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* ソース情報 */}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.url}
        className="block p-3 hover:bg-slate-50 transition-colors group"
      >
        <div className="space-y-2">
          {/* タイトル・URL */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-amber-700">
                {source.title || displayPath}
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5" title={source.url}>
                {displayPath}
              </p>
            </div>

            {/* 外部リンクアイコン */}
            <svg
              className="w-4 h-4 text-slate-400 group-hover:text-amber-700 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>

          {/* カテゴリバッジ */}
          <div>
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${categoryColor}`}>
              {categoryLabel}
            </span>
          </div>
        </div>
      </a>

      {/* 抽出された情報（extractedFacts） */}
      {source.extractedFacts && source.extractedFacts.length > 0 && (
        <div className="border-t border-slate-100 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            抽出した情報:
          </p>
          <ul className="space-y-1 text-xs text-slate-700">
            {source.extractedFacts.slice(0, 5).map((fact, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-600 flex-shrink-0 mt-0.5">・</span>
                <span className="leading-relaxed">{fact}</span>
              </li>
            ))}
            {source.extractedFacts.length > 5 && (
              <li className="text-slate-400 text-xs italic pl-3">
                他{source.extractedFacts.length - 5}件
              </li>
            )}
          </ul>
        </div>
      )}

      {/* このソースからの引用（利用箇所） */}
      {citations.length > 0 && (
        <div className="border-t border-slate-100 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            レターでの使用箇所:
          </p>
          <div className="space-y-1.5">
            {citations.map((citation, i) => {
              const location = getLocationLabel(citation.sentence);
              const truncatedSentence = citation.sentence.length > 45
                ? citation.sentence.substring(0, 42) + '...'
                : citation.sentence;

              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {location && (
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      {location}
                    </span>
                  )}
                  <span className="text-slate-600">「{truncatedSentence}」</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 利用箇所もファクトもない場合の表示 */}
      {citations.length === 0 && (!source.extractedFacts || source.extractedFacts.length === 0) && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-400">
            参考情報として取得
          </p>
        </div>
      )}
    </div>
  );
}

