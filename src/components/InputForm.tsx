'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useInputForm } from '@/hooks/useInputForm';
import { SalesForm } from '@/components/forms/SalesForm';
import { EventForm } from '@/components/forms/EventForm';
import { FORM_LABELS, BUTTON_TEXTS, MESSAGES, ICONS } from '@/lib/constants';

import type { LetterFormData, LetterMode, GenerateResponse } from '@/types/letter';

// PDF.jsを使用するため、SSRを無効化して動的インポート
const MultiSourceModal = dynamic(
  () => import('./MultiSourceModal').then(mod => ({ default: mod.MultiSourceModal })),
  { ssr: false }
);

import { StructureSuggestionModal } from './StructureSuggestionModal';

interface InputFormProps {
  mode: LetterMode;
  onGenerate: (response: GenerateResponse, formData: LetterFormData) => void | Promise<void>;
  setIsGenerating: (isGenerating: boolean) => void;
  formData: LetterFormData;
  setFormData: React.Dispatch<React.SetStateAction<LetterFormData>>;
  onSampleFill?: () => void;
  onReset?: () => void;
  disabled?: boolean;
  onGenerationAttempt?: () => void | Promise<void>;
  /** V2統一生成関数（モーダルなしで一括生成） */
  onGenerateV2?: (formData: LetterFormData, outputFormat: 'letter' | 'email') => Promise<void>;
  /** クイック下書き生成（salesモード用） */
  onQuickDraft?: () => Promise<void>;
  /** 根拠付き生成（分析→モーダル→生成、salesモード用） */
  onAnalyzeAndGenerate?: () => Promise<void>;
  /** クイック下書き生成中フラグ */
  isQuickDrafting?: boolean;
  /** 根拠付き生成中（分析中）フラグ */
  isAnalyzing?: boolean;
}

export function InputForm({
  mode,
  onGenerate,
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
    handleGenerateEmail,
  } = useInputForm({
    mode,
    formData,
    setFormData,
    onGenerate,
    setIsGenerating,
    onGenerationAttempt,
    onGenerateV2,
  });

  const labels = mode === 'sales' ? FORM_LABELS.sales : FORM_LABELS.event;

  // salesモード用：ボタン無効化判定
  const isSalesButtonDisabled = disabled || isQuickDrafting || isAnalyzing || isGeneratingLocal;

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
            <button
              type="button"
              onClick={onSampleFill}
              className="bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 transition-colors font-bold shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <span>{ICONS.sample}</span>
              <span>{BUTTON_TEXTS.sample}</span>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* モードに応じたフォームを表示 */}
        {mode === 'sales' ? (
          <SalesForm
            formData={formData}
            inputMode={inputMode}
            handleChange={handleChange}
            handleOpenMultiSourceModal={handleOpenMultiSourceModal}
            handleAIAssist={handleAIAssist}
            handleOpenStructureSuggestion={handleOpenStructureSuggestion}
            setInputMode={setInputMode}
            setFormData={setFormData}
          />
        ) : (
          <EventForm
            formData={formData}
            inputMode={inputMode}
            isAnalyzingSource={isAnalyzingSource}
            handleChange={handleChange}
            handleOpenMultiSourceModal={handleOpenMultiSourceModal}
            handleAIAssist={handleAIAssist}
            handleAnalyzeEventUrl={handleAnalyzeEventUrl}
            setInputMode={setInputMode}
          />
        )}


        {/* 送信ボタンエリア */}
        {mode === 'sales' ? (
          /* salesモード: 2つの専用ボタン */
          <div className="space-y-3">
            {/* まずは下書き（クイック）ボタン */}
            <button
              type="button"
              onClick={onQuickDraft}
              disabled={isSalesButtonDisabled}
              className={`w-full py-3 px-4 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2
                ${isQuickDrafting
                  ? 'bg-slate-400 text-white cursor-wait'
                  : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 focus:ring-slate-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isQuickDrafting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>下書き生成中...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">✏️</span>
                  <span>まずは下書き（クイック）</span>
                </>
              )}
            </button>

            {/* 根拠付きで生成（分析）ボタン - メインCTA */}
            <button
              type="button"
              onClick={onAnalyzeAndGenerate}
              disabled={isSalesButtonDisabled}
              className={`w-full py-3.5 px-4 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg
                ${generationSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                  : isAnalyzing
                    ? 'bg-indigo-500 text-white cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-xl focus:ring-indigo-500'
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
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">🔍</span>
                  <span>根拠付きで生成（分析）</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* eventモード: 従来のボタン構成 */
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              type="submit"
              disabled={isGeneratingLocal || disabled}
              className={`flex-1 py-3 px-4 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 ${generationSuccess
                ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                : isGeneratingLocal
                  ? 'bg-indigo-500 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl focus:ring-indigo-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={labels.submit}
            >
              {generationSuccess ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{BUTTON_TEXTS.generationComplete}</span>
                </>
              ) : isGeneratingLocal ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{BUTTON_TEXTS.generating}</span>
                </>
              ) : (
                <>
                  <span className="text-lg">{ICONS.submit}</span>
                  <span>{labels.submit}</span>
                </>
              )}
            </button>

            {/* メール生成ボタン */}
            <button
              type="button"
              onClick={handleGenerateEmail}
              disabled={isGeneratingLocal || disabled}
              className={`flex-1 py-3 px-4 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 border-2
              ${isGeneratingLocal || disabled
                  ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'border-indigo-600 text-indigo-600 hover:bg-indigo-50'
                }`}
              aria-label="メールとして生成"
            >
              <span className="text-lg">✉️</span>
              <span>メールとして生成</span>
            </button>
          </div>
        )}
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
                          className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
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
