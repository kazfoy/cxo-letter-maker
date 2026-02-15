'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useInputForm } from '@/hooks/useInputForm';
import { SalesForm } from '@/components/forms/SalesForm';
import { EventForm } from '@/components/forms/EventForm';
import { FORM_LABELS, BUTTON_TEXTS, MESSAGES, ICONS } from '@/lib/constants';

import type { LetterFormData, LetterMode } from '@/types/letter';

// PDF.jsを使用するため、SSRを無効化して動的インポート
const MultiSourceModal = dynamic(
  () => import('./MultiSourceModal').then(mod => ({ default: mod.MultiSourceModal })),
  { ssr: false }
);

import { StructureSuggestionModal } from './StructureSuggestionModal';

interface InputFormProps {
  mode: LetterMode;
  setIsGenerating: (isGenerating: boolean) => void;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
  onSampleFill?: () => void;
  onReset?: () => void;
  disabled?: boolean;
  onGenerationAttempt?: () => void | Promise<void>;
  /** V2統一生成関数 */
  onGenerateV2: (formData: LetterFormData, outputFormat: 'letter' | 'email') => Promise<void>;
  /** クイック下書き生成 */
  onQuickDraft?: () => Promise<void>;
  /** 根拠付き生成（分析→モーダル→生成） */
  onAnalyzeAndGenerate?: () => Promise<void>;
  /** クイック下書き生成中フラグ */
  isQuickDrafting?: boolean;
  /** 根拠付き生成中（分析中）フラグ */
  isAnalyzing?: boolean;
  /** ゲスト残り回数 */
  guestRemaining?: number;
  /** ゲスト日次制限 */
  guestLimit?: number;
  /** ログイン済みかどうか */
  isLoggedIn?: boolean;
  /** フォームバリデーションエラー */
  formErrors?: Record<string, string>;
  /** エラークリアコールバック */
  onClearError?: (field: string) => void;
}

