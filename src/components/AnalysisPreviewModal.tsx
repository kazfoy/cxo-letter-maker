'use client';

import React, { useState, useCallback } from 'react';
import type { AnalysisResult, InformationSource } from '@/types/analysis';
import type { UserOverrides } from '@/types/generate-v2';
import { FactsDisplay } from '@/components/FactsDisplay';
import { SourcesDisplay } from '@/components/SourcesDisplay';

/**
 * APIレスポンスの参照揺れを吸収
 */
function normalizeSources(
  result: AnalysisResult | { analysis?: AnalysisResult } | null | undefined
): InformationSource[] | undefined {
  if (!result) return undefined;
  if ('sources' in result && result.sources) return result.sources;
  if ('analysis' in result && result.analysis?.sources) return result.analysis.sources;
  return undefined;
}

interface AnalysisPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  onConfirm: (overrides: UserOverrides, mode: 'draft' | 'complete' | 'event' | 'consulting') => void;
  isLoading: boolean;
  hasUrl: boolean;
  letterMode?: 'sales' | 'event' | 'consulting';  // ページレベルのモード
}

export function AnalysisPreviewModal({
  isOpen,
  onClose,
  analysisResult,
  onConfirm,
  isLoading,
  hasUrl,
  letterMode = 'sales',
}: AnalysisPreviewModalProps) {
  // Draftモード自動判定: URLなし または 情報が少ない場合
  const shouldDefaultToDraft = !hasUrl || (analysisResult?.missing_info.filter(m => m.priority === 'high').length ?? 0) > 2;
  const [mode, setMode] = useState<'draft' | 'complete'>(shouldDefaultToDraft ? 'draft' : 'complete');
  const [overrides, setOverrides] = useState<UserOverrides>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(['proof_points', 'extracted_facts', 'sources', 'risk_flags']));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const allExpanded = expandedSections.size >= 4;

  const handleOverrideChange = useCallback((field: string, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    // event/consultingモードの場合はそのまま、それ以外はdraft/completeを渡す
    const apiMode = letterMode === 'event' ? 'event' : letterMode === 'consulting' ? 'consulting' : mode;
    onConfirm(overrides, apiMode);
  }, [onConfirm, overrides, mode, letterMode]);

  if (!isOpen) return null;

  const highPriorityMissing = analysisResult?.missing_info.filter(m => m.priority === 'high') || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-900">分析結果の確認</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {analysisResult ? (
            <>
              {/* 仮説モード警告バナー（URLブロック時） */}
              {(() => {
                const blockedFlag = analysisResult.risk_flags?.find(
                  (f) => f.message.includes('ブロック') || f.message.includes('仮説モード')
                );
                return blockedFlag ? (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <span className="mr-1">&#9888;&#65039;</span> {blockedFlag.message}
                  </div>
                ) : null;
              })()}

              {/* 抽出された情報 */}
              <section className="mb-6">
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  抽出された情報
                </h4>
                <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                  {analysisResult.facts.company_name && (
                    <p><span className="font-medium text-slate-700">企業名:</span> <span className="text-slate-900">{analysisResult.facts.company_name}</span></p>
                  )}
                  {analysisResult.facts.person_name && (
                    <p><span className="font-medium text-slate-700">担当者:</span> <span className="text-slate-900">{analysisResult.facts.person_name}</span></p>
                  )}
                  {analysisResult.facts.person_position && (
                    <p><span className="font-medium text-slate-700">役職:</span> <span className="text-slate-900">{analysisResult.facts.person_position}</span></p>
                  )}
                  {analysisResult.facts.industry && (
                    <p><span className="font-medium text-slate-700">業界:</span> <span className="text-slate-900">{analysisResult.facts.industry}</span></p>
                  )}
                  {!analysisResult.facts.company_name && !analysisResult.facts.person_name && (
                    <p className="text-slate-500 italic">基本情報が見つかりませんでした</p>
                  )}
                </div>
              </section>

              {/* 経営シグナル */}
              {analysisResult.signals.length > 0 && (
                <section className="mb-6">
                  <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">📈</span>
                    経営シグナル（仮説）
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.signals.slice(0, 3).map((signal, i) => (
                      <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                          signal.confidence === 'high' ? 'bg-green-100 text-green-700' :
                          signal.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {signal.confidence === 'high' ? '高確度' : signal.confidence === 'medium' ? '中確度' : '低確度'}
                        </span>
                        <span className="text-slate-900">{signal.description}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 不足情報（高優先度のみ） - 常時展開 */}
              {highPriorityMissing.length > 0 && (
                <section className="mb-6">
                  <h4 className="font-medium text-amber-700 mb-3 flex items-center gap-2">
                    <span className="text-lg">&#9888;&#65039;</span>
                    追加入力が推奨される情報
                  </h4>
                  <div className="space-y-4">
                    {highPriorityMissing.map((info, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {info.field}
                        </label>
                        <p className="text-xs text-slate-500 mb-2">{info.suggestion}</p>
                        <input
                          type="text"
                          onChange={(e) => handleOverrideChange(info.field, e.target.value)}
                          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder={`${info.field}を入力...`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 折りたたみセクション群 */}
              {(analysisResult.proof_points.length > 0 || analysisResult.extracted_facts || normalizeSources(analysisResult)) && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">詳細情報</p>
                    <button
                      type="button"
                      onClick={allExpanded ? collapseAll : expandAll}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      {allExpanded ? 'すべて閉じる' : 'すべて展開'}
                    </button>
                  </div>

                  {/* 証拠ポイント - 折りたたみ */}
                  {analysisResult.proof_points.length > 0 && (
                    <div className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('proof_points')}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">&#128142;</span>
                          活用できる証拠
                          <span className="text-xs text-slate-400">({analysisResult.proof_points.length}件)</span>
                        </span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedSections.has('proof_points') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.has('proof_points') && (
                        <div className="px-4 pb-3 space-y-2">
                          {analysisResult.proof_points.slice(0, 3).map((point, i) => (
                            <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 mr-2">
                                {point.type === 'numeric' ? '数値' :
                                 point.type === 'case_study' ? '事例' :
                                 point.type === 'news' ? 'ニュース' : '推論'}
                              </span>
                              <span className="text-slate-900">{point.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 抽出ファクト - 折りたたみ */}
                  {analysisResult.extracted_facts && (
                    <div className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('extracted_facts')}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">&#128270;</span>
                          Webサイトから抽出したファクト
                        </span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedSections.has('extracted_facts') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.has('extracted_facts') && (
                        <div className="px-4 pb-3">
                          <FactsDisplay
                            facts={analysisResult.extracted_facts}
                            defaultExpanded={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 情報ソース - 折りたたみ */}
                  <div className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('sources')}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">&#128279;</span>
                        参照元（情報ソース）
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedSections.has('sources') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.has('sources') && (
                      <div className="px-4 pb-3">
                        <SourcesDisplay
                          sources={normalizeSources(analysisResult)}
                          hasUrl={hasUrl}
                          defaultExpanded={false}
                        />
                      </div>
                    )}
                  </div>

                  {/* 警告フラグ - 折りたたみ */}
                  {analysisResult.risk_flags.filter(f => f.severity === 'high').length > 0 && (
                    <div className="border border-red-200 rounded-lg mb-2 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection('risk_flags')}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">&#128680;</span>
                          注意事項
                          <span className="text-xs text-red-400">({analysisResult.risk_flags.filter(f => f.severity === 'high').length}件)</span>
                        </span>
                        <svg className={`w-4 h-4 text-red-400 transition-transform ${expandedSections.has('risk_flags') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.has('risk_flags') && (
                        <div className="px-4 pb-3">
                          <div className="bg-red-50 rounded-lg p-3">
                            <ul className="text-sm text-red-700 space-y-1">
                              {analysisResult.risk_flags.filter(f => f.severity === 'high').map((flag, i) => (
                                <li key={i}>&#8226; {flag.message}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* モード切り替え */}
              <section className="mb-4">
                <h4 className="font-medium text-slate-900 mb-3">生成モード</h4>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'complete'}
                      onChange={() => setMode('complete')}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-900">完成版</span>
                    <span className="text-xs text-slate-500">（プレースホルダーなし）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'draft'}
                      onChange={() => setMode('draft')}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-900">下書き版</span>
                    <span className="text-xs text-slate-500">（要確認箇所あり）</span>
                  </label>
                </div>
                {mode === 'draft' && (
                  <p className="text-xs text-amber-600 mt-2">
                    下書きモードでは、情報が不足している箇所に【要確認: 〇〇】が表示されます
                  </p>
                )}
              </section>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-slate-600">分析中...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-md hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !analysisResult}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-md hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                生成中...
              </>
            ) : (
              'レターを生成'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
