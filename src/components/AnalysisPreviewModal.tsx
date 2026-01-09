'use client';

import React, { useState, useCallback } from 'react';
import type { AnalysisResult } from '@/types/analysis';
import type { UserOverrides } from '@/types/generate-v2';

interface AnalysisPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult | null;
  onConfirm: (overrides: UserOverrides, mode: 'draft' | 'complete') => void;
  isLoading: boolean;
  hasUrl: boolean;
}

export function AnalysisPreviewModal({
  isOpen,
  onClose,
  analysisResult,
  onConfirm,
  isLoading,
  hasUrl,
}: AnalysisPreviewModalProps) {
  // Draftモード自動判定: URLなし または 情報が少ない場合
  const shouldDefaultToDraft = !hasUrl || (analysisResult?.missing_info.filter(m => m.priority === 'high').length ?? 0) > 2;
  const [mode, setMode] = useState<'draft' | 'complete'>(shouldDefaultToDraft ? 'draft' : 'complete');
  const [overrides, setOverrides] = useState<UserOverrides>({});

  const handleOverrideChange = useCallback((field: string, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(overrides, mode);
  }, [onConfirm, overrides, mode]);

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

              {/* 証拠ポイント */}
              {analysisResult.proof_points.length > 0 && (
                <section className="mb-6">
                  <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">💎</span>
                    活用できる証拠
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

              {/* 不足情報（高優先度のみ） */}
              {highPriorityMissing.length > 0 && (
                <section className="mb-6">
                  <h4 className="font-medium text-amber-700 mb-3 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
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

              {/* 警告フラグ */}
              {analysisResult.risk_flags.filter(f => f.severity === 'high').length > 0 && (
                <section className="mb-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <span>🚨</span> 注意事項
                    </h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {analysisResult.risk_flags.filter(f => f.severity === 'high').map((flag, i) => (
                        <li key={i}>• {flag.message}</li>
                      ))}
                    </ul>
                  </div>
                </section>
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