export function InputForm({
  mode,
  setIsGenerating,
  formData,
  setFormData,
  onSampleFill,
  onReset,
  disabled = false,
  onGenerationAttempt,
  onGenerateV2,
  onQuickDraft,
  onAnalyzeAndGenerate,
  isQuickDrafting = false,
  isAnalyzing = false,
  guestRemaining,
  guestLimit,
  isLoggedIn = false,
  formErrors = {},
  onClearError,
}: InputFormProps) {
  const {
    // State
    aiModalOpen,
    aiSuggestions,
    isLoadingAI,
    multiSourceModalOpen,
    sourceInputType,
    isAnalyzingSource,
    analysisPhase,
    isGeneratingLocal,
    generationSuccess,
    inputMode,
    structureSuggestionModalOpen,
    // State setters
    setAiModalOpen,
    setMultiSourceModalOpen,
    setStructureSuggestionModalOpen,
    setInputMode,
    // Handlers
    handleChange,
    handleAIAssist,
    handleSelectSuggestion,
    handleOpenMultiSourceModal,
    handleAnalyzeMultiSource,
    handleOpenStructureSuggestion,
    handleSelectApproach,

    handleSubmit,
    handleAnalyzeEventUrl,
    handleGenerateEmail: _handleGenerateEmail,
  } = useInputForm({
    mode,
    formData,
    setFormData,
    setIsGenerating,
    onGenerationAttempt,
    onGenerateV2,
  });

  const labels = mode === 'event' ? FORM_LABELS.event : FORM_LABELS.sales;

  // 2レーン用：ボタン無効化判定（sales/event共通）
  const isTwoLaneButtonDisabled = disabled || isQuickDrafting || isAnalyzing || isGeneratingLocal;


  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 leading-relaxed">
          {labels.title}
        </h2>
        <div className="flex gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-slate-500 hover:text-red-600 px-3 py-2 rounded-md hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-1"
              title="入力内容をクリアして初期状態に戻します"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>新規作成（リセット）</span>
            </button>
          )}
          {onSampleFill && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={onSampleFill}
                className="bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 transition-colors font-bold shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <span>{ICONS.sample}</span>
                <span>{BUTTON_TEXTS.sample}</span>
              </button>
              <p className="text-xs text-slate-400 max-w-[200px] text-right leading-tight">
                サンプル企業は実在しますが、本サービスとは無関係です。
              </p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* モードに応じたフォームを表示 */}
        {mode === 'event' ? (
          <EventForm
            formData={formData}
            inputMode={inputMode}
            isAnalyzingSource={isAnalyzingSource}
            handleChange={handleChange}
            handleOpenMultiSourceModal={handleOpenMultiSourceModal}
            handleAIAssist={handleAIAssist}
            handleAnalyzeEventUrl={handleAnalyzeEventUrl}
            setInputMode={setInputMode}
            setFormData={setFormData}
          />
        ) : (
          <SalesForm
            formData={formData}
            inputMode={inputMode}
            handleChange={handleChange}
            handleOpenMultiSourceModal={handleOpenMultiSourceModal}
            handleAIAssist={handleAIAssist}
            handleOpenStructureSuggestion={handleOpenStructureSuggestion}
            setInputMode={setInputMode}
            setFormData={setFormData}
            formErrors={formErrors}
            onClearError={onClearError}
          />
        )}


        {/* ゲスト→無料会員メリット表示 */}
        {!isLoggedIn && guestRemaining !== undefined && guestLimit !== undefined && (
          <div className={`rounded-lg p-3 text-sm ${guestRemaining <= 1 ? 'bg-red-50 border border-red-200' : guestRemaining <= 3 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium ${guestRemaining <= 1 ? 'text-red-800' : guestRemaining <= 3 ? 'text-amber-800' : 'text-slate-700'}`}>
                本日の残り生成回数: <span className="font-bold text-lg">{guestRemaining}</span>/{guestLimit}
              </span>
              {guestRemaining <= 3 && (
                <a href="/login" className={`text-xs font-semibold underline ${guestRemaining <= 1 ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}>
                  無料登録で10回/日に増やす →
                </a>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              アカウント作成で履歴保存・高品質モードが利用可能に
            </p>
          </div>
        )}

        {/* 送信ボタンエリア - 統合CTA */}
        <div className="space-y-3">
          {/* URL入力のヒント */}
          <p className="text-xs text-stone-500">
            URLを入れると、企業分析に基づいた高品質なレターを生成します
          </p>

          {/* 統合CTAボタン */}
          <button
            type="button"
            onClick={() => {
              // URL有無で自動分岐
              const hasUrl = !!(formData.targetUrl?.trim() || formData.eventUrl?.trim());
              if (hasUrl) {
                // URLあり → 分析→モーダル→生成
                onAnalyzeAndGenerate?.();
              } else {
                // URLなし → クイック下書き生成
                onQuickDraft?.();
              }
            }}
            disabled={isTwoLaneButtonDisabled}
            className={`w-full py-3.5 px-4 rounded-md font-bold text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg
              ${generationSuccess
                ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                : isAnalyzing || isQuickDrafting
                  ? 'bg-amber-700 text-white cursor-wait'
                  : 'bg-amber-800 hover:bg-amber-900 text-white hover:shadow-xl focus:ring-amber-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {generationSuccess ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{BUTTON_TEXTS.generationComplete}</span>
              </>
            ) : isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>企業を分析中...</span>
              </>
            ) : isQuickDrafting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>レターを生成中...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>レターを生成</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* AIアシストモーダル */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">{MESSAGES.modal.aiAssistTitle}</h3>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label={BUTTON_TEXTS.close}
              >
                {ICONS.close}
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {isLoadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto mb-4"></div>
                    <p className="text-gray-600">{MESSAGES.info.aiThinking}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-800">{MESSAGES.modal.candidatePrefix} {index + 1}</h4>
                        <button
                          className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded hover:bg-amber-200 transition-colors"
                          aria-label={BUTTON_TEXTS.selectSuggestion}
                        >
                          {BUTTON_TEXTS.selectSuggestion}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{suggestion}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* マルチソース入力モーダル */}
      <MultiSourceModal
        isOpen={multiSourceModalOpen}
        onClose={() => setMultiSourceModalOpen(false)}
        onAnalyze={handleAnalyzeMultiSource}
        type={sourceInputType}
        isAnalyzing={isAnalyzingSource}
        analysisPhase={analysisPhase}
      />

      {/* 構成案提案モーダル */}
      <StructureSuggestionModal
        isOpen={structureSuggestionModalOpen}
        onClose={() => setStructureSuggestionModalOpen(false)}
        onSelectApproach={handleSelectApproach}
        companyName={formData.companyName}
        myServiceDescription={formData.myServiceDescription}
        background={formData.background}
      />
    </div>
  );
}
