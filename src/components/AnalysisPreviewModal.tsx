'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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

/**
 * 分析結果全体の確信度を算出
 */
function calculateConfidence(result: AnalysisResult): 'high' | 'medium' | 'low' {
  const highSignals = result.signals.filter(s => s.confidence === 'high').length;
  const highProofs = result.proof_points.filter(p => p.confidence === 'high').length;
  const totalHigh = highSignals + highProofs;
  const total = result.signals.length + result.proof_points.length;

  if (total === 0) return 'low';
  const ratio = totalHigh / total;
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'medium';
  return 'low';
}

function ModalGenerationProgress() {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const steps = [
    { label: 'レターを生成中...', active: elapsed < 15 },
    { label: '品質チェック中...', active: elapsed >= 15 },
  ];
  const currentStepIndex = steps.findIndex(s => s.active);
  const estimatedTotal = 25;
  const progressPercent = Math.min((elapsed / estimatedTotal) * 100, 95);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-3 mb-2">
        {steps.map((step, i) => {
          const isCompleted = i < currentStepIndex;
          const isCurrent = step.active;
          return (
            <div key={i} className={`flex items-center gap-1.5 ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-600' : 'text-slate-300'}`}>
              {isCompleted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : isCurrent ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-200 border-t-amber-700"></div>
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              )}
              <span className="text-xs font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1">
        <div
          className="bg-amber-600 h-1.5 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 text-right">
        経過: {elapsed}秒 / 目安: 約{estimatedTotal}秒
      </p>
    </div>
  );
}

/** フォームに反映可能なファクトの型 */
interface ApplicableFacts {
  companyName?: string;
  name?: string;
  position?: string;
}

interface AnalysisPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  onConfirm: (overrides: UserOverrides, mode: 'draft' | 'complete' | 'event') => void;
  isLoading: boolean;
  hasUrl: boolean;
  letterMode?: 'sales' | 'event';  // ページレベルのモード
  error?: string | null;
  onClearError?: () => void;
  onDraftFallback?: () => void;
  /** 現在のフォームデータ（空フィールド判定用） */
  currentFormData?: { companyName: string; name: string; position: string };
  /** チェックされたファクトをフォームに反映するコールバック */
  onApplyFacts?: (facts: ApplicableFacts) => void;
}

export function AnalysisPreviewModal({
  isOpen,
  onClose,
  analysisResult,
  onConfirm,
  isLoading,
  hasUrl,
  letterMode = 'sales',
  error = null,
  onClearError,
  onDraftFallback,
  currentFormData,
  onApplyFacts,
}: AnalysisPreviewModalProps) {
  // Draftモード自動判定: URLなし または 情報が少ない場合
  const shouldDefaultToDraft = !hasUrl || (analysisResult?.missing_info.filter(m => m.priority === 'high').length ?? 0) > 2;
  const [mode, setMode] = useState<'draft' | 'complete'>(shouldDefaultToDraft ? 'draft' : 'complete');
  const [overrides, setOverrides] = useState<UserOverrides>({});
  const [showDetails, setShowDetails] = useState(false);

  // MUST-2: フォームに反映するファクトのチェック状態（デフォルトON）
  const [applyFields, setApplyFields] = useState({
    companyName: true,
    name: true,
    position: true,
  });

  const handleOverrideChange = useCallback((field: string, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    // MUST-2: チェックされたファクトのみフォームに反映
    if (onApplyFacts && analysisResult?.facts) {
      const facts: ApplicableFacts = {};
      if (applyFields.companyName && analysisResult.facts.company_name) {
        facts.companyName = analysisResult.facts.company_name;
      }
      if (applyFields.name && analysisResult.facts.person_name) {
        facts.name = analysisResult.facts.person_name;
      }
      if (applyFields.position && analysisResult.facts.person_position) {
        facts.position = analysisResult.facts.person_position;
      }
      onApplyFacts(facts);
    }

    const apiMode = letterMode === 'event' ? 'event' : mode;
    onConfirm(overrides, apiMode);
  }, [onConfirm, overrides, mode, letterMode, onApplyFacts, applyFields, analysisResult]);

  if (!isOpen) return null;

  const highPriorityMissing = analysisResult?.missing_info.filter(m => m.priority === 'high') || [];
  const confidence = analysisResult ? calculateConfidence(analysisResult) : 'low';
  const evidenceCount = (analysisResult?.proof_points.length ?? 0) + (analysisResult?.signals.length ?? 0);

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
        <div className={`p-4 sm:p-6 ${showDetails ? 'overflow-y-auto max-h-[60vh]' : ''}`}>
          {analysisResult ? (
            <>
              {/* ===== Stage 1: サマリー（スクロール不要） ===== */}
              <div className="space-y-4">
                {/* 企業名 + 業界 */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      {analysisResult.facts.company_name || '企業名不明'}
                    </h4>
                    {analysisResult.facts.industry && (
                      <p className="text-sm text-slate-500">{analysisResult.facts.industry}</p>
                    )}
                  </div>
                </div>

                {/* MUST-2: フォームに反映する情報の確認チェックボックス */}
                {(() => {
                  const facts = analysisResult.facts;
                  // 空フィールドのみ対象（既に入力済みなら表示しない）
                  const applicableItems = [
                    { key: 'companyName' as const, label: '企業名', value: facts.company_name, isEmpty: !currentFormData?.companyName },
                    { key: 'name' as const, label: '担当者名', value: facts.person_name, isEmpty: !currentFormData?.name },
                    { key: 'position' as const, label: '役職', value: facts.person_position, isEmpty: !currentFormData?.position },
                  ].filter(item => item.value && item.isEmpty);

                  if (applicableItems.length === 0) return null;

                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 mb-2">フォームに反映する情報</p>
                      <div className="space-y-1.5">
                        {applicableItems.map(item => (
                          <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={applyFields[item.key]}
                              onChange={(e) => setApplyFields(prev => ({ ...prev, [item.key]: e.target.checked }))}
                              className="w-4 h-4 text-amber-700 rounded border-amber-300 focus:ring-amber-500"
                            />
                            <span className="text-sm text-stone-600">{item.label}:</span>
                            <span className="text-sm font-medium text-stone-900">{item.value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 証拠カウント + 確信度バー */}
                <div className="bg-stone-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-stone-800">
                      {evidenceCount}件の根拠を発見
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-stone-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-500 ${
                        confidence === 'high' ? 'bg-emerald-500 w-full' :
                        confidence === 'medium' ? 'bg-amber-500 w-2/3' :
                        'bg-red-400 w-1/3'
                      }`} />
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${
                      confidence === 'high' ? 'text-emerald-700' :
                      confidence === 'medium' ? 'text-amber-700' :
                      'text-red-600'
                    }`}>
                      {confidence === 'high' ? '高い確信度' :
                       confidence === 'medium' ? '中程度の確信度' :
                       '低い確信度'}
                    </span>
                  </div>
                </div>

                {/* モード選択（コンパクト） */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-700">生成モード:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'complete'}
                      onChange={() => setMode('complete')}
                      className="w-3.5 h-3.5 text-amber-700"
                    />
                    <span className="text-sm text-slate-900">完成版</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'draft'}
                      onChange={() => setMode('draft')}
                      className="w-3.5 h-3.5 text-amber-700"
                    />
                    <span className="text-sm text-slate-900">下書き</span>
                  </label>
                </div>
                {mode === 'draft' && (
                  <p className="text-xs text-amber-600 -mt-2">
                    情報が不足している箇所に【要確認: ...】が表示されます
                  </p>
                )}
              </div>

              {/* ===== Stage 2 トグル ===== */}
              {(analysisResult.proof_points.length > 0 || analysisResult.signals.length > 0 || analysisResult.extracted_facts || normalizeSources(analysisResult)) && (
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full text-center py-2 mt-3 text-sm text-amber-700 hover:text-amber-800 font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showDetails ? '詳細を閉じる' : '詳細を見る'}
                </button>
              )}

              {/* ===== Stage 2: 詳細情報 ===== */}
              {showDetails && (
                <div className="space-y-5 border-t border-stone-200 pt-4 mt-2">
                  {/* 仮説モード警告バナー */}
                  {(() => {
                    const blockedFlag = analysisResult.risk_flags?.find(
                      (f) => f.message.includes('ブロック') || f.message.includes('仮説モード')
                    );
                    return blockedFlag ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        <span className="mr-1">&#9888;&#65039;</span> {blockedFlag.message}
                      </div>
                    ) : null;
                  })()}

                  {/* 不足情報入力フィールド */}
                  {highPriorityMissing.length > 0 && (
                    <section>
                      <h4 className="font-medium text-amber-700 mb-3 flex items-center gap-2 text-sm">
                        <span>&#9888;&#65039;</span>
                        追加入力が推奨される情報
                      </h4>
                      <div className="space-y-3">
                        {highPriorityMissing.map((info, i) => (
                          <div key={i}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              {info.field}
                            </label>
                            <p className="text-xs text-slate-500 mb-1">{info.suggestion}</p>
                            <input
                              type="text"
                              onChange={(e) => handleOverrideChange(info.field, e.target.value)}
                              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              placeholder={`${info.field}を入力...`}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 抽出された基本情報 */}
                  <section>
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2 text-sm">
                      <span>📊</span> 抽出された情報
                    </h4>
                    <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-sm">
                      {analysisResult.facts.company_name && (
                        <p><span className="font-medium text-slate-600">企業名:</span> {analysisResult.facts.company_name}</p>
                      )}
                      {analysisResult.facts.person_name && (
                        <p><span className="font-medium text-slate-600">担当者:</span> {analysisResult.facts.person_name}</p>
                      )}
                      {analysisResult.facts.person_position && (
                        <p><span className="font-medium text-slate-600">役職:</span> {analysisResult.facts.person_position}</p>
                      )}
                      {analysisResult.facts.industry && (
                        <p><span className="font-medium text-slate-600">業界:</span> {analysisResult.facts.industry}</p>
                      )}
                      {!analysisResult.facts.company_name && !analysisResult.facts.person_name && (
                        <p className="text-slate-500 italic">基本情報が見つかりませんでした</p>
                      )}
                    </div>
                  </section>

                  {/* 経営シグナル */}
                  {analysisResult.signals.length > 0 && (
                    <section>
                      <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2 text-sm">
                        <span>📈</span> 経営シグナル（仮説）
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

                  {/* 証拠ポイント */}
                  {analysisResult.proof_points.length > 0 && (
                    <section>
                      <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2 text-sm">
                        <span>💎</span> 活用できる証拠
                        <span className="text-xs text-slate-400">({analysisResult.proof_points.length}件)</span>
                      </h4>
                      <div className="space-y-2">
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
                    </section>
                  )}

                  {/* 抽出ファクト */}
                  {analysisResult.extracted_facts && (
                    <section>
                      <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2 text-sm">
                        <span>🔍</span> Webサイトから抽出したファクト
                      </h4>
                      <FactsDisplay
                        facts={analysisResult.extracted_facts}
                        defaultExpanded={true}
                      />
                    </section>
                  )}

                  {/* 情報ソース */}
                  <section>
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2 text-sm">
                      <span>🔗</span> 参照元（情報ソース）
                    </h4>
                    <SourcesDisplay
                      sources={normalizeSources(analysisResult)}
                      hasUrl={hasUrl}
                      defaultExpanded={false}
                    />
                  </section>

                  {/* 注意事項 */}
                  {analysisResult.risk_flags.filter(f => f.severity === 'high').length > 0 && (
                    <section>
                      <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2 text-sm">
                        <span>🚨</span> 注意事項
                        <span className="text-xs text-red-400">({analysisResult.risk_flags.filter(f => f.severity === 'high').length}件)</span>
                      </h4>
                      <div className="bg-red-50 rounded-lg p-3">
                        <ul className="text-sm text-red-700 space-y-1">
                          {analysisResult.risk_flags.filter(f => f.severity === 'high').map((flag, i) => (
                            <li key={i}>&#8226; {flag.message}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-700 mx-auto mb-4"></div>
              <p className="text-slate-600">分析中...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50">
          {/* エラー表示（モーダル内） */}
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => { onClearError?.(); handleConfirm(); }}
                      className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                    >
                      もう一度試す
                    </button>
                    {onDraftFallback && (
                      <button
                        onClick={onDraftFallback}
                        className="px-3 py-1 text-xs bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                      >
                        下書きモードで試す
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="px-3 py-1 text-xs bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isLoading && <ModalGenerationProgress />}
          <div className="flex gap-3">
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
              className="flex-1 bg-amber-800 text-white py-2.5 rounded-md hover:bg-amber-900 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </div>
  );
}
